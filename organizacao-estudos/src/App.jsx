import { useState, useEffect } from "react";
import { ciclo, assuntos, pesosDisciplinas, cronogramaSemanal, metasRevisao } from "./dados";
import { db } from "./firebase";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  addDoc,
  query,
  getDocs
} from "firebase/firestore";

export default function App() {
  const [acertosBasicos, setAcertosBasicos] = useState(0);
  const [acertosEspecificos, setAcertosEspecificos] = useState(0);

  const [redacoes, setRedacoes] = useState([]);
  const [fezRedacao, setFezRedacao] = useState(false);
  const [questoes, setQuestoes] = useState({});
  const [missoesExtras, setMissoesExtras] = useState([]);
  const [statusMissoes, setStatusMissoes] = useState({});
  const [progresso, setProgresso] = useState({});
  const [desempenho, setDesempenho] = useState({});
  const [revisoes, setRevisoes] = useState({});
  const [metasHoje, setMetasHoje] = useState([]);
  const [dadosMetas, setDadosMetas] = useState({});
  const [simulados, setSimulados] = useState([]);
  const [acertosSimulado, setAcertosSimulado] = useState(0);
  const bancoMissoes = [
    "10 questões - Interpretação de textos",
    "10 questões - Fonologia e acentuação gráfica",
    "10 questões - Pontuação",
    "10 questões - Art 5 da Constituição",
    "10 questões - Art 37 da Constituição",
    "10 questões - Art 144 da Constituição",
    "10 questões - Princípios do Direito Penal",
    "10 questões - Crimes contra o patrimônio",
    "10 questões - Lei Maria da Penha",
    "10 questões - JECRIM",
    "10 questões - Lei de Abuso de Autoridade",
    "10 questões - Lei Orgânica Nacional das PMs",
    "10 questões - Estatuto dos Policiais Militares",
    "Leitura - Art 5 da CF",
    "Leitura - Art 37 da CF",
    "Leitura - Art 144 da CF",
    "Leitura - Lei Maria da Penha",
    "Leitura - Lei Orgânica Nacional das PMs",
    "Leitura - Código de Ética PMPI",
    "Revisar último assunto estudado",
    "Revisar penúltimo assunto estudado",
    "Resolver questões erradas anteriormente",
    "15 minutos de PDF da matéria do dia",
    "20 minutos de lei seca",
    "Flashcards da matéria do dia",
    "Mapa mental da matéria do dia",
    "20 questões extras da matéria do dia"
  ];

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
      } catch (e) { console.error(e); }
    }
    carregar();
  }, []);

  useEffect(() => {
    const materias = cronogramaSemanal[diaHoje] || [];
    const metas = [];
    for (const m in revisoes) {
      for (const idx in revisoes[m]) {
        const rev = revisoes[m][idx];
        if (rev.questoesRevisao < metasRevisao.questoesPorRevisao) {
          metas.unshift({ tipo: "revisao", materia: m, assuntoIndex: parseInt(idx), assunto: assuntos[m][idx], feitas: rev.questoesRevisao || 0 });
        }
      }
    }
    materias.forEach(m => metas.push({ tipo: "nova", materia: m }));
    setMetasHoje(metas);
    const inicial = {};
    metas.forEach((m, i) => (inicial[i] = { estudado: false, acertos: 0, erros: 0 }));
    setDadosMetas(inicial);
    const missoes = [];

    while (missoes.length < 2) {
      const aleatoria =
        bancoMissoes[Math.floor(Math.random() * bancoMissoes.length)];

      if (!missoes.includes(aleatoria)) {
        missoes.push(aleatoria);
      }
    }

    setMissoesExtras(missoes);
  }, [diaHoje, revisoes, progresso]);

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

          revisao24h:
            revAtu.revisao24h ||
            adicionarDias(agora, 1),

          revisao7d:
            revAtu.revisao7d ||
            adicionarDias(agora, 7),

          revisao30d:
            revAtu.revisao30d ||
            adicionarDias(agora, 30),

          concluido24h:
            revAtu.concluido24h || false,

          concluido7d:
            revAtu.concluido7d || false,

          concluido30d:
            revAtu.concluido30d || false,

          last: agora.toISOString()

        }

      }

    },
    { merge: true }
  );

  alert("Salvo!");

  window.location.reload();

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

    await addDoc(collection(db, "simulados"), {
      basicos: acertosBasicos,
      especificos: acertosEspecificos,
      notaFinal,
      porcentagem,
      data: new Date().toISOString()
    });

    alert("Simulado salvo!");
    window.location.reload();
  }

  async function salvarRedacao() {

    await addDoc(collection(db, "redacoes"), {
      fez: fezRedacao,
      data: new Date().toISOString()
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

        <h1>Pós-edital: {diaHoje.toUpperCase()}</h1>
        <h2>{new Date().toLocaleDateString("pt-BR")}</h2>
      </header>

      <div className="metas-wrapper">
        {metasHoje.map((m, i) => {
          const idx = m.tipo === "revisao" ? m.assuntoIndex : (progresso[m.materia] || 0);
          if (m.materia === "Simulado") return (
            <div className="card simulado" key={i}>
              <span className="badge">SIMULADO</span>

              <h2>Simulado</h2>

              <div className="simulado-input">

                <p>Acertos Básicos (0-20)</p>

                <input
                  type="number"
                  value={acertosBasicos}
                  onChange={(e) =>
                    setAcertosBasicos(parseInt(e.target.value) || 0)
                  }
                />

                <p>Acertos Específicos (0-20)</p>

                <input
                  type="number"
                  value={acertosEspecificos}
                  onChange={(e) =>
                    setAcertosEspecificos(parseInt(e.target.value) || 0)
                  }
                />

                <h3>
                  Nota:
                  {(acertosBasicos * 1) +
                    (acertosEspecificos * 2)}
                  / 60
                </h3>

              </div>

              <button
                className="btn"
                onClick={salvarSimulado}
              >
                Salvar Simulado
              </button>

            </div>
          );

          if (m.materia === "Redação") {
            return (
              <div className="card" key={i}>
                <span className="badge">REDAÇÃO</span>

                <h2>Redação</h2>

                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={fezRedacao}
                    onChange={(e) =>
                      setFezRedacao(e.target.checked)
                    }
                  />
                  <span>Fiz a redação</span>
                </label>

                <button
                  className="btn"
                  onClick={salvarRedacao}
                >
                  Salvar
                </button>
              </div>
            );
          }

          return (
            <div className={`card ${m.tipo}`} key={i}>
              <span className="badge">{m.tipo === "revisao" ? "REVISÃO" : "NOVO"}</span>
              <h2>{m.materia}</h2>
              <p className="assunto">{m.tipo === "revisao" ? m.assunto : assuntos[m.materia]?.[idx]}</p>
              <div className="inputs">
                <input type="number" placeholder="Acertos" onChange={e => setDadosMetas({ ...dadosMetas, [i]: { ...dadosMetas[i], acertos: parseInt(e.target.value) || 0 } })} />
                <input type="number" placeholder="Erros" onChange={e => setDadosMetas({ ...dadosMetas, [i]: { ...dadosMetas[i], erros: parseInt(e.target.value) || 0 } })} />
              </div>
              <button className="btn" onClick={() => salvar(i, dadosMetas[i])}>Salvar</button>
            </div>
          );
        })}
      </div>

      <section className="dashboard">

        <h2>Missões Extras</h2>


        <div className="dashboard-grid">

          {missoesExtras.map((missao, idx) => (

            <div
              key={idx}
              className="missao-card"
            >

              <h4>MISSÃO {idx + 1}</h4>

              <p>
                {missao}
              </p>


              <label className="checkbox">

                <input
                  type="checkbox"

                  checked={
                    statusMissoes[idx] === true
                  }

                  onChange={(e) => {

                    setStatusMissoes({

                      ...statusMissoes,

                      [idx]: e.target.checked

                    })

                  }}

                />

                <span>
                  Consegui
                </span>

              </label>


              <button
                className="btn"

                onClick={() => salvarMissao(idx)}

              >

                Registrar

              </button>


            </div>

          ))}

        </div>


      </section>


      <section className="dashboard">
        <h2>Desempenho por Matéria</h2>
        <div className="dashboard-grid">
          {ciclo.map(m => {
            let a = 0, e = 0, t = 0;
            for (let idx in (desempenho[m] || {})) { a += desempenho[m][idx].acertos; e += desempenho[m][idx].erros; t += desempenho[m][idx].total; }
            const p = t > 0 ? Math.round((a / t) * 100) : 0;
            return <div className="dashboard-item" key={m}><h4>{m}</h4><p>{p}% ({a}/{t})</p></div>;
          })}
        </div>
      </section>

      <section className="simulados-historico">
        <h2>Últimos Simulados</h2>
        <div className="simulados-list">
          {simulados.map(s => <div className="simulado-item" key={s.id}>{new Date(s.data).toLocaleDateString()} - <b>{s.notaFinal}/60</b> ({s.porcentagem}%)</div>)}
        </div>
      </section>
    </div>
  );
}
