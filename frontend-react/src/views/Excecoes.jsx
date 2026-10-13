// Prancha 10 — Estados de exceção. Cada causa tem a sua mensagem e a sua saída; nenhuma é um beco sem saída.
import { useApp } from '../state/AppContext.jsx';
import Icone from '../components/Icone.jsx';

const CATALOGO = {
  vinculo_inativo: {
    titulo: 'Seu vínculo não está ativo',
    texto: 'Não encontramos matrícula ativa para este CPF na faculdade. Procure a secretaria acadêmica para regularizar.',
    acoes: [{ rotulo: 'Voltar ao início de sessão', alvo: 'portal', principal: true }],
  },
  academico_indisponivel: {
    titulo: 'O Portal Acadêmico não respondeu',
    texto: 'Não é a sua conexão: a faculdade está fora do ar ou demorando para responder. Tente de novo em alguns minutos.',
    acoes: [{ rotulo: 'Tentar de novo', alvo: 'portal', principal: true }],
  },
  consentimento_recusado: {
    titulo: 'O StartMe funciona, mas às cegas',
    texto: 'Sem o seu curso e semestre não há como dizer se uma vaga combina com o seu momento no curso. A busca e os filtros continuam funcionando.',
    lista: ['Sem ordenação por compatibilidade', 'Sem preenchimento automático na candidatura', 'Nenhum dado seu é enviado a nenhuma empresa'],
    acoes: [
      { rotulo: 'Autorizar agora', alvo: 'consent', principal: true },
      { rotulo: 'Continuar sem autorizar', alvo: 'vagas' },
    ],
  },
  coletor_indisponivel: {
    titulo: 'Não conseguimos falar com o serviço de vagas',
    texto: 'Não é a sua conexão. As vagas que aparecem agora podem ser de demonstração. Tente de novo em instantes.',
    acoes: [{ rotulo: 'Tentar de novo', recarregar: true, principal: true }],
  },
  sessao_expirada: {
    titulo: 'Sua sessão expirou',
    texto: 'Entre de novo e você volta para onde estava.',
    acoes: [
      { rotulo: 'Entrar novamente', alvo: 'portal', principal: true },
      { rotulo: 'Continuar sem entrar', alvo: 'vagas' },
    ],
  },
};

const PADRAO = {
  titulo: 'Algo não saiu como esperado',
  texto: 'Volte ao início e tente de novo.',
  acoes: [{ rotulo: 'Ir para o início', alvo: 'inicio', principal: true }],
};

export default function Excecoes() {
  const { s, a } = useApp();
  const estado = CATALOGO[s.sel] || PADRAO;

  const agir = (acao) => {
    if (acao.recarregar) window.location.reload();
    else a.irView(acao.alvo);
  };

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-[560px] items-center px-4 py-10 sm:px-6">
      <section aria-labelledby="excecao-titulo" className="w-full rounded-2xl border border-linha bg-white p-6 shadow-painel sm:p-8">
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-papel-2 text-azul">
          <Icone nome="alerta" size={22} />
        </span>
        <h1 id="excecao-titulo" tabIndex={-1} className="mt-4 font-serif text-[24px] font-bold text-tinta focus:outline-none">
          {estado.titulo}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-tinta-2">{estado.texto}</p>
        {estado.lista && (
          <ul className="mt-4 flex list-disc flex-col gap-1.5 pl-5 text-sm text-tinta-2">
            {estado.lista.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          {estado.acoes.map((acao) => (
            <button
              key={acao.rotulo}
              type="button"
              onClick={() => agir(acao)}
              className={acao.principal ? 'btn-primario min-h-12 px-5' : 'btn-claro min-h-12 px-5'}
            >
              {acao.rotulo}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
