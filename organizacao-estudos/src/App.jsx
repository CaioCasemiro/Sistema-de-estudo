import { useState, useEffect } from "react";
import { ciclo, assuntos, pesosDisciplinas, cronogramaSemanal, metasRevisao, poolMissoesExtras } from "./dados.js";
import { db } from "./firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  getDocs,
  setDoc
} from "firebase/firestore";

const etapasRevisao = [
  { chave: "24h", nome: "24 HORAS", dias: 1 },
  { chave: "7d", nome: "7 DIAS", dias: 7 },
  { chave: "14d", nome: "14 DIAS", dias: 14 },
  { chave: "21d", nome: "21 DIAS", dias: 21 },
  { chave: "28d", nome: "28 DIAS", dias: 28 }
];

export default function App() {
  const [acertosBasicos, setAcertosBasicos] = useState(0);
  const [acertosEspecificos, setAcertosEspecificos] = useState(0);
  const [revisoesHoje, setRevisoesHoje] = useState([]);
  const [redacoesFeitas, setRedacoesFeitas] = useState(0);
  const [fezRedacao, setFezRedacao] = useState(false);
  const [missoesExtras, setMissoesExtras] = useState([]);
  const [statusMissoes, setStatusMissoes] = useState({});
  const [progresso, setProgresso] = useState({});
  const [desempenho, setDesempenho] = useState({});
  const [revisoes, setRevisoes] = useState({});
  const [metasHoje, setMetasHoje] = useState([]);
  const [dadosMetas, setDadosMetas] = useState({});
  const [simulados, setSimulados] = useState([]);
  const [materiaDetalhada, setMateriaDetalhada] = useState(null);

  const diaHoje = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][new Date().getDay()];

  useEffect(() => {
    async function carregar() {
      try {
        const p = await getDoc(doc(db, "progresso", "materias"));
        if (p.exists()) setProgresso(p.data());
        const d = await getDoc(doc(db, "desempenho", "materias"));
        if (d.exists()) setDesempenho(d.data());
        const r = await getDoc(doc(db, "revisoes", "materias"));
        if (r.exists()) setRevisoes(r.data());

        const q = query(collection(db, "simulados"));
        const querySnapshot = await getDocs(q);
        const sims = [];
        querySnapshot.forEach(doc => sims.push({ id: doc.id, ...doc.data() }));
        setSimulados(sims.sort((a, b) => new Date(b.data) - new Date(a.data)));

        const redacoesDoc = await getDoc(doc(db, "redacoes", "contador"));
        if (redacoesDoc.exists()) setRedacoesFeitas(redacoesDoc.data().total);

        const hoje = new Date().toISOString().split("T")[0];
        const missaoDoc = await getDoc(doc(db, "missoesDiarias", hoje));

        if (missaoDoc.exists()) {
          setMissoesExtras(missaoDoc.data().missoes);
        }
      } catch (e) { console.error(e); }
    }
    carregar();
  }, []);

  useEffect(() => {
    const materias = cronogramaSemanal[diaHoje] || [];
    const metas = [];
    const revisoesPendentes = [];
    const hoje = new Date().toISOString().split("T")[0];

    for (const materia in revisoes) {
      for (const assuntoIndex in revisoes[materia]) {
        const rev = revisoes[materia][assuntoIndex];
        etapasRevisao.forEach(etapa => {
          const dataRevisao = rev[`revisao${etapa.chave}`];
          const concluido = rev[`concluido${etapa.chave}`];

          if (dataRevisao && !concluido && new Date(dataRevisao).toISOString().split("T")[0] <= hoje) {
            revisoesPendentes.push({
              materia,
              assuntoIndex: parseInt(assuntoIndex),
              assunto: assuntos[materia][assuntoIndex],
              tipo: etapa.nome,
              chaveRevisao: `concluido${etapa.chave}`
            });
          }
        });
      }
    }
    materias.forEach(m => metas.push({ tipo: "nova", materia: m }));
    setRevisoesHoje(revisoesPendentes);
    setMetasHoje(metas);
    const inicial = {};
    metas.forEach((m, i) => (inicial[i] = { estudado: false, acertos: 0, erros: 0 }));
    setDadosMetas(inicial);
    if (missoesExtras.length === 0) {

      async function carregarMissoesDoDia() {

        const hoje = new Date()
          .toISOString()
          .split("T")[0];

        const missaoDoc = await getDoc(
          doc(
            db,
            "missoesDiarias",
            hoje
          )
        );

        if (missaoDoc.exists()) {
          setMissoesExtras(
            missaoDoc.data().missoes
          );
          return;
        }

        const missoes = [];

        while (missoes.length < 2) {

          const aleatoria =
            poolMissoesExtras[
            Math.floor(
              Math.random() *
              poolMissoesExtras.length
            )
            ];

          if (!missoes.includes(aleatoria)) {
            missoes.push(aleatoria);
          }
        }

        await setDoc(
          doc(db, "missoesDiarias", hoje),
          {
            data: hoje,
            missoes
          }
        );

        setMissoesExtras(missoes);
      }

      carregarMissoesDoDia();




    }


  }, [diaHoje, revisoes, progresso, missoesExtras]);

  function adicionarDias(data, dias) {

    const nova = new Date(data);

    nova.setDate(
      nova.getDate() + dias
    );

    return nova.toISOString();

  }

  async function salvar(i, dados) {

    const meta = metasHoje[i];

    const idx =
      meta.tipo === "revisao"
        ? meta.assuntoIndex
        : (progresso[meta.materia] || 0);

    if (meta.tipo === "nova") {

      await setDoc(
        doc(db, "progresso", "materias"),
        {
          [meta.materia]: idx + 1
        },
        { merge: true }
      );

    }

    if (
      pesosDisciplinas[meta.materia]
        .tipoEstudo === "questoes"
    ) {

      const des =
        desempenho[meta.materia]?.[idx]
        || {
          acertos: 0,
          erros: 0,
          total: 0
        };

      await setDoc(
        doc(db, "desempenho", "materias"),
        {

          [meta.materia]: {

            ...(desempenho[meta.materia] || {}),

            [idx]: {

              acertos:
                des.acertos +
                dados.acertos,

              erros:
                des.erros +
                dados.erros,

              total:
                des.total +
                dados.acertos +
                dados.erros

            }

          }

        },
        { merge: true }
      );

    }

    const agora = new Date();

    const revAtu =
      revisoes[meta.materia]?.[idx]
      || {};

    const novasQ =
      meta.tipo === "nova"
        ? 0
        : (revAtu.questoesRevisao || 0)
        + (dados.acertos + dados.erros);

    await setDoc(
      doc(db, "revisoes", "materias"),
      {

        [meta.materia]: {

          ...(revisoes[meta.materia] || {}),

          [idx]: {

            questoesRevisao: novasQ,

            revisao24h: revAtu.revisao24h || adicionarDias(agora, 1),
            revisao7d: revAtu.revisao7d || adicionarDias(agora, 7),
            revisao14d: revAtu.revisao14d || adicionarDias(agora, 14),
            revisao21d: revAtu.revisao21d || adicionarDias(agora, 21),
            revisao28d: revAtu.revisao28d || adicionarDias(agora, 28),
            concluido24h: revAtu.concluido24h || false,
            concluido7d: revAtu.concluido7d || false,
            concluido14d: revAtu.concluido14d || false,
            concluido21d: revAtu.concluido21d || false,
            concluido28d: revAtu.concluido28d || false,
            last: agora.toISOString()

          }

        }

      },
      { merge: true }
    );

    alert("Salvo!");

    window.location.reload();

  }

  async function concluirRevisao(revisao) {
    await updateDoc(
      doc(db, "revisoes", "materias"),
      {
        [`${revisao.materia}.${revisao.assuntoIndex}.${revisao.chaveRevisao}`]: true
      }
    );
    window.location.reload();
  }


  function verificarMedia() {
    const percentualBasicos = (acertosBasicos / 20) * 100;
    const percentualEspecificos = (acertosEspecificos / 20) * 100;
    const notaFinal = (acertosBasicos * 1) + (acertosEspecificos * 2);
    const percentualGeral = Math.round((notaFinal / 60) * 100);

    return {
      percentualBasicos: Math.round(percentualBasicos),
      percentualEspecificos: Math.round(percentualEspecificos),
      percentualGeral,
      atingiuBasicos: percentualBasicos >= 50,
      atingiuEspecificos: percentualEspecificos >= 50,
      atingiuGeral: percentualGeral >= 60,
      aprovado: percentualBasicos >= 50 && percentualEspecificos >= 50 && percentualGeral >= 60
    };
  }

  async function salvarSimulado() {

    if (
      acertosBasicos < 0 ||
      acertosBasicos > 20 ||
      acertosEspecificos < 0 ||
      acertosEspecificos > 20
    ) {
      alert("Cada bloco deve ficar entre 0 e 20.");
      return;
    }

    const notaFinal =
      (acertosBasicos * 1) +
      (acertosEspecificos * 2);

    const porcentagem = Math.round(
      (notaFinal / 60) * 100
    );

    const media = verificarMedia();

    await addDoc(collection(db, "simulados"), {
      basicos: acertosBasicos,
      especificos: acertosEspecificos,
      notaFinal,
      porcentagem,
      data: new Date().toISOString()
    });

    let mensagem = `Simulado salvo!\n\n`;
    mensagem += `📊 RESULTADO:\n`;
    mensagem += `Básicas: ${media.percentualBasicos}% ${media.atingiuBasicos ? "✓" : "✗"}\n`;
    mensagem += `Específicas: ${media.percentualEspecificos}% ${media.atingiuEspecificos ? "✓" : "✗"}\n`;
    mensagem += `Geral: ${media.percentualGeral}% ${media.atingiuGeral ? "✓" : "✗"}\n\n`;
    mensagem += media.aprovado 
      ? "🎉 PARABÉNS! Você atingiu as médias exigidas!" 
      : "⚠️ Você não atingiu as médias. Necesário melhorar!";

    alert(mensagem);
    window.location.reload();
  }

  async function salvarRedacao() {

    await setDoc(doc(db, "redacoes", "contador"), {
      total: redacoesFeitas + 1,
      last: new Date().toISOString()
    });

    alert("Redação registrada!");
    window.location.reload();
  }

  async function salvarMissao(index) {

    await addDoc(collection(db, "missoesExtras"), {

      missao: missoesExtras[index],

      concluida: statusMissoes[index],

      data: new Date().toISOString()

    });


    alert("Missão registrada!");

  }

  return (
    <div className="container">
      <header className="header">

        <h1>PÓS-EDITAL: {diaHoje.toUpperCase()}</h1>
        <p>{new Date().toLocaleDateString("pt-BR")}</p>
      </header>

      {revisoesHoje.length > 0 && (

        <section className="revisoes-pendentes">

          <h2>▼ REVISÕES PENDENTES ▼</h2>

          <div className="revisoes-grid">

            {revisoesHoje.map((r, i) => (

              <div
                className="revisao-item"
                key={i}
              >

                <h4>{r.materia}</h4>

                <p>{r.assunto}</p>

                <p>
                  PRAZO: {r.tipo}
                </p>

                <button
                  className="btn-revisao"
                  onClick={() => concluirRevisao(r)}
                >
                  MARCAR COMO FEITA
                </button>

              </div>

            ))}

          </div>

        </section>

      )}

      <div className="metas-wrapper">
        {metasHoje.map((m, i) => {
          const idx = m.tipo === "revisao" ? m.assuntoIndex : (progresso[m.materia] || 0);
          if (m.materia === "Simulado") return (
            <div className="card simulado" key={i}>
              <span className="badge">SIMULADO</span>

              <h3 className="materia">SIMULADO GERAL</h3>

              <div className="simulado-inputs">
                <div className="input-group">
                  <label>ACERTOS BÁSICAS (0-20)</label>
                  <input
                    type="number"
                    value={acertosBasicos}
                    onChange={(e) =>
                      setAcertosBasicos(parseInt(e.target.value) || 0)
                    }
                    min="0"
                    max="20"
                  />
                </div>
                <div className="input-group">
                  <label>ACERTOS ESPECÍFICAS (0-20)</label>
                  <input
                    type="number"
                    value={acertosEspecificos}
                    onChange={(e) =>
                      setAcertosEspecificos(parseInt(e.target.value) || 0)
                    }
                    min="0"
                    max="20"
                  />
                </div>
              </div>
              <p className="nota-previa">NOTA PRÉVIA: {(acertosBasicos * 1) + (acertosEspecificos * 2)} / 60</p>
              
              <div className="media-preview">
                <h4>VERIFICAÇÃO DE MÉDIA</h4>
                <div className="media-item">
                  <span>BÁSICAS: {Math.round((acertosBasicos / 20) * 100)}%</span>
                  <span className={`status ${verificarMedia().atingiuBasicos ? "ok" : "nao-ok"}`}>
                    {verificarMedia().atingiuBasicos ? "✓ PASSOU" : "✗ ABAIXO"}
                  </span>
                </div>
                <div className="media-item">
                  <span>ESPECÍFICAS: {Math.round((acertosEspecificos / 20) * 100)}%</span>
                  <span className={`status ${verificarMedia().atingiuEspecificos ? "ok" : "nao-ok"}`}>
                    {verificarMedia().atingiuEspecificos ? "✓ PASSOU" : "✗ ABAIXO"}
                  </span>
                </div>
                <div className="media-item">
                  <span>GERAL: {Math.round(((acertosBasicos * 1 + acertosEspecificos * 2) / 60) * 100)}%</span>
                  <span className={`status ${verificarMedia().atingiuGeral ? "ok" : "nao-ok"}`}>
                    {verificarMedia().atingiuGeral ? "✓ PASSOU" : "✗ ABAIXO"}
                  </span>
                </div>
                <div className={`resultado-final ${verificarMedia().aprovado ? "aprovado" : "reprovado"}`}>
                  {verificarMedia().aprovado ? "🎉 DENTRO DAS MÉDIAS!" : "⚠️ ABAIXO DA MÉDIA"}
                </div>
              </div>

              <button className="btn" onClick={salvarSimulado}>
                REGISTRAR SIMULADO ▶
              </button>
            </div>
          );
          if (m.materia === "Redação") {
            return (
              <div className="card redacao" key={i}>
                <span className="badge">REDAÇÃO</span>
                <h3 className="materia">REDAÇÃO</h3>
                <div className="checkbox">
                  <input
                    type="checkbox"
                    id={`redacao-fez-${i}`}
                    checked={fezRedacao}
                    onChange={() => setFezRedacao(!fezRedacao)}
                  />
                  <label htmlFor={`redacao-fez-${i}`}>CONCLUÍ A REDAÇÃO</label>
                </div>
                <button className="btn" onClick={salvarRedacao} disabled={!fezRedacao}>
                  REGISTRAR REDAÇÃO ▶
                </button>
              </div>
            );
          }
          return (
            <div className="card nova" key={i}>
              <span className="badge">NOVA MISSÃO</span>
              <h3 className="materia">{m.materia.toUpperCase()}</h3>
              <p className="assunto">{assuntos[m.materia]?.[idx]}</p>
              {pesosDisciplinas[m.materia].tipoEstudo === "questoes" ? (
                <div className="inputs">
                  <input
                    type="number"
                    placeholder="ACERTOS"
                    value={dadosMetas[i]?.acertos || ""}
                    onChange={(e) =>
                      setDadosMetas({ ...dadosMetas, [i]: { ...dadosMetas[i], acertos: parseInt(e.target.value) || 0 } })}
                  />
                  <input
                    type="number"
                    placeholder="ERROS"
                    value={dadosMetas[i]?.erros || ""}
                    onChange={(e) =>
                      setDadosMetas({ ...dadosMetas, [i]: { ...dadosMetas[i], erros: parseInt(e.target.value) || 0 } })}
                  />
                </div>
              ) : (
                <div className="checkbox">
                  <input
                    type="checkbox"
                    id={`estudado-${i}`}
                    checked={dadosMetas[i]?.estudado || false}
                    onChange={(e) =>
                      setDadosMetas({ ...dadosMetas, [i]: { ...dadosMetas[i], estudado: e.target.checked } })}
                  />
                  <label htmlFor={`estudado-${i}`}>CONCLUÍ A LEITURA</label>
                </div>
              )}
              <button
                className="btn"
                onClick={() => salvar(i, dadosMetas[i])}
                disabled={!dadosMetas[i]?.estudado && pesosDisciplinas[m.materia].tipoEstudo === "leitura"}
              >
                CONCLUIR MISSÃO ▶
              </button>
            </div>
          );
        })}
      </div>

      {Array.isArray(missoesExtras) && missoesExtras.length > 0 && (
        <section className="missoes-extras">
          <h2>▼ MISSÕES EXTRAS ▼</h2>
          <div className="missoes-grid">
            {missoesExtras.map((missao, idx) => {
              const tipo = missao?.tipo || "missao";
              const descricao = missao?.descricao || String(missao);
              return (
                <div className="missao-card" key={idx}>
                  <span className={`tag-missao ${tipo}`}>{tipo.toUpperCase()}</span>
                  <p className="missao-descricao">{descricao}</p>
                  <div className="checkbox">
                    <input
                      type="checkbox"
                      id={`missao-${idx}`}
                      checked={statusMissoes[idx] || false}
                      onChange={(e) => setStatusMissoes({ ...statusMissoes, [idx]: e.target.checked })}
                    />
                    <label htmlFor={`missao-${idx}`}>CONCLUÍDA</label>
                  </div>
                  <button className="btn-missao" onClick={() => salvarMissao(idx)} disabled={!statusMissoes[idx]}>
                    REGISTRAR MISSÃO ▶
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="dashboard">
        <h2>▼ RELATÓRIO DE INTELIGÊNCIA (DESEMPENHO) ▼</h2>
        <div className="dashboard-grid">
          {ciclo.map(m => {
            if (m === "Redação" || m === "Simulado") return null;
            let acertos = 0, erros = 0, total = 0;
            for (let idx in (desempenho[m] || {})) {
              acertos += desempenho[m][idx].acertos;
              erros += desempenho[m][idx].erros;
              total += desempenho[m][idx].total;
            }
            const porcentagem = total > 0 ? Math.round((acertos / total) * 100) : 0;
            return (
              <div className="dashboard-item" key={m} onClick={() => setMateriaDetalhada(m)}>
                <h4>{m.toUpperCase()}</h4>
                <p className={`porcentagem ${porcentagem >= 70 ? "bom" : "ruim"}`}>{porcentagem}%</p>
                <p className="stats">ACERTOS: {acertos} | ERROS: {erros} | TOTAL: {total}</p>
              </div>
            );
          })}
        </div>
      </section>
      {materiaDetalhada && (
        <section className="dashboard-detalhado">
          <div>
            <h2>{materiaDetalhada}</h2>

            {assuntos[materiaDetalhada]?.map((assunto, idx) => {

              const dados =
                desempenho[materiaDetalhada]?.[idx];

              const total =
                dados?.total || 0;

              const acertos =
                dados?.acertos || 0;

              const percentual =
                total > 0
                  ? Math.round((acertos / total) * 100)
                  : 0;

              return (
                <div
                  key={idx}
                  className="detalhe-assunto"
                >
                  <strong>{assunto}</strong>

                  <p>
                    {percentual}% ({acertos}/{total})
                  </p>
                </div>
              );
            })}

            <button
              className="btn"
              onClick={() =>
                setMateriaDetalhada(null)
              }
            >
              ✕ FECHAR
            </button>
          </div>
        </section>
      )}


      <section className="simulados-historico">
        <h2>▼ HISTÓRICO DE SIMULADOS ▼</h2>
        <div className="simulados-list">
          {simulados.length > 0 ? (
            simulados.map(s => (
              <div className="simulado-item" key={s.id}>
                <p className="sim-data">{new Date(s.data).toLocaleDateString("pt-BR")}</p>
                <p className="sim-nota">NOTA: {s.notaFinal} / 60</p>
                <p className={`sim-percent ${s.porcentagem >= 70 ? "bom" : "ruim"}`}>({s.porcentagem}%)</p>
                <p className="sim-info">BÁSICAS: {s.basicos} | ESPECÍFICAS: {s.especificos}</p>
              </div>
            ))
          ) : (
            <p className="sem-dados">NENHUM SIMULADO REGISTRADO.</p>
          )}
        </div>
      </section>

      <section className="redacoes-historico">
        <h2>▼ RELATÓRIO DE REDAÇÕES ▼</h2>
        <div className="redacoes-stats">
          <p>TOTAL DE REDAÇÕES CONCLUÍDAS:</p>
          <span className="redacoes-count">{redacoesFeitas}</span>
        </div>
      </section>

    </div>
  );
}
