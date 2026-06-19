import { useState, useEffect } from "react";
import { ciclo, assuntos, pesosDisciplinas, cronogramaSemanal, metasRevisao } from "./dados";
import { db } from "./firebase";
import { doc, getDoc, updateDoc, collection, addDoc, query, getDocs } from "firebase/firestore";

export default function App() {
  const [progresso, setProgresso] = useState({});
  const [desempenho, setDesempenho] = useState({});
  const [revisoes, setRevisoes] = useState({});
  const [metasHoje, setMetasHoje] = useState([]);
  const [dadosMetas, setDadosMetas] = useState({});
  const [simulados, setSimulados] = useState([]);
  const [acertosSimulado, setAcertosSimulado] = useState(0);

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
  }, [diaHoje, revisoes, progresso]);

  async function salvar(i, dados) {
    const meta = metasHoje[i];
    const idx = meta.tipo === "revisao" ? meta.assuntoIndex : (progresso[meta.materia] || 0);

    if (meta.tipo === "nova") {
      await updateDoc(doc(db, "progresso", "materias"), { [meta.materia]: idx + 1 });
    }

    if (pesosDisciplinas[meta.materia].tipoEstudo === "questoes") {
      const des = desempenho[meta.materia]?.[idx] || { acertos: 0, erros: 0, total: 0 };
      await updateDoc(doc(db, "desempenho", "materias"), {
        [`${meta.materia}.${idx}`]: {
          acertos: des.acertos + dados.acertos,
          erros: des.erros + dados.erros,
          total: des.total + dados.acertos + dados.erros
        }
      }, { merge: true });
    }

    const revAtu = revisoes[meta.materia]?.[idx] || { questoesRevisao: 0 };
    const novasQ = meta.tipo === "nova" ? 0 : revAtu.questoesRevisao + (dados.acertos + dados.erros);
    await updateDoc(doc(db, "revisoes", "materias"), { 
      [`${meta.materia}.${idx}`]: { questoesRevisao: novasQ, last: new Date().toISOString() } 
    }, { merge: true });

    alert("Salvo!"); window.location.reload();
  }

  async function salvarSimulado() {
    if (acertosSimulado < 0 || acertosSimulado > 40) { alert("0 a 40!"); return; }
    await addDoc(collection(db, "simulados"), { acertos: acertosSimulado, total: 40, porcentagem: Math.round((acertosSimulado/40)*100), data: new Date().toISOString() });
    alert("Simulado salvo!"); window.location.reload();
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
          if (m.materia === "Simulado") return (
            <div className="card simulado" key={i}>
              <span className="badge">SIMULADO</span>
              <h2>{m.materia}</h2>
              <div className="simulado-input">
                <input type="number" value={acertosSimulado} onChange={e => setAcertosSimulado(parseInt(e.target.value))} />
                <p>{Math.round((acertosSimulado/40)*100)}%</p>
              </div>
              <button className="btn" onClick={salvarSimulado}>Salvar Simulado</button>
            </div>
          );

          return (
            <div className={`card ${m.tipo}`} key={i}>
              <span className="badge">{m.tipo === "revisao" ? "REVISÃO" : "NOVO"}</span>
              <h2>{m.materia}</h2>
              <p className="assunto">{m.tipo === "revisao" ? m.assunto : assuntos[m.materia]?.[idx]}</p>
              <div className="inputs">
                <input type="number" placeholder="Acertos" onChange={e => setDadosMetas({...dadosMetas, [i]: {...dadosMetas[i], acertos: parseInt(e.target.value)||0}})} />
                <input type="number" placeholder="Erros" onChange={e => setDadosMetas({...dadosMetas, [i]: {...dadosMetas[i], erros: parseInt(e.target.value)||0}})} />
              </div>
              <button className="btn" onClick={() => salvar(i, dadosMetas[i])}>Salvar</button>
            </div>
          );
        })}
      </div>

      <section className="dashboard">
        <h2>Desempenho por Matéria</h2>
        <div className="dashboard-grid">
          {ciclo.map(m => {
            let a=0, e=0, t=0;
            for(let idx in desempenho[m]) { a+=desempenho[m][idx].acertos; e+=desempenho[m][idx].erros; t+=desempenho[m][idx].total; }
            const p = t>0 ? Math.round((a/t)*100) : 0;
            return <div className="dashboard-item" key={m}><h4>{m}</h4><p>{p}% ({a}/{t})</p></div>;
          })}
        </div>
      </section>

      <section className="simulados-historico">
        <h2>Últimos Simulados</h2>
        <div className="simulados-list">
          {simulados.map(s => <div className="simulado-item" key={s.id}>{new Date(s.data).toLocaleDateString()} - <b>{s.acertos}/40</b> ({s.porcentagem}%)</div>)}
        </div>
      </section>
    </div>
  );
}
