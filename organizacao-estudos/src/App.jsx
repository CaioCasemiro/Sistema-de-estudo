import { useState, useEffect } from "react";
import { ciclo, assuntos, poolMissoesExtras } from "./dados.js";
import { db } from "./firebase";

const imagensDaPublicFolder = import.meta.glob("/public/*.{png,jpg,jpeg,webp,svg}", {
  eager: true,
  import: "default"
});

const caminhosImagensMetas = Object.keys(imagensDaPublicFolder)
  .map((caminho) => caminho.replace("/public", ""))
  .filter((caminho) => !["/favicon.svg", "/icons.svg"].includes(caminho));

const coresMaterias = {
  Português: { cor: "#4fd1c5", rgb: "79, 209, 197" },
  RLM: { cor: "#f59e0b", rgb: "245, 158, 11" },
  "Conhecimentos Regionais": { cor: "#38bdf8", rgb: "56, 189, 248" },
  "Conhecimentos Gerais": { cor: "#c084fc", rgb: "192, 132, 252" },
  Informática: { cor: "#34d399", rgb: "52, 211, 153" },
  "Direito Constitucional": { cor: "#f472b6", rgb: "244, 114, 182" },
  "Direito Administrativo": { cor: "#fb923c", rgb: "251, 146, 60" },
  "Direito Penal": { cor: "#f43f5e", rgb: "244, 63, 94" },
  "Legislação Especial": { cor: "#60a5fa", rgb: "96, 165, 250" },
  "Legislação Institucional": { cor: "#a3e635", rgb: "163, 230, 53" }
};

import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  getDocs,
  setDoc
} from "firebase/firestore";

