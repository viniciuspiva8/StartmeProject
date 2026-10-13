import { useApp } from '../../state/AppContext.jsx';
import Icone from '../../components/Icone.jsx';

// ---------------------------------------------------------------------------
// Blocos do editor
// ---------------------------------------------------------------------------
export function Secao({ titulo, descricao, children, id }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-linha bg-white p-5 sm:p-6">
      <h2 id={id} className="text-[17px] font-bold text-tinta">{titulo}</h2>
      {descricao && <p className="mt-1 text-[13px] leading-relaxed text-tinta-3">{descricao}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Campo({ rotulo, children, largo = false }) {
  return (
    <label className={`flex flex-col gap-1.5 ${largo ? 'sm:col-span-2' : ''}`}>
      <span className="text-[13px] font-semibold text-tinta-2">{rotulo}</span>
      {children}
    </label>
  );
}

export const ENTRADA_BASE = 'min-h-11 rounded-xl border border-linha-forte bg-white px-3 text-sm text-tinta outline-none placeholder:text-tinta-4 focus:border-azul-500 focus:ring-3 focus:ring-azul-300/40';

export const ENTRADA = `${ENTRADA_BASE} w-full`;

export function Chip({ children, onRemover, tom = 'neutro' }) {
  const estilos = {
    neutro: 'bg-papel-2 text-tinta-2',
    comprovada: 'bg-agua-fundo text-agua-texto',
    declarada: 'bg-nevoa text-azul',
  };
  return (
    <li className={`inline-flex min-h-8 items-center gap-1 rounded-pill pr-1 pl-3 text-[13px] font-semibold ${estilos[tom]} ${onRemover ? '' : 'pr-3'}`}>
      {children}
      {onRemover && (
        <button type="button" onClick={onRemover} aria-label={`Remover ${children}`} className="relative grid size-7 cursor-pointer place-items-center rounded-full before:absolute before:-inset-2 hover:bg-white/70">
          <Icone nome="fechar" size={14} />
        </button>
      )}
    </li>
  );
}

export function Lista({ itens, render, vazio }) {
  if (!itens.length) return <p className="text-sm text-tinta-3">{vazio}</p>;
  return <ul className="flex flex-col divide-y divide-linha rounded-xl border border-linha">{itens.map(render)}</ul>;
}

export function Remover({ rotulo, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={rotulo} className="grid size-11 flex-none cursor-pointer place-items-center rounded-xl text-tinta-4 hover:bg-erro-fundo hover:text-erro">
      <Icone nome="fechar" size={18} />
    </button>
  );
}

export function RestaurarDemo() {
  const { a } = useApp();
  return (
    <p className="text-center text-[13px] text-tinta-3">
      Testando a demonstração?{' '}
      <button type="button" onClick={a.restaurarCurriculo} className="cursor-pointer px-1 py-3.5 font-semibold text-azul-700 underline-offset-2 hover:underline">
        Restaurar o currículo de exemplo
      </button>
    </p>
  );
}
