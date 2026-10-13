import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CPF_DEMO, SENHA_DEMO } from '../data/mock.js';
import { fetchAlunoDemo, fetchVagas, gravarLocal } from '../lib/api.js';
import { apiAluno } from '../lib/apiAluno.js';
import { digitos } from '../lib/cpf.js';
import { montarPerfil, normalizar, vagasQueMudaram } from '../lib/match.js';
import { CHAVE_CURRICULO, CHAVE_SALVAS, CHAVE_APLICADAS, FILTROS_PADRAO, POR_LOTE, lerHash, montarHash, mascaraCpf } from './constantes.js';
import { comTransicao, novoId, estadoInicial } from './utilitarios.js';

// Reexportações: as telas importam daqui; a origem real está em constantes.js.
export { FILTROS_PADRAO, POR_LOTE, mascaraCpf } from './constantes.js';

const AppContext = createContext(null);

// Campos da Prancha 9 a partir do vínculo que o servidor devolveu (nunca o CPF).
function daSessao(me) {
  const v = me.vinculo;
  return {
    semestreAluno: v.semestre,
    academicoFonte: 'servidor',
    campos: [
      { rotulo: 'Nome completo', valor: v.nome || 'Não informado pela faculdade' },
      { rotulo: 'Curso', valor: v.curso },
      { rotulo: 'Semestre', valor: `${v.semestre}º semestre` },
      { rotulo: 'Situação do vínculo', valor: v.ativo ? 'Ativo' : 'Inativo' },
    ],
  };
}

// Erros do login que viram uma tela de exceção (Prancha 10), em vez de mensagem no formulário.
const EXCECAO_DO_LOGIN = {
  vinculo_inativo: 'vinculo_inativo',
  academico_indisponivel: 'academico_indisponivel',
  autenticacao_indisponivel: 'academico_indisponivel',
  rede: 'coletor_indisponivel',
};

