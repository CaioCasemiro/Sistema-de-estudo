import { useState, useEffect } from "react";
import { ciclo, assuntos, pesosDisciplinas, cronogramaSemanal, metasRevisao } from "./dados";
import { db } from "./firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function App( ) {
  const [progresso, setProgresso] = useState({});
  const [desempenho, setDesempenho] = useState({});
  const [revisoes, setRevisoes] = useState({});
  const [metasHoje, setMetasHoje] = useState([]);
  const [dadosMetas, setDadosMetas] = useState({});

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
      } catch (e) {
        console.error(e);
      }
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
          metas.unshift({
            tipo: "revisao",
            materia: m,
            assuntoIndex: parseInt(idx),
            assunto: assuntos[m][idx],
            feitas: rev.questoesRevisao || 0
          });
        }
      }
    }
    materias.forEach(m => metas.push({ tipo: "nova", materia: m }));
    setMetasHoje(metas);
    const inicial = {};
    metas.forEach((m, i) => (inicial[i] = { estudado: false, acertos: 0, erros: 0 }));
    setDadosMetas(inicial);
  }, [diaHoje, revisoes, progresso]);

  async function salvar(i, dados) {
    const meta = metasHoje[i];
    const idx = meta.tipo === "revisao" ? meta.assuntoIndex : (progresso[meta.materia] || 0);

    if (meta.tipo === "nova") {
      await updateDoc(doc(db, "progresso", "materias"), { [meta.materia]: idx + 1 });
    }

    const tipo = pesosDisciplinas[meta.materia].tipoEstudo;
    if (tipo === "questoes") {
      const des = desempenho[meta.materia]?.[idx] || { acertos: 0, erros: 0, total: 0 };
      await updateDoc(
        doc(db, "desempenho", "materias"),
        {
          [`${meta.materia}.${idx}`]: {
            acertos: des.acertos + dados.acertos,
            erros: des.erros + dados.erros,
            total: des.total + dados.acertos + dados.erros
          }
        },
        { merge: true }
      );
    }

    const revAtu = revisoes[meta.materia]?.[idx] || { questoesRevisao: 0 };
    const novasQ = meta.tipo === "nova" ? 0 : revAtu.questoesRevisao + (dados.acertos + dados.erros);
    await updateDoc(
      doc(db, "revisoes", "materias"),
      { [`${meta.materia}.${idx}`]: { questoesRevisao: novasQ, last: new Date().toISOString() } },
      { merge: true }
    );

    alert("Salvo!");
    window.location.reload();
  }

  function calcularMeta(materia, idx) {
    const des = desempenho[materia]?.[idx];
    if (!des) return 0;
    return des.total || 0;
  }

  function calcularPorcentagem(materia, idx) {
    const des = desempenho[materia]?.[idx];
    if (!des || des.total === 0) return 0;
    return Math.round((des.acertos / des.total) * 100);
  }

  return (
    <div className="container">
      <header className="header">
        <h1>{diaHoje.toUpperCase()}</h1>
        <p>{new Date().toLocaleDateString("pt-BR")}</p>
      </header>

      <div className="metas-wrapper">
        {metasHoje.map((m, i) => {
          const idx = m.tipo === "revisao" ? m.assuntoIndex : (progresso[m.materia] || 0);
          const metaQuestoes = pesosDisciplinas[m.materia].metaQuestoes;
          const questoesFeitas = calcularMeta(m.materia, idx);
          const porcentagem = calcularPorcentagem(m.materia, idx);

          return (
            <div className={`card ${m.tipo}`} key={i}>
              <div className="card-header">
                <span className="badge">{m.tipo === "revisao" ? "REVISÃO" : "NOVO"}</span>
                <h2>{m.materia}</h2>
              </div>

              <p className="assunto">{m.tipo === "revisao" ? m.assunto : assuntos[m.materia]?.[idx]}</p>

              {m.tipo === "revisao" && (
                <p className="progress-revisao">Revisão: {m.feitas} / {metasRevisao.questoesPorRevisao} questões</p>
              )}

              {pesosDisciplinas[m.materia].tipoEstudo === "questoes" && (
                <div className="meta-questoes">
                  <p>Meta: {questoesFeitas} / {metaQuestoes} questões</p>
                  <div className="meta-bar">
                    <div className="meta-fill" style={{ width: `${Math.min((questoesFeitas / metaQuestoes) * 100, 100)}%` }}></div>
                  </div>
                  <p className="porcentagem">Acertos: {porcentagem}%</p>
                </div>
              )}

              <label className="checkbox">
                <input
                  type="checkbox"
                  onChange={e => setDadosMetas({ ...dadosMetas, [i]: { ...dadosMetas[i], estudado: e.target.checked } })}
                />
                <span>Concluí</span>
              </label>

              {pesosDisciplinas[m.materia].tipoEstudo === "questoes" && (
                <div className="inputs">
                  <input
                    type="number"
                    placeholder="Acertos"
                    onChange={e => setDadosMetas({ ...dadosMetas, [i]: { ...dadosMetas[i], acertos: parseInt(e.target.value) || 0 } })}
                  />
                  <input
                    type="number"
                    placeholder="Erros"
                    onChange={e => setDadosMetas({ ...dadosMetas, [i]: { ...dadosMetas[i], erros: parseInt(e.target.value) || 0 } })}
                  />
                </div>
              )}

              <button className="btn" disabled={!dadosMetas[i]?.estudado} onClick={() => salvar(i, dadosMetas[i])}>
                Salvar
              </button>
            </div>
          );
        })}
      </div>

      <section className="dashboard">
        <h2>Dashboard de Desempenho</h2>
        <div className="dashboard-grid">
          {ciclo.map(materia => {
            let totalAcertos = 0,
              totalErros = 0,
              totalQuestoes = 0;
            const desMateria = desempenho[materia] || {};
            for (const idx in desMateria) {
              totalAcertos += desMateria[idx].acertos || 0;
              totalErros += desMateria[idx].erros || 0;
              totalQuestoes += desMateria[idx].total || 0;
            }
            const porcentagem = totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : 0;

            return (
              <div className="dashboard-item" key={materia}>
                <h4>{materia}</h4>
                <p className="stats">
                  {totalAcertos} acertos | {totalErros} erros | {totalQuestoes} questões
                </p>
                <p className={`porcentagem ${porcentagem >= 70 ? "bom" : "ruim"}`}>{porcentagem}%</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
