import { useState, useEffect } from "react";
import { semana, assuntos } from "./dados";
import { supabase } from "./supabase";

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

      const { data, error } =
        await supabase
          .from("progresso")
          .select("*");

      if (error) {
        console.error(error);
        return;
      }

      const progressoBanco = {};

      data.forEach((item) => {
        progressoBanco[item.materia] =
          item.indice_atual;
      });

      setProgresso(progressoBanco);

    }

    carregarProgresso();

  }, []);

  async function avancarAssunto(materia) {

    const totalAssuntos =
      assuntos[materia]?.length || 1;

    const novoIndice =
      ((progresso[materia] || 0) + 1) %
      totalAssuntos;

    const { error } = await supabase
      .from("progresso")
      .update({
        indice_atual: novoIndice
      })
      .eq("materia", materia);

    if (error) {
      console.error(error);
      return;
    }

    setProgresso((anterior) => ({
      ...anterior,
      [materia]: novoIndice
    }));

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