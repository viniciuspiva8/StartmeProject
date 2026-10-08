// Barra de filtros da busca: um campo de busca, um atalho sempre visível
// ("combina com o meu semestre") e os demais filtros recolhidos em botões
// que abrem uma lista de opções. No celular a linha rola na horizontal.
import { useEffect, useId, useRef, useState } from 'react';
import { AREAS, FAIXAS, JANELAS, MODALIDADES } from '../data/mock.js';
import { useApp } from '../state/AppContext.jsx';
import Icone from './Icone.jsx';

export default function Filtros() {
  const { s, a } = useApp();
  const ativos = (s.mods.length ? 1 : 0) + (s.areas.length ? 1 : 0) + (s.faixa !== 'todas' ? 1 : 0)
    + (s.janela !== '30' ? 1 : 0) + (s.compatOnly ? 1 : 0) + (s.q ? 1 : 0) + (s.marcadas.length ? 1 : 0);
  const marcadasRotulo = s.marcadas.map((m) => (m === 'salvas' ? 'Salvas' : 'Já me candidatei')).join(', ');
  const faixaRotulo = FAIXAS.find((f) => f.v === s.faixa)?.label;
  const janelaRotulo = JANELAS.find((j) => j.v === s.janela)?.label;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-linha-forte bg-white px-3 focus-within:border-azul-500 focus-within:ring-3 focus-within:ring-azul-300/40 lg:w-64 lg:flex-none xl:w-80">
        <Icone nome="busca" size={18} className="text-tinta-4" />
        <span className="sr-only">Buscar vagas</span>
        <input
          type="search"
          value={s.q}
          onChange={(e) => a.setQ(e.target.value)}
          placeholder="Cargo, empresa ou tecnologia"
          className="min-h-10 min-w-0 flex-1 bg-transparent text-sm text-tinta outline-none placeholder:text-tinta-3"
        />
      </label>

      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
        <button type="button" aria-pressed={s.compatOnly} onClick={a.toggleCompat} className={`chip ${s.compatOnly ? 'chip-ativo' : ''}`}>
          {s.compatOnly && <Icone nome="check" size={16} />}
          Combinam com o meu currículo
        </button>

        <Popover rotulo="Modalidade" valor={s.mods.length ? s.mods.join(', ') : null}>
          {MODALIDADES.map((m) => (
            <Opcao key={m} tipo="checkbox" marcado={s.mods.includes(m)} onChange={() => a.toggleModalidade(m)}>{m}</Opcao>
          ))}
          <Aviso>A coleta ainda não tem campo de modalidade: o valor é deduzido do texto do anúncio.</Aviso>
        </Popover>

        <Popover rotulo="Salário" valor={s.faixa !== 'todas' ? faixaRotulo : null}>
          {FAIXAS.map((f) => (
            <Opcao key={f.v} tipo="radio" nome="faixa" marcado={s.faixa === f.v} onChange={() => a.setFaixa(f.v)}>{f.label}</Opcao>
          ))}
          <Aviso>O salário vem como texto livre. Vagas sem valor só aparecem em "Qualquer valor" e "Não informado".</Aviso>
        </Popover>

        <Popover rotulo="Área" valor={s.areas.length ? s.areas.join(', ') : null}>
          {AREAS.map((ar) => (
            <Opcao key={ar} tipo="checkbox" marcado={s.areas.includes(ar)} onChange={() => a.toggleArea(ar)}
              extra={s.vagas.filter((v) => v.area === ar).length}>
              {ar}
            </Opcao>
          ))}
          <Aviso>A área é deduzida do título da vaga.</Aviso>
        </Popover>

        <Popover rotulo="Coletada" valor={s.janela !== '30' ? janelaRotulo : null}>
          {JANELAS.map((j) => (
            <Opcao key={j.v} tipo="radio" nome="janela" marcado={s.janela === j.v} onChange={() => a.setJanela(j.v)}>
              {j.v === '30' ? 'Últimos 30 dias' : j.v === '7' ? 'Últimos 7 dias' : 'Hoje'}
            </Opcao>
          ))}
          <Aviso>É a data em que o StartMe capturou a vaga, não a de publicação pela empresa.</Aviso>
        </Popover>

        <Popover rotulo="Minhas marcações" valor={s.marcadas.length ? marcadasRotulo : null}>
          <Opcao tipo="checkbox" marcado={s.marcadas.includes('salvas')} onChange={() => a.toggleMarcada('salvas')} extra={s.salvas.length}>Salvas</Opcao>
          <Opcao tipo="checkbox" marcado={s.marcadas.includes('candidatei')} onChange={() => a.toggleMarcada('candidatei')} extra={s.aplicadas.length}>Já me candidatei</Opcao>
          <Aviso>São anotações suas, guardadas neste navegador. O StartMe não acompanha o processo seletivo.</Aviso>
        </Popover>

        {ativos > 0 && (
          <button type="button" onClick={a.limparFiltros} className="btn-fantasma min-h-10 whitespace-nowrap">
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}

function Popover({ rotulo, valor, children }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);

  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((x) => !x)}
        className={`chip ${valor ? 'border-azul bg-nevoa text-azul' : ''}`}
      >
        <span className="max-w-48 truncate">{valor ? `${rotulo}: ${valor}` : rotulo}</span>
        <Icone nome="abaixo" size={16} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div id={id} role="group" aria-label={rotulo} className="fixed inset-x-3 top-auto z-50 mt-2 animate-entra rounded-2xl border border-linha bg-white p-2 shadow-flutuante sm:absolute sm:inset-x-auto sm:left-0 sm:w-72">
          {children}
        </div>
      )}
    </div>
  );
}

function Opcao({ tipo, nome, marcado, onChange, extra, children }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-tinta hover:bg-papel">
      <input type={tipo} name={nome} checked={marcado} onChange={onChange} className="size-[18px] accent-azul" />
      <span className="flex-1">{children}</span>
      {extra !== undefined && <span className="text-[13px] text-tinta-3 tabular-nums">{extra}</span>}
    </label>
  );
}

function Aviso({ children }) {
  return <p className="mx-3 mt-1 mb-2 border-t border-linha pt-2.5 text-xs leading-relaxed text-tinta-3">{children}</p>;
}
