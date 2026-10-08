// Item de vaga na lista e nos destaques do início.
// Ordem de leitura pensada para a decisão rápida: o que é a vaga → vale a pena? →
// por que não? → quanto paga, onde e desde quando. O item inteiro é clicável
// (padrão "stretched button"); o marcador de salvar fica acima dele.
import { useApp } from '../state/AppContext.jsx';
import Icone from './Icone.jsx';
import { TriagemCompacta } from './Triagem.jsx';

export default function VagaCard({ v, selecionada = false, variante = 'lista' }) {
  const { a } = useApp();
  const ehLista = variante === 'lista';

  return (
    <article
      className={[
        'group relative flex gap-3.5 transition-colors',
        ehLista ? 'border-b border-linha px-4 py-4 sm:px-5' : 'h-full rounded-2xl border border-linha bg-white p-5 shadow-painel',
        selecionada ? 'bg-nevoa' : 'bg-white hover:bg-papel',
      ].join(' ')}
    >
      {ehLista && (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-1 rounded-r-full transition-colors ${selecionada ? 'bg-azul' : 'bg-transparent'}`}
        />
      )}
      <Monograma letra={v.monograma} />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="pr-9">
          <h3 className="line-clamp-2 text-[15px] leading-snug font-bold text-tinta">
            <button
              type="button"
              onClick={() => a.abrirVaga(v.id)}
              aria-current={selecionada ? 'true' : undefined}
              className="text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-has-[:focus-visible]:after:rounded-xl group-has-[:focus-visible]:after:outline-3 group-has-[:focus-visible]:after:outline-azul-300"
            >
              {v.titulo}
            </button>
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-tinta-3">{v.empresa}</p>
        </div>

        <TriagemCompacta triagem={v.triagem} />

        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-tinta-2">
          <span className={`inline-flex items-center gap-1.5 ${v.salarioTxt ? 'font-semibold text-tinta' : 'text-tinta-3'}`}>
            <Icone nome="dinheiro" size={16} className="text-tinta-4" />
            {v.salarioTxt ?? 'Salário não informado'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icone nome="local" size={16} className="text-tinta-4" />
            {v.modalidade}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icone nome="relogio" size={16} className="text-tinta-4" />
            {v.nova ? <span className="font-semibold text-azul-700">Coletada hoje</span> : `Coletada ${v.quandoTxt}`}
          </span>
          {v.aplicada && (
            <span className="inline-flex items-center gap-1 font-semibold text-agua-texto">
              <Icone nome="enviado" size={15} /> Você se candidatou
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => a.toggleSalvar(v.id)}
        aria-pressed={v.salva}
        aria-label={v.salva ? `Remover ${v.titulo} das salvas` : `Salvar ${v.titulo}`}
        className={`absolute top-3 right-3 z-10 grid size-10 cursor-pointer place-items-center rounded-full transition-colors hover:bg-nevoa ${v.salva ? 'text-azul' : 'text-tinta-4 hover:text-azul'}`}
      >
        <Icone nome="marcador" size={19} cheio={v.salva} />
      </button>
    </article>
  );
}

export function Monograma({ letra, grande = false }) {
  return (
    <div
      aria-hidden="true"
      className={`grid flex-none place-items-center rounded-xl bg-azul/10 font-serif font-bold text-azul ${grande ? 'size-14 text-2xl' : 'size-10 text-lg'}`}
    >
      {letra}
    </div>
  );
}
