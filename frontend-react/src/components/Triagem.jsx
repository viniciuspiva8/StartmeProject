// Triagem: responde, antes de qualquer outra coisa, "vale a pena eu abrir esta
// vaga?". Cada segmento do medidor é um ponto avaliado (requisito obrigatório
// ou condição da vaga): verde-água quando o currículo atende, âmbar quando é
// ressalva. A contagem e o veredito vêm sempre em texto. Nenhum número solto.
import { useApp } from '../state/AppContext.jsx';
import Icone from './Icone.jsx';

const TOM = {
  vale: { texto: 'text-agua-texto', icone: 'check' },
  ressalvas: { texto: 'text-ressalva', icone: 'alerta' },
  nao: { texto: 'text-tinta-3', icone: 'menos' },
  'sem-dados': { texto: 'text-tinta-3', icone: 'info' },
};

export function Medidor({ triagem, grande = false }) {
  const { criterios, estado } = triagem;
  const alt = grande ? 'h-2' : 'h-1.5';
  const larg = grande ? 'w-9' : 'w-5';

  if (estado === 'sem-dados') {
    return (
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <span key={i} className={`${alt} ${larg} rounded-full border border-dashed border-linha-forte`} />)}
      </span>
    );
  }
  // Atendidos primeiro, ressalvas depois: lê como uma barra de progresso.
  const ordenados = [...criterios].sort((a, b) => Number(b.positivo) - Number(a.positivo));
  return (
    <span className="flex gap-1" aria-hidden="true">
      {ordenados.map((c, i) => <span key={i} className={`${alt} ${larg} rounded-full transition-colors duration-300 ${c.positivo ? 'bg-agua' : 'bg-ressalva-barra'}`} />)}
    </span>
  );
}

function resumoTexto(t) {
  return t.estado === 'sem-dados'
    ? 'A coleta não trouxe os requisitos desta vaga'
    : `${t.atendidos} de ${t.total} pontos batem com o seu currículo`;
}

/** Versão compacta: lista de vagas e destaques do início. */
export function TriagemCompacta({ triagem, linhasRessalva = 1 }) {
  const tom = TOM[triagem.estado];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Medidor triagem={triagem} />
        <span className={`inline-flex items-center gap-1 text-[13px] font-bold ${tom.texto}`}>
          <Icone nome={tom.icone} size={15} />
          {triagem.veredito}
        </span>
        <span className="sr-only">. {resumoTexto(triagem)}.</span>
      </div>
      {triagem.principalRessalva && (
        <p className="flex items-start gap-1.5 text-[13px] text-tinta-3" title={triagem.principalRessalva}>
          <Icone nome="alerta" size={14} className="mt-[3px] text-ressalva-barra" />
          <span className={linhasRessalva > 1 ? 'line-clamp-2' : 'line-clamp-1'}><span className="sr-only">Ressalva: </span>{triagem.principalRessalva}</span>
        </p>
      )}
    </div>
  );
}

function Item({ c, vagaId }) {
  const { a } = useApp();
  const faltaNoCurriculo = c.tipo === 'requisito' && !c.positivo;
  return (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed text-tinta">
      <span className={`mt-0.5 grid size-5 flex-none place-items-center rounded-full ${c.positivo ? 'bg-agua text-white' : 'bg-ressalva-barra text-tinta'}`}>
        <Icone nome={c.positivo ? 'check' : 'alerta'} size={13} />
      </span>
      <span className="flex min-w-0 flex-col gap-2">
        <span><span className="sr-only">{c.positivo ? 'Atende: ' : 'Ressalva: '}</span>{c.texto}</span>
        {faltaNoCurriculo && (
          <span>
            <button type="button" onClick={() => a.abrirHabilidade({ nome: c.termo }, vagaId)} className="btn-claro min-h-9 rounded-lg px-3 text-[13px]">
              Eu sei {c.termo}
            </button>
          </span>
        )}
      </span>
    </li>
  );
}

