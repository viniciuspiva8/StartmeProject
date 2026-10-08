// Busca de vagas (Pranchas 5 a 7).
// A lista fica no centro da tela, com o que decide "vale abrir?" à vista em cada
// cartão. Ao clicar, a lista vira uma coluna à esquerda e o detalhe abre ao lado;
// fechar o detalhe (botão, Esc ou Voltar do navegador) devolve a lista ao centro.
// Abaixo de 1024 px, o detalhe abre em tela cheia.
import { useEffect, useMemo, useRef } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { enfeitar, ordenar, passaFiltro } from '../lib/vagas.js';
import { useMedia } from '../lib/useMedia.js';
import Filtros from '../components/Filtros.jsx';
import VagaCard from '../components/VagaCard.jsx';
import Icone from '../components/Icone.jsx';
import Detalhe from './Detalhe.jsx';

export default function Lista() {
  const { s, a, perfil } = useApp();
  const desktop = useMedia('(min-width: 1024px)');
  const ctx = { aplicadas: s.aplicadas, salvas: s.salvas, perfil };

  const resultados = useMemo(() => {
    const f = {
      q: s.q, faixa: s.faixa, mods: s.mods, areas: s.areas, compatOnly: s.compatOnly, janela: s.janela,
      marcadas: s.marcadas, salvas: s.salvas, aplicadas: s.aplicadas,
    };
    return ordenar(s.vagas.filter((v) => passaFiltro(v, f, perfil)), s.ord, perfil);
  }, [s.vagas, s.q, s.faixa, s.mods, s.areas, s.compatOnly, s.janela, s.marcadas, s.salvas, s.aplicadas, s.ord, perfil]);

  const visiveis = resultados.slice(0, s.visiveis).map((v) => enfeitar(v, ctx));
  const bruta = s.sel ? s.vagas.find((v) => v.id === s.sel) : null;
  const selecionada = bruta ? enfeitar(bruta, ctx) : null;

  const aberta = desktop && !!selecionada;

  // Ao abrir: página no topo e o cartão escolhido visível na coluna da esquerda.
  // Ao fechar: o foco volta ao cartão que estava aberto, e ele volta à vista.
  const ultimaAberta = useRef(null);
  useEffect(() => {
    if (!desktop) return;
    if (s.sel) {
      ultimaAberta.current = s.sel;
      window.scrollTo({ top: 0 });
      document.querySelector(`[data-vaga-id="${s.sel}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (ultimaAberta.current) {
      const botao = document.querySelector(`[data-vaga-id="${ultimaAberta.current}"]`);
      botao?.scrollIntoView({ block: 'center' });
      botao?.focus({ preventScroll: true });
      ultimaAberta.current = null;
    }
  }, [desktop, s.sel]);

  // Esc fecha o detalhe aberto ao lado (se não houver um popover de filtro aberto tratando o Esc).
  useEffect(() => {
    if (!aberta) return undefined;
    const aoTeclar = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[role="group"][aria-label]') || s.notasAbertas || s.menuAberto) return;
      a.fecharVaga();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberta, a, s.notasAbertas, s.menuAberto]);

  // Tela cheia no celular: trava a rolagem do fundo.
  const telaCheia = !desktop && !!selecionada;
  useEffect(() => {
    document.body.style.overflow = telaCheia ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [telaCheia]);

  const total = resultados.length;

  // A barra de filtros pode quebrar em duas linhas: a altura real vira a variável
  // --altura-filtros, usada pela lista e pelo detalhe para ocupar o resto da tela.
  const mainRef = useRef(null);
  const barraRef = useRef(null);
  useEffect(() => {
    const barra = barraRef.current;
    if (!barra || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => {
      mainRef.current?.style.setProperty('--altura-filtros', `${Math.ceil(e.borderBoxSize?.[0]?.blockSize ?? barra.offsetHeight)}px`);
    });
    ro.observe(barra);
    return () => ro.disconnect();
  }, []);

  return (
    <main ref={mainRef} className="[--altura-filtros:4.25rem]">
      <div ref={barraRef} className="sticky top-16 z-30 border-b border-linha bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6">
          <Filtros />
        </div>
      </div>

      <div className={aberta ? 'mx-auto max-w-[1440px] lg:grid lg:grid-cols-[minmax(380px,460px)_1fr]' : 'mx-auto max-w-[960px] px-4 pb-12 sm:px-6'}>
        <section
          aria-label="Resultados"
          className={aberta
            ? 'bg-white lg:sticky lg:top-[calc(4rem+var(--altura-filtros))] lg:h-[calc(100dvh-4rem-var(--altura-filtros))] lg:overflow-y-auto lg:border-r lg:border-linha'
            : ''}
        >
          <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${aberta ? 'border-b border-linha px-4 py-3 sm:px-5' : 'py-4'}`}>
            <p className="text-sm text-tinta-2" aria-live="polite">
              <strong className="font-serif text-lg text-tinta">{total}</strong> {total === 1 ? 'vaga' : 'vagas'}
            </p>
            <label className="flex items-center gap-2 text-[13px] text-tinta-3">
              Ordenar por
              <select value={s.ord} onChange={(e) => a.setOrd(e.target.value)} className="min-h-9 cursor-pointer rounded-lg bg-transparent pr-1 text-[13px] font-semibold text-tinta hover:text-azul">
                <option value="compat">Mais indicadas para você</option>
                <option value="recentes">Coletadas há menos tempo</option>
                <option value="salario">Maior salário declarado</option>
              </select>
            </label>
          </div>

          {s.vagasFonte === 'mock' && !s.vagasCarregando && (
            <p className={`flex items-start gap-2 text-[13px] text-tinta-3 ${aberta ? 'border-b border-linha bg-papel px-4 py-2.5 sm:px-5' : 'mb-4'}`}>
              <Icone nome="info" size={16} className="mt-px" />
              Vagas de demonstração: o coletor está fora do ar.
            </p>
          )}

          {s.vagasCarregando ? (
            <Esqueleto />
          ) : total === 0 ? (
            <div className={`px-6 py-14 text-center ${aberta ? '' : 'rounded-2xl border border-dashed border-linha-forte bg-white'}`}>
              <p className="font-serif text-xl font-bold text-tinta">Nenhuma vaga com esses filtros</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-3">
                Há {s.vagas.length} vagas coletadas. Tire um filtro para voltar a vê-las.
              </p>
              <button type="button" onClick={a.limparFiltros} className="btn-primario mt-5">Limpar filtros</button>
            </div>
          ) : (
            <>
              <ul className={aberta ? '' : 'flex flex-col gap-3'}>
                {visiveis.map((v) => (
                  <li key={v.id}>
                    <VagaCard v={v} variante={aberta ? 'lista' : 'ampla'} selecionada={aberta && s.sel === v.id} />
                  </li>
                ))}
              </ul>
              {total > visiveis.length && (
                <div className="p-4 text-center">
                  <button type="button" onClick={a.carregarMais} className="btn-claro">
                    Mostrar mais {Math.min(10, total - visiveis.length)} de {total - visiveis.length}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {aberta && (
          <section aria-label="Vaga selecionada" className="lg:sticky lg:top-[calc(4rem+var(--altura-filtros))] lg:h-[calc(100dvh-4rem-var(--altura-filtros))] lg:overflow-y-auto">
            <Detalhe v={selecionada} aoFechar={a.fecharVaga} />
          </section>
        )}
      </div>

      {telaCheia && (
        <div role="dialog" aria-modal="true" aria-label={selecionada.titulo} className="fixed inset-0 z-50 animate-sobe overflow-y-auto bg-white">
          <Detalhe v={selecionada} telaCheia />
        </div>
      )}
    </main>
  );
}

function Esqueleto() {
  return (
    <ul aria-hidden="true" className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex animate-pulse gap-3.5 rounded-2xl border border-linha bg-white px-5 py-5">
          <span className="size-10 rounded-xl bg-papel-2" />
          <span className="flex flex-1 flex-col gap-2.5">
            <span className="h-4 w-3/4 rounded bg-papel-2" />
            <span className="h-3 w-1/3 rounded bg-papel-2" />
            <span className="h-2 w-24 rounded-full bg-papel-2" />
            <span className="h-3 w-1/2 rounded bg-papel-2" />
          </span>
        </li>
      ))}
    </ul>
  );
}
