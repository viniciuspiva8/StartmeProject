// Busca de vagas (Pranchas 5 a 7): filtros em linha, lista à esquerda e
// detalhe à direita. Abaixo de 1024 px, o detalhe abre em tela cheia.
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

  // No desktop o painel nunca fica vazio: sem vaga escolhida, abre a primeira da lista.
  useEffect(() => {
    if (desktop && !s.sel && resultados[0]) a.selecionarSemHistorico(resultados[0].id);
  }, [desktop, s.sel, resultados, a]);

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

      <div className="mx-auto max-w-[1440px] lg:grid lg:grid-cols-[minmax(380px,460px)_1fr]">
        <section
          aria-label="Resultados"
          className="bg-white lg:sticky lg:top-[calc(4rem+var(--altura-filtros))] lg:h-[calc(100dvh-4rem-var(--altura-filtros))] lg:overflow-y-auto lg:border-r lg:border-linha"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-linha px-4 py-3 sm:px-5">
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
            <p className="flex items-start gap-2 border-b border-linha bg-papel px-4 py-2.5 text-[13px] text-tinta-3 sm:px-5">
              <Icone nome="info" size={16} className="mt-px" />
              Vagas de demonstração: o coletor está fora do ar.
            </p>
          )}

          {s.vagasCarregando ? (
            <Esqueleto />
          ) : total === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="font-serif text-xl font-bold text-tinta">Nenhuma vaga com esses filtros</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-3">
                Há {s.vagas.length} vagas coletadas. Tire um filtro para voltar a vê-las.
              </p>
              <button type="button" onClick={a.limparFiltros} className="btn-primario mt-5">Limpar filtros</button>
            </div>
          ) : (
            <>
              <ul>
                {visiveis.map((v) => (
                  <li key={v.id}>
                    <VagaCard v={v} selecionada={desktop && s.sel === v.id} />
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

        {desktop && (
          <section aria-label="Vaga selecionada" className="lg:sticky lg:top-[calc(4rem+var(--altura-filtros))] lg:h-[calc(100dvh-4rem-var(--altura-filtros))] lg:overflow-y-auto">
            {selecionada ? <Detalhe v={selecionada} /> : null}
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
    <ul aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex animate-pulse gap-3.5 border-b border-linha px-5 py-4">
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