/** Versão completa, no detalhe: veredito, cada ponto avaliado e de onde vem, diferenciais. */
export function TriagemCompleta({ triagem, vagaId }) {
  const { a } = useApp();
  const tom = TOM[triagem.estado];
  if (triagem.estado === 'sem-dados') {
    return (
      <section aria-labelledby="triagem-titulo" className="rounded-2xl border border-dashed border-linha-forte bg-white p-5">
        <h2 id="triagem-titulo" className="flex items-center gap-2 font-serif text-xl font-bold text-tinta">
          <Icone nome="info" size={22} className="text-tinta-3" /> Sem dados para avaliar
        </h2>
        <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-tinta-3">
          A coleta ainda não extraiu os requisitos deste anúncio, então o StartMe não consegue comparar com o seu currículo.
          Leia o anúncio original antes de decidir.
        </p>
      </section>
    );
  }
  const requisitos = triagem.criterios.filter((c) => c.tipo === 'requisito');
  const condicoes = triagem.criterios.filter((c) => c.tipo === 'condicao');

  return (
    <section aria-labelledby="triagem-titulo" className="rounded-2xl bg-nevoa p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div aria-live="polite">
          <h2 id="triagem-titulo" className={`flex items-center gap-2 font-serif text-2xl leading-tight font-bold ${tom.texto}`}>
            <Icone nome={tom.icone} size={24} />
            {triagem.veredito}
          </h2>
          <p className="mt-1 text-sm text-tinta-2">{resumoTexto(triagem)}.</p>
        </div>
        <Medidor triagem={triagem} grande />
      </div>

      {requisitos.length > 0 && (
        <>
          <h3 className="mt-5 text-[13px] font-bold text-tinta-2">Requisitos</h3>
          <ul className="mt-2 flex flex-col gap-3">{requisitos.map((c) => <Item key={c.texto} c={c} vagaId={vagaId} />)}</ul>
        </>
      )}
      {condicoes.length > 0 && (
        <>
          <h3 className="mt-5 text-[13px] font-bold text-tinta-2">Condições da vaga</h3>
          <ul className="mt-2 flex flex-col gap-3">{condicoes.map((c) => <Item key={c.texto} c={c} vagaId={vagaId} />)}</ul>
        </>
      )}
      {triagem.desejaveis.length > 0 && (
        <>
          <h3 className="mt-5 text-[13px] font-bold text-tinta-2">Diferenciais (não contam contra você)</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {triagem.desejaveis.map((d) => (d.positivo ? (
              <li key={d.termo} className="inline-flex min-h-8 items-center gap-1.5 rounded-pill bg-white px-3 text-[13px] font-semibold text-agua-texto">
                <Icone nome="check" size={14} />
                {d.termo}
                <span className="sr-only">: você tem</span>
              </li>
            ) : (
              <li key={d.termo}>
                <button
                  type="button"
                  onClick={() => a.abrirHabilidade({ nome: d.termo }, vagaId)}
                  aria-label={`${d.termo}: não está no seu currículo. Eu sei ${d.termo}`}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-pill border border-dashed border-linha-forte px-3 text-[13px] font-semibold text-tinta-3 hover:border-azul-500 hover:text-azul"
                >
                  {d.termo} <span aria-hidden="true">+</span>
                </button>
              </li>
            )))}
          </ul>
        </>
      )}

      <details className="group mt-5 text-[13px] text-tinta-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-azul-700 hover:underline">
          <Icone nome="abaixo" size={16} className="transition-transform group-open:rotate-180" />
          Como esta avaliação é feita
        </summary>
        <p className="mt-2 max-w-[62ch] leading-relaxed">
          Os requisitos do anúncio são comparados com o seu currículo no StartMe: as disciplinas cursadas até o semestre
          atual (vindas do Portal Acadêmico), suas certificações, atividades e as habilidades que você declarou.
          Requisitos obrigatórios e condições da vaga contam; com três quartos ou mais atendidos, a vaga vale o seu tempo,
          com metade, vale com ressalvas. Diferenciais aparecem, mas não pesam contra. Nesta versão, os requisitos das
          vagas e a grade do curso são de demonstração.
        </p>
      </details>
    </section>
  );
}