export function AppProvider({ children }) {
  const [s, setS] = useState(estadoInicial);
  // Começa em true: a primeira escrita da URL substitui a entrada atual em vez de empilhar.
  const substituirHistorico = useRef(true);
  const timerToast = useRef(null);

  const estadoAtual = useRef(s);
  estadoAtual.current = s;

  const set = useCallback((patch) => {
    setS((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);

  // Dados: começa com o mock e troca se os backends responderem.
  useEffect(() => {
    let ativo = true;
    fetchVagas().then((r) => { if (ativo) set({ vagas: r.vagas, vagasFonte: r.fonte, vagasCarregando: false }); });
    fetchAlunoDemo().then((r) => { if (ativo) set({ campos: r.campos, academicoFonte: r.fonte, semestreAluno: r.semestreAluno }); });
    return () => { ativo = false; };
  }, [set]);

  // Servidor: descobre se há a integração ativa e se o aluno já tem sessão. Sem servidor, segue o modo local.
  useEffect(() => {
    let ativo = true;
    apiAluno.config()
      .then(async (cfg) => {
        if (!ativo) return;
        set({ servidor: cfg });
        if (!cfg.sessao_ativa) return;
        try {
          const me = await apiAluno.me();
          if (ativo) {
            set((p) => ({
              sessao: me,
              ...daSessao(me),
              view: p.view === 'portal' ? (me.consentimento.aceito ? 'inicio' : 'consent') : p.view,
            }));
          }
        } catch {
          // Sem sessão válida: o aluno segue no portal para entrar.
        }
      })
      .catch(() => { if (ativo) set({ servidor: null }); });
    return () => { ativo = false; };
  }, [set]);

  // URL → estado (Voltar/Avançar do navegador, link colado).
  useEffect(() => {
    const aoMudar = () => {
      const rota = lerHash();
      comTransicao(() => set({ view: rota.view, sel: rota.sel, menuAberto: false }));
    };
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, [set]);

  // Estado → URL.
  useEffect(() => {
    const alvo = montarHash(s.view, s.sel);
    if (window.location.hash === alvo) return;
    if (substituirHistorico.current) {
      window.history.replaceState(null, '', alvo);
      substituirHistorico.current = false;
    } else {
      window.history.pushState(null, '', alvo);
    }
  }, [s.view, s.sel]);

  // Rola para o topo ao trocar de tela, exceto quando a tela abre já apontando
  // para um formulário (o "Eu sei X" leva direto ao formulário da habilidade,
  // que rola até si mesmo). Este efeito roda depois dos efeitos dos filhos.
  useEffect(() => {
    if (estadoAtual.current.habilidadeEmEdicao) return;
    window.scrollTo({ top: 0 });
  }, [s.view]);

  // Persistência no navegador.
  useEffect(() => { gravarLocal(CHAVE_CURRICULO, s.curriculo); }, [s.curriculo]);
  useEffect(() => { gravarLocal(CHAVE_SALVAS, s.salvas); }, [s.salvas]);
  useEffect(() => { gravarLocal(CHAVE_APLICADAS, s.aplicadas); }, [s.aplicadas]);

  // Perfil de habilidades derivado do currículo: é a base de todo o match.
  const perfil = useMemo(() => montarPerfil(s.curriculo, s.semestreAluno), [s.curriculo, s.semestreAluno]);


  const actions = useMemo(() => {
    /** Aplica a mudança no currículo e conta quantas vagas mudaram de avaliação. */
    const mudarCurriculo = (transformar, mensagem, acaoForcada) => {
      const atual = estadoAtual.current;
      const novo = transformar(atual.curriculo);
      if (novo === atual.curriculo) return;
      const mudaram = vagasQueMudaram(
        atual.vagas,
        montarPerfil(atual.curriculo, atual.semestreAluno),
        montarPerfil(novo, atual.semestreAluno),
      );
      set({ curriculo: novo });
      const sufixo = mudaram === 0 ? ' Nenhuma vaga mudou de avaliação.'
        : mudaram === 1 ? ' 1 vaga mudou de avaliação.' : ` ${mudaram} vagas mudaram de avaliação.`;
      const acaoPadrao = mudaram > 0 && atual.view !== 'vagas' ? { rotulo: 'Ver vagas', view: 'vagas' } : null;
      mostrarToast(mensagem + sufixo, acaoForcada !== undefined ? acaoForcada : acaoPadrao);
    };
    const mostrarToast = (texto, acao = null) => {
      clearTimeout(timerToast.current);
      set({ toast: { texto, acao, id: Date.now() } });
      timerToast.current = setTimeout(() => set({ toast: null }), 6000);
    };
    const irView = (view) => set({ view, sel: null, menuAberto: false, notasAbertas: false });

    return {
      set,
      irView,
      mostrarToast,
      fecharToast: () => set({ toast: null }),
      toggleMenu: () => set((p) => ({ menuAberto: !p.menuAberto })),
      fecharMenu: () => set({ menuAberto: false }),
      toggleNotas: () => set((p) => ({ notasAbertas: !p.notasAbertas })),
      fecharNotas: () => set({ notasAbertas: false }),
      nadaAinda: () => mostrarToast('Este atalho faz parte do portal simulado e não abre nada na demonstração.'),
      sair: async () => {
        if (estadoAtual.current.sessao) {
          try { await apiAluno.sair(); } catch { /* a sessão pode já ter expirado */ }
        }
        set({ view: 'portal', sel: null, menuAberto: false, cpf: '', senha: '', erroLogin: false, erroCodigo: null, sessao: null });
      },

      // Portal + login
      portalClicar: (nome) => {
        if (nome === 'Projeto StartMe') {
          set({ cpf: CPF_DEMO, senha: SENHA_DEMO, erroLogin: false });
          mostrarToast('Credenciais de demonstração preenchidas. Clique em Entrar para continuar.');
          return;
        }
        mostrarToast('Este atalho faz parte do portal simulado e não abre nada na demonstração. Só o Projeto StartMe funciona.');
      },
      setCpf: (valor) => set({ cpf: mascaraCpf(valor), erroLogin: false }),
      setSenha: (valor) => set({ senha: valor, erroLogin: false }),
      toggleSenha: () => set((p) => ({ verSenha: !p.verSenha })),
      preencherDemo: () => set({ cpf: CPF_DEMO, senha: SENHA_DEMO, erroLogin: false }),
      entrar: async () => {
        const { cpf, senha, servidor } = estadoAtual.current;
        if (!servidor?.sessao_ativa) {
          set((p) => (p.cpf === CPF_DEMO && p.senha === SENHA_DEMO ? { view: 'consent', erroLogin: false } : { erroLogin: true }));
          return;
        }
        set({ entrando: true, erroLogin: false, erroCodigo: null });
        try {
          await apiAluno.entrar(digitos(cpf), senha);
          const me = await apiAluno.me();
          set({
            entrando: false, sessao: me, ...daSessao(me), cpf: '', senha: '',
            view: me.consentimento.aceito ? 'inicio' : 'consent',
          });
        } catch (erro) {
          const excecao = EXCECAO_DO_LOGIN[erro.codigo];
          if (excecao) set({ entrando: false, cpf: '', senha: '', view: 'excecao', sel: excecao });
          else set({ entrando: false, erroLogin: true, erroCodigo: erro.codigo || 'erro' });
        }
      },

      // Consentimento
      autorizar: async () => {
        const { sessao, servidor } = estadoAtual.current;
        if (sessao) {
          try {
            const consentimento = await apiAluno.aceitarConsentimento(servidor.versao_termo);
            set((p) => ({ view: 'inicio', sessao: { ...p.sessao, consentimento } }));
          } catch {
            mostrarToast('Não conseguimos registrar sua autorização agora. Tente de novo em instantes.');
            return;
          }
        } else {
          set({ view: 'inicio' });
        }
        mostrarToast('Autorização concedida. O StartMe recebeu vínculo, nome, curso e semestre, e nada além disso.');
      },
      naoAutorizar: () => {
        set({ view: 'excecao', sel: 'consentimento_recusado', cpf: '', senha: '' });
        mostrarToast('Você não autorizou o compartilhamento. Sem ele, o StartMe não consegue comparar as vagas com o seu curso.');
      },

      // Filtros
      setQ: (valor) => set((p) => ({ q: valor, visiveis: POR_LOTE, view: 'vagas', sel: p.view === 'vagas' ? p.sel : null })),
      toggleCompat: () => set((p) => ({ compatOnly: !p.compatOnly, visiveis: POR_LOTE })),
      setFaixa: (v) => set({ faixa: v, visiveis: POR_LOTE }),
      toggleModalidade: (m) => set((p) => ({ mods: p.mods.includes(m) ? p.mods.filter((x) => x !== m) : p.mods.concat(m), visiveis: POR_LOTE })),
      toggleArea: (a) => set((p) => ({ areas: p.areas.includes(a) ? p.areas.filter((x) => x !== a) : p.areas.concat(a), visiveis: POR_LOTE })),
      setJanela: (v) => set({ janela: v, visiveis: POR_LOTE }),
      limparFiltros: () => set({ ...FILTROS_PADRAO, visiveis: POR_LOTE }),
      setOrd: (v) => set({ ord: v }),
      carregarMais: () => set((p) => ({ visiveis: p.visiveis + POR_LOTE })),

      // Vagas
      abrirVaga: (id) => comTransicao(() => set({ view: 'vagas', sel: id, menuAberto: false })),
      /** Seleção automática da primeira vaga no desktop: não cria entrada no histórico. */
      selecionarSemHistorico: (id) => { substituirHistorico.current = true; set({ sel: id }); },
      fecharVaga: () => comTransicao(() => set({ sel: null })),
      toggleSalvar: (id) => set((p) => ({ salvas: p.salvas.includes(id) ? p.salvas.filter((x) => x !== id) : p.salvas.concat(id) })),
      /** Anotação do aluno. O StartMe não envia nada nem acompanha o processo seletivo. */
      toggleAplicada: (vaga, jaMarcada) => {
        set((p) => ({ aplicadas: jaMarcada ? p.aplicadas.filter((id) => id !== vaga.id) : p.aplicadas.concat(vaga.id) }));
        mostrarToast(jaMarcada ? 'Anotação removida.' : 'Anotado. A candidatura em si acontece no site da empresa.');
      },
      toggleMarcada: (m) => set((p) => ({ marcadas: p.marcadas.includes(m) ? p.marcadas.filter((x) => x !== m) : p.marcadas.concat(m), visiveis: POR_LOTE })),

      // Currículo — mudanças de texto só salvam; mudanças de habilidade recalculam o match.
      setContato: (campo, valor) => set((p) => ({ curriculo: { ...p.curriculo, contato: { ...p.curriculo.contato, [campo]: valor } } })),
      setResumo: (valor) => set((p) => ({ curriculo: { ...p.curriculo, resumo: valor.slice(0, 480) } })),
      addCertificacao: (c) => mudarCurriculo((cv) => ({ ...cv, certificacoes: [...cv.certificacoes, { ...c, id: novoId('c') }] }), `Certificação "${c.nome}" adicionada.`),
      removerCertificacao: (id) => mudarCurriculo((cv) => ({ ...cv, certificacoes: cv.certificacoes.filter((c) => c.id !== id) }), 'Certificação removida.'),
      addAtividade: (at) => mudarCurriculo((cv) => ({ ...cv, atividades: [...cv.atividades, { ...at, id: novoId('a') }] }), `"${at.titulo}" adicionada.`),
      removerAtividade: (id) => mudarCurriculo((cv) => ({ ...cv, atividades: cv.atividades.filter((x) => x.id !== id) }), 'Atividade removida.'),
      addIdioma: (i) => set((p) => ({ curriculo: { ...p.curriculo, idiomas: [...p.curriculo.idiomas, { ...i, id: novoId('i') }] } })),
      removerIdioma: (id) => set((p) => ({ curriculo: { ...p.curriculo, idiomas: p.curriculo.idiomas.filter((x) => x.id !== id) } })),
      /**
       * "Eu sei X" não grava direto: leva ao currículo com o formulário da
       * habilidade aberto e o nome preenchido, para o aluno informar nível,
       * onde aprendeu e, se quiser, anexar o certificado.
       * `dados` pode trazer uma habilidade existente (edição); `origemVaga`
       * guarda a vaga de onde o aluno veio, para oferecer a volta.
       */
      abrirHabilidade: (dados = {}, origemVaga = null) => {
        const existente = dados.id ? null
          : estadoAtual.current.curriculo.habilidadesDeclaradas.find((h) => dados.nome && normalizar(h.nome) === normalizar(dados.nome));
        set({
          view: 'curriculo', sel: null, menuAberto: false,
          habilidadeEmEdicao: {
            id: null, nome: '', nivel: '', onde: '', ano: '', arquivo: '', ...(existente || dados), origemVaga, abertoEm: Date.now(),
          },
        });
      },
      fecharHabilidade: () => set({ habilidadeEmEdicao: null }),
      salvarHabilidade: ({ origemVaga, abertoEm, ...dados }) => {
        const nome = dados.nome.trim();
        if (!nome || !dados.nivel) return;
        mudarCurriculo((cv) => {
          const lista = dados.id
            ? cv.habilidadesDeclaradas.map((h) => (h.id === dados.id ? { ...dados, nome } : h))
            : [...cv.habilidadesDeclaradas.filter((h) => normalizar(h.nome) !== normalizar(nome)), { ...dados, nome, id: novoId('h') }];
          return { ...cv, habilidadesDeclaradas: lista };
        },
        dados.id ? `${nome} atualizada.` : `${nome} entrou no seu currículo.`,
        origemVaga ? { rotulo: 'Voltar para a vaga', view: 'vagas', sel: origemVaga } : undefined);
        set({ habilidadeEmEdicao: null });
      },
      removerHabilidade: (id) => mudarCurriculo((cv) => ({ ...cv, habilidadesDeclaradas: cv.habilidadesDeclaradas.filter((h) => h.id !== id) }), 'Habilidade removida.'),
      restaurarCurriculo: () => mudarCurriculo(() => CURRICULO_SEED, 'Currículo de demonstração restaurado.'),
    };
  }, [set]);

  const valor = useMemo(() => ({ s, a: actions, perfil }), [s, actions, perfil]);
  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp precisa estar dentro de AppProvider');
  return ctx;
}
