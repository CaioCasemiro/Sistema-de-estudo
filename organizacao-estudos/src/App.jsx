import { useState, useEffect } from "react";
import { semana, assuntos } from "./dados";
import { db } from "./firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";


export default function App() {

  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [progresso, setProgresso] = useState({});
  const [estudado, setEstudado] = useState({});

  const dias = [
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado"
  ];

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

    } catch (erro) {

      console.error(erro);

    }

  }

  return (
    <div className="container">

      {!diaSelecionado ? (

        <>
          <h1>Organização de Estudos</h1>

          <div className="dias">

            {dias.map((dia) => (
              <div
                key={dia}
                className="card-dia"
                onClick={() => setDiaSelecionado(dia)}
              >
                {dia.toUpperCase()}
              </div>
            ))}

          </div>
        </>

      ) : (

        <>
          <button
            className="btn-voltar"
            onClick={() => setDiaSelecionado(null)}
          >
            ← Voltar
          </button>

          <h1>{diaSelecionado.toUpperCase()}</h1>

          <div className="materias-container">

            {semana[diaSelecionado].map((materia) => {

              const indiceAtual =
                progresso[materia] || 0;

              const assuntoAtual =
                assuntos[materia]?.[indiceAtual] ||
                "Nenhum assunto cadastrado";

              return (

                <div
                  key={materia}
                  className="materia-card"
                >

                  <h2>{materia}</h2>

                  <p className="assunto">
                    {assuntoAtual}
                  </p>

                  <label className="checkbox-container">

                    <input
                      className="checkbox"
                      type="checkbox"
                      checked={estudado[materia] || false}
                      onChange={(e) => {

                        setEstudado((anterior) => ({
                          ...anterior,
                          [materia]: e.target.checked
                        }));

                      }}
                    />

                    <span>Estudei</span>

                  </label>

                  <button
                    className="btn-proximo"
                    disabled={!estudado[materia]}
                    onClick={async () => {

                      await avancarAssunto(materia);

                      setEstudado((anterior) => ({
                        ...anterior,
                        [materia]: false
                      }));

                    }}
                  >
                    Próximo assunto
                  </button>

                </div>

              );

            })}

          </div>

        </>

      )}

    </div>
  );
}