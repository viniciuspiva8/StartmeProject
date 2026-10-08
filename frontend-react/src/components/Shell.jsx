// Casca da aplicação: barra superior institucional, navegação inferior no
// celular, aviso flutuante (toast) e o painel de notas de design.
import { useEffect, useRef } from 'react';
import { useApp } from '../state/AppContext.jsx';
import Icone from './Icone.jsx';
import NotasDrawer from './Notas.jsx';

const ABAS = [
  { view: 'inicio', rotulo: 'Início', icone: 'casa' },
  { view: 'vagas', rotulo: 'Vagas', icone: 'lista' },
  { view: 'curriculo', rotulo: 'Meu currículo', icone: 'historico' },
];
const VIEWS_LOGADAS = ABAS.map((x) => x.view);

export default function Shell({ children }) {
  const { s } = useApp();
  const logado = VIEWS_LOGADAS.includes(s.view);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#conteudo" className="sr-only print:hidden focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-azul">
        Pular para o conteúdo
      </a>
      {logado && <BarraSuperior />}
      <div id="conteudo" className={`flex-1 ${logado ? 'pb-20 md:pb-0 print:pb-0' : ''}`}>{children}</div>
      {logado && <NavInferior />}
      {!logado && <BotaoNotasFlutuante />}
      <Toast />
      <NotasDrawer />
    </div>
  );
}

function BarraSuperior() {
  const { s, a } = useApp();
  const menuRef = useRef(null);

  useEffect(() => {
    if (!s.menuAberto) return undefined;
    const fora = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) a.fecharMenu(); };
    const esc = (e) => { if (e.key === 'Escape') a.fecharMenu(); };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc); };
  }, [s.menuAberto, a]);

  return (
    <header className="sticky top-0 z-40 bg-azul text-white print:hidden">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
        <button type="button" onClick={() => a.irView('inicio')} className="flex cursor-pointer items-center gap-2.5 rounded-lg">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-[10px] bg-white font-serif text-xl font-bold text-azul">S</span>
          <span className="text-left leading-tight">
            <span className="block text-base font-bold">StartMe</span>
            <span className="block text-[11px] text-white/70">Fundação Santo André</span>
          </span>
        </button>

        <nav aria-label="Principal" className="hidden h-full items-stretch gap-1 md:flex">
          {ABAS.map((aba) => {
            const ativa = s.view === aba.view;
            return (
              <button
                key={aba.view}
                type="button"
                onClick={() => a.irView(aba.view)}
                aria-current={ativa ? 'page' : undefined}
                className={`relative flex cursor-pointer items-center px-3 text-sm font-semibold transition-colors ${ativa ? 'text-white' : 'text-white/70 hover:text-white'}`}
              >
                {aba.rotulo}
                <span aria-hidden="true" className={`absolute inset-x-3 bottom-0 h-[3px] rounded-t-full transition-colors ${ativa ? 'bg-agua-claro' : 'bg-transparent'}`} />
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={a.toggleNotas}
            aria-expanded={s.notasAbertas}
            className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white"
          >
            <Icone nome="notas" size={18} />
            <span className="hidden lg:inline">Notas de design</span>
          </button>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={a.toggleMenu}
              aria-haspopup="menu"
              aria-expanded={s.menuAberto}
              aria-label="Conta de Vinicius"
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl py-1 pr-2 pl-1 hover:bg-white/10"
            >
              <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-agua-claro text-[13px] font-bold text-azul">VP</span>
              <Icone nome="abaixo" size={16} className="text-white/70" />
            </button>
            {s.menuAberto && (
              <div role="menu" className="absolute right-0 mt-2 w-64 animate-entra rounded-2xl border border-linha bg-white p-2 text-tinta shadow-flutuante">
                <div className="px-3 pt-2 pb-3">
                  <p className="text-sm font-bold">Vinicius Pereira</p>
                  <p className="text-[13px] text-tinta-3">Engenharia de Computação, {s.semestreAluno}º semestre</p>
                </div>
                <button type="button" role="menuitem" onClick={a.sair} className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-erro hover:bg-erro-fundo">
                  <Icone nome="sair" size={18} /> Sair do StartMe
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function NavInferior() {
  const { s, a } = useApp();
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-linha bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
      <div className="grid grid-cols-3">
        {ABAS.map((aba) => {
          const ativa = s.view === aba.view;
          return (
            <button
              key={aba.view}
              type="button"
              onClick={() => a.irView(aba.view)}
              aria-current={ativa ? 'page' : undefined}
              className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 text-xs font-semibold ${ativa ? 'text-azul' : 'text-tinta-3'}`}
            >
              <span className={`grid h-7 w-14 place-items-center rounded-full transition-colors ${ativa ? 'bg-nevoa' : ''}`}>
                <Icone nome={aba.icone} size={20} />
              </span>
              {aba.rotulo}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Toast() {
  const { s, a } = useApp();
  return (
    <div aria-live="polite" role="status" className="pointer-events-none print:hidden fixed inset-x-0 bottom-[8.5rem] z-[70] flex justify-center px-4 md:bottom-6">
      {s.toast && (
        <div key={s.toast.id} className="pointer-events-auto flex w-full max-w-xl animate-entra flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-tinta py-3 pr-2 pl-4 text-sm text-white shadow-flutuante sm:w-auto sm:flex-nowrap">
          <span className="min-w-0 flex-[1_1_14rem] leading-snug">{s.toast.texto}</span>
          {s.toast.acao && (
            <button
              type="button"
              onClick={() => { a.irView(s.toast.acao.view); a.fecharToast(); }}
              className="min-h-10 cursor-pointer rounded-xl px-3 font-bold whitespace-nowrap text-agua-claro hover:bg-white/10"
            >
              {s.toast.acao.rotulo}
            </button>
          )}
          <button type="button" onClick={a.fecharToast} aria-label="Fechar aviso" className="grid size-10 cursor-pointer place-items-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white">
            <Icone nome="fechar" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function BotaoNotasFlutuante() {
  const { s, a } = useApp();
  return (
    <button
      type="button"
      onClick={a.toggleNotas}
      aria-expanded={s.notasAbertas}
      className="fixed right-4 bottom-4 z-40 print:hidden inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill bg-tinta px-4 text-sm font-semibold text-white shadow-flutuante hover:bg-tinta-2"
    >
      <Icone nome="notas" size={18} /> Notas de design
    </button>
  );
}
