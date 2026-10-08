// Prancha 1: portal acadêmico simulado, com login na mesma tela.
// É simulação, nunca clone: faixa permanente e credenciais de demonstração à vista.
import { CPF_DEMO, FERRAMENTAS, PORTAIS, SENHA_DEMO } from '../data/mock.js';
import { useApp } from '../state/AppContext.jsx';
import Icone from '../components/Icone.jsx';

export default function Portal() {
  const { s, a } = useApp();
  const podeEntrar = s.cpf.length === 14 && s.senha.length > 0;

  return (
    <main className="min-h-dvh bg-[linear-gradient(to_bottom,var(--color-nevoa)_0,var(--color-nevoa)_340px,var(--color-papel)_340px)]">
      <p role="note" className="flex items-center justify-center gap-2 bg-ressalva-fundo px-4 py-2.5 text-center text-[13px] font-semibold text-ressalva">
        <Icone nome="alerta" size={16} />
        Ambiente simulado para o TCC, inspirado no portal.fsa.br. Não use credenciais reais.
      </p>

      <div className="mx-auto max-w-[920px] px-4 pt-10 pb-16 sm:px-6">
        <div className="mx-auto max-w-[440px] rounded-3xl bg-white p-6 shadow-painel sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex" aria-hidden="true">
              <span className="grid size-10 place-items-center rounded-full border-2 border-white bg-azul font-serif font-bold text-white">F</span>
              <span className="-ml-2.5 grid size-10 place-items-center rounded-full border-2 border-white bg-azul-300 font-serif font-bold text-white">S</span>
              <span className="-ml-2.5 grid size-10 place-items-center rounded-full border-2 border-white bg-azul-700 font-serif font-bold text-white">A</span>
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] text-tinta-3">Centro Universitário</span>
              <span className="block font-serif text-[17px] font-bold text-azul">Fundação Santo André</span>
            </span>
          </div>

          <h1 className="mt-8 font-serif text-[30px] leading-tight font-bold text-tinta">Portais FSA</h1>
          <p className="mt-1 text-[15px] text-tinta-3">Entre com o seu CPF e a senha do portal.</p>

          <form className="mt-6 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (podeEntrar) a.entrar(); }}>
            <Campo icone="pessoa" rotulo="CPF" htmlFor="cpf">
              <input id="cpf" type="text" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
                value={s.cpf} onChange={(e) => a.setCpf(e.target.value)}
                className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] text-tinta outline-none placeholder:text-tinta-4" />
            </Campo>
            <Campo
              icone="cadeado"
              rotulo="Senha"
              htmlFor="senha"
              acao={(
                <button type="button" onClick={a.toggleSenha} aria-label={s.verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-controls="senha" className="grid size-10 cursor-pointer place-items-center rounded-lg text-tinta-3 hover:text-azul">
                  <Icone nome={s.verSenha ? 'olhoFechado' : 'olho'} size={19} />
                </button>
              )}
            >
              <input id="senha" type={s.verSenha ? 'text' : 'password'} placeholder="Sua senha" autoComplete="off"
                value={s.senha} onChange={(e) => a.setSenha(e.target.value)}
                className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] text-tinta outline-none placeholder:text-tinta-4" />
            </Campo>

            {s.erroLogin && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-erro-fundo px-3.5 py-3 text-sm text-erro">
                <Icone nome="alerta" size={17} className="mt-px" />
                CPF ou senha não conferem. Use as credenciais de demonstração abaixo.
              </p>
            )}

            <button type="submit" disabled={!podeEntrar} className="btn-primario mt-1 min-h-12 text-[15px]">Entrar</button>
            <button type="button" onClick={a.nadaAinda} className="self-center text-[13px] font-semibold text-azul-700 hover:underline">
              Esqueci ou quero trocar a senha
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-dashed border-linha-forte p-4">
            <p className="text-[13px] font-semibold text-tinta-2">Credenciais de demonstração</p>
            <p className="mt-1 text-sm text-tinta tabular-nums">CPF {CPF_DEMO}, senha {SENHA_DEMO}</p>
            <button type="button" onClick={a.preencherDemo} className="btn-claro mt-3 min-h-10 w-full">Preencher para mim</button>
          </div>
        </div>

        <Atalhos titulo="Ferramentas de documentos" itens={FERRAMENTAS} onClick={() => a.nadaAinda()} />
        <Atalhos titulo="Outros acessos" itens={PORTAIS} onClick={(item) => a.portalClicar(item.nome)} />
      </div>
    </main>
  );
}

// O rótulo aponta só para o campo (htmlFor). O botão de ação fica fora dele,
// para o leitor de tela anunciar "Senha", e não "Senha Mostrar senha".
function Campo({ icone, rotulo, htmlFor, acao = null, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-tinta-2">{rotulo}</label>
      <div className="flex items-center gap-2 rounded-xl border border-linha-forte bg-white pl-3 focus-within:border-azul-500 focus-within:ring-3 focus-within:ring-azul-300/40">
        <Icone nome={icone} size={18} className="text-tinta-4" />
        {children}
        {acao}
      </div>
    </div>
  );
}

function Atalhos({ titulo, itens, onClick }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-[15px] font-bold text-tinta-2">{titulo}</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {itens.map((item) => (
          <li key={item.nome}>
            <button
              type="button"
              onClick={() => onClick(item)}
              className={`relative flex h-full w-full cursor-pointer flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${item.novo ? 'border-agua bg-agua-fundo hover:border-agua-texto' : 'border-linha bg-white hover:border-azul-500'}`}
            >
              <span className={`grid size-10 place-items-center rounded-xl ${item.novo ? 'bg-agua text-white' : 'bg-nevoa text-azul'}`}>
                <Icone nome={item.icone} size={21} />
              </span>
              <span className="text-sm leading-snug font-semibold text-tinta">{item.nome}</span>
              {item.novo && <span className="absolute top-3 right-3 rounded-pill bg-agua px-2 py-0.5 text-[11px] font-bold text-white">Novo</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
