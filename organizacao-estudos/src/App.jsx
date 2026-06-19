import { useState, useEffect } from "react";
import { ciclo, assuntos } from "./dados";
import { db } from "./firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";


export default function App() {

  const [indiceCiclo, setIndiceCiclo] = useState(0);
  const [progresso, setProgresso] = useState({});
  const [estudado, setEstudado] = useState({});

  const materiaAtual = ciclo[indiceCiclo];

  const indiceAtual =
    progresso[materiaAtual] || 0;

  const assuntoAtual =
    assuntos[materiaAtual]?.[indiceAtual] ||
    "Nenhum assunto cadastrado";

  useEffect(() => {

    async function carregarProgresso() {

      try {

        const referencia = doc(
          db,
          "progresso",
          "materias"
        );

        const documento =
          await getDoc(referencia);

        if (documento.exists()) {

          setProgresso(
            documento.data()
          );

        }

      } catch (erro) {

        console.error(erro);

      }

    }

    carregarProgresso();

  }, []);

  async function avancarAssunto(materia) {

    const totalAssuntos =
      assuntos[materia]?.length || 1;

    const novoIndice =
      ((progresso[materia] || 0) + 1) %
      totalAssuntos;

    try {

      const referencia = doc(
        db,
        "progresso",
        "materias"
      );

      await updateDoc(
        referencia,
        {
          [materia]: novoIndice
        }
      );

      setProgresso(
        (anterior) => ({
          ...anterior,
          [materia]: novoIndice
        })
      );

      setIndiceCiclo(
        (anterior) =>
          (anterior + 1) % ciclo.length
      );

    } catch (erro) {

      console.error(erro);

    }

  }

  return (
  <div className="container">

    <h1>HOJE</h1>

    <div className="materias-container">

      <div className="materia-card">

        <h2>{materiaAtual}</h2>

        <p className="assunto">
          {assuntoAtual}
        </p>

        <label className="checkbox-container">

          <input
            className="checkbox"
            type="checkbox"
            checked={estudado[materiaAtual] || false}
            onChange={(e) => {

              setEstudado((anterior) => ({
                ...anterior,
                [materiaAtual]: e.target.checked
              }));

            }}
          />

          <span>Estudei</span>

        </label>

        <button
          className="btn-proximo"
          disabled={!estudado[materiaAtual]}
          onClick={async () => {

            await avancarAssunto(materiaAtual);

            setEstudado((anterior) => ({
              ...anterior,
              [materiaAtual]: false
            }));

          }}
        >
          Próximo assunto
        </button>

      </div>

    </div>

  </div>
);
}