export default function App() {
  const [acertosBasicos, setAcertosBasicos] = useState(0);
  const [acertosEspecificos, setAcertosEspecificos] = useState(0);
  const [redacoesFeitas, setRedacoesFeitas] = useState(0);
  const [fezRedacao, setFezRedacao] = useState(false);
  const [missoesExtras, setMissoesExtras] = useState([]);
  const [statusMissoes, setStatusMissoes] = useState({});
  const [desempenho, setDesempenho] = useState({});
  const [simulados, setSimulados] = useState([]);
  const [materiaDetalhada, setMateriaDetalhada] = useState(null);
  const [registroConteudos, setRegistroConteudos] = useState({});
  const [fotoMetas, setFotoMetas] = useState(caminhosImagensMetas[0] || "");

  const diaHoje = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][new Date().getDay()];

  useEffect(() => {
    async function carregar() {
      try {
        const d = await getDoc(doc(db, "desempenho", "materias"));
        if (d.exists()) setDesempenho(d.data());

        const q = query(collection(db, "simulados"));
        const querySnapshot = await getDocs(q);
        const sims = [];
        querySnapshot.forEach((documento) => sims.push({ id: documento.id, ...documento.data() }));
        setSimulados(sims.sort((a, b) => new Date(b.data) - new Date(a.data)));

        const redacoesDoc = await getDoc(doc(db, "redacoes", "contador"));
        if (redacoesDoc.exists()) setRedacoesFeitas(redacoesDoc.data().total);

        const hoje = new Date().toISOString().split("T")[0];
        const missaoDoc = await getDoc(doc(db, "missoesDiarias", hoje));

        if (missaoDoc.exists()) {
          setMissoesExtras(missaoDoc.data().missoes);
        }
      } catch (e) {
        console.error(e);
      }
    }
    carregar();
  }, []);


  useEffect(() => {
    if (missoesExtras.length === 0) {
      async function carregarMissoesDoDia() {
        const hoje = new Date().toISOString().split("T")[0];
        const missaoDoc = await getDoc(doc(db, "missoesDiarias", hoje));

        if (missaoDoc.exists()) {
          setMissoesExtras(missaoDoc.data().missoes);
          return;
        }

        const missoes = [];

        while (missoes.length < 2) {
          const aleatoria = poolMissoesExtras[Math.floor(Math.random() * poolMissoesExtras.length)];

          if (!missoes.includes(aleatoria)) {
            missoes.push(aleatoria);
          }
        }

        await setDoc(doc(db, "missoesDiarias", hoje), {
          data: hoje,
          missoes
        });

        setMissoesExtras(missoes);
      }

      carregarMissoesDoDia();
    }
  }, [missoesExtras]);

  function handleConteudoChange(materia, index, campo, valor) {
    const chave = `${materia}-${index}`;
    setRegistroConteudos((prev) => ({
      ...prev,
      [chave]: {
        ...(prev[chave] || {}),
        [campo]: Number.parseInt(valor, 10) || 0
      }
    }));
  }

  async function salvarConteudo(materia, index, dados) {
    const acertos = Number(dados?.acertos || 0);
    const erros = Number(dados?.erros || 0);

    if (acertos < 0 || erros < 0) {
      alert("Valores inválidos. Use números maiores ou iguais a zero.");
      return;
    }

    const atual = desempenho[materia]?.[index] || { acertos: 0, erros: 0, total: 0 };
    const atualizado = {
      acertos: atual.acertos + acertos,
      erros: atual.erros + erros,
      total: atual.total + acertos + erros
    };

    const novoDesempenho = {
      ...desempenho,
      [materia]: {
        ...(desempenho[materia] || {}),
        [index]: atualizado
      }
    };

    setDesempenho(novoDesempenho);

    await setDoc(
      doc(db, "desempenho", "materias"),
      {
        [materia]: {
          ...(novoDesempenho[materia] || {}),
          [index]: atualizado
        }
      },
      { merge: true }
    );

    setRegistroConteudos((prev) => ({
      ...prev,
      [`${materia}-${index}`]: { acertos: 0, erros: 0 }
    }));

    alert("Salvo!");
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

  function verificarMediaSimulado(basicos, especificos) {
    const percentualBasicos = (basicos / 20) * 100;
    const percentualEspecificos = (especificos / 20) * 100;
    const notaFinal = (basicos * 1) + (especificos * 2);
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

  return (
    <div className="container">
      <header className="header">
        <h1>PÓS-EDITAL: {diaHoje.toUpperCase()}</h1>
        <p>{new Date().toLocaleDateString("pt-BR")}</p>
      </header>

      <section className="mural-metas">
        <h2>▼ MURAL DE METAS ▼</h2>
        <div className="mural-content">

          {fotoMetas ? (
            <img className="mural-foto" src={fotoMetas} alt="Programa de metas" />
          ) : (
            <div className="mural-placeholder">
              Ainda não há imagem disponível. Adicione um arquivo na pasta public/ do projeto para exibi-la aqui.
            </div>
          )}
        </div>
      </section>

      <section className="registro-conteudos">
        <h2>▼ LISTA DE MATÉRIAS E CONTEÚDOS ▼</h2>
        <div className="conteudos-list">
          {ciclo
            .filter((materia) => materia !== "Redação" && materia !== "Simulado")
            .map((materia) => {
              const corMateria = coresMaterias[materia] || { cor: "var(--accent-ouro)", rgb: "212, 175, 55" };

              return (
                <div
                  className="materia-bloco"
                  key={materia}
                  style={{
                    "--materia-accent": corMateria.cor,
                    "--materia-accent-rgb": corMateria.rgb
                  }}
                >
                  <div className="materia-header">
                    <h3>{materia.toUpperCase()}</h3>
                    <span>{assuntos[materia]?.length || 0} CONTEÚDOS</span>
                  </div>

                  <div className="conteudos-rows">
                    {assuntos[materia]?.map((assunto, index) => {
                      const chave = `${materia}-${index}`;
                      const dadosAtuais = desempenho[materia]?.[index];
                      const total = dadosAtuais?.total || 0;
                      const acertos = dadosAtuais?.acertos || 0;
                      const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;
                      const valores = registroConteudos[chave] || { acertos: 0, erros: 0 };

                      return (
                        <div className="conteudo-row" key={chave}>
                          <div className="conteudo-info">
                            <strong>{assunto}</strong>
                            <span>{percentual}% ({acertos}/{total})</span>
                          </div>

                          <div className="conteudo-inputs">
                            <label className="input-field">
                              <span>ACERTOS</span>
                              <input
                                type="number"
                                min="0"
                                value={valores.acertos}
                                onChange={(e) => handleConteudoChange(materia, index, "acertos", e.target.value)}
                              />
                            </label>
                            <label className="input-field">
                              <span>ERROS</span>
                              <input
                                type="number"
                                min="0"
                                value={valores.erros}
                                onChange={(e) => handleConteudoChange(materia, index, "erros", e.target.value)}
                              />
                            </label>
                          </div>

                          <button className="btn-conteudo" onClick={() => salvarConteudo(materia, index, valores)}>
                            SALVAR
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      <div className="metas-wrapper">
        <div className="card simulado">
          <span className="badge">SIMULADO</span>

          <h3 className="materia">SIMULADO GERAL</h3>

          <div className="simulado-inputs">
            <div className="input-group">
              <label>ACERTOS BÁSICAS (0-20)</label>
              <input
                type="number"
                value={acertosBasicos}
                onChange={(e) => setAcertosBasicos(parseInt(e.target.value) || 0)}
                min="0"
                max="20"
              />
            </div>
            <div className="input-group">
              <label>ACERTOS ESPECÍFICAS (0-20)</label>
              <input
                type="number"
                value={acertosEspecificos}
                onChange={(e) => setAcertosEspecificos(parseInt(e.target.value) || 0)}
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

        <div className="card redacao">
          <span className="badge">REDAÇÃO</span>
          <h3 className="materia">REDAÇÃO</h3>
          <div className="checkbox">
            <input
              type="checkbox"
              id="redacao-fez"
              checked={fezRedacao}
              onChange={() => setFezRedacao(!fezRedacao)}
            />
            <label htmlFor="redacao-fez">CONCLUÍ A REDAÇÃO</label>
          </div>
          <button className="btn" onClick={salvarRedacao} disabled={!fezRedacao}>
            REGISTRAR REDAÇÃO ▶
          </button>
        </div>
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
            simulados.map(s => {
              const media = verificarMediaSimulado(s.basicos, s.especificos);
              return (
                <div className={`simulado-item ${media.aprovado ? "aprovado" : "reprovado"}`} key={s.id}>
                  <p className="sim-data">{new Date(s.data).toLocaleDateString("pt-BR")}</p>
                  <p className="sim-nota">NOTA: {s.notaFinal} / 60</p>
                  <p className={`sim-percent ${s.porcentagem >= 70 ? "bom" : "ruim"}`}>({s.porcentagem}%)</p>
                  <p className="sim-info">BÁSICAS: {s.basicos} | ESPECÍFICAS: {s.especificos}</p>
                  
                  <div className="media-simulado">
                    <div className={`check-media ${media.atingiuBasicos ? "ok" : "nao-ok"}`}>
                      Básicas: {media.percentualBasicos}% {media.atingiuBasicos ? "✓" : "✗"}
                    </div>
                    <div className={`check-media ${media.atingiuEspecificos ? "ok" : "nao-ok"}`}>
                      Específicas: {media.percentualEspecificos}% {media.atingiuEspecificos ? "✓" : "✗"}
                    </div>
                    <div className={`check-media ${media.atingiuGeral ? "ok" : "nao-ok"}`}>
                      Geral: {media.percentualGeral}% {media.atingiuGeral ? "✓" : "✗"}
                    </div>
                    <div className={`resultado-simulado ${media.aprovado ? "aprovado" : "reprovado"}`}>
                      {media.aprovado ? "✓ DENTRO DAS MÉDIAS" : "✗ ABAIXO DA MÉDIA"}
                    </div>
                  </div>
                </div>
              );
            })
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
