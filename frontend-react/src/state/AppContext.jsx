// Estado e ações da aplicação.
// A tela atual e a vaga aberta ficam na URL (#/vagas/v3): o botão Voltar do
// navegador funciona, e um link para uma vaga pode ser compartilhado.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { CAMPOS_ACADEMICOS_MOCK, CPF_DEMO, SEMESTRE_ALUNO_MOCK, SENHA_DEMO, VAGAS } from '../data/mock.js';
import { CURRICULO_SEED } from '../data/curriculo-seed.js';
import { fetchAlunoDemo, fetchVagas, gravarLocal, lerLocal } from '../lib/api.js';
import { montarPerfil, normalizar, vagasQueMudaram } from '../lib/match.js';

const CHAVE_CURRICULO = 'startme:curriculo';
const CHAVE_SALVAS = 'startme:salvas';
const CHAVE_APLICADAS = 'startme:aplicadas';

export const FILTROS_PADRAO = { q: '', faixa: 'todas', mods: [], areas: [], compatOnly: false, janela: '30', marcadas: [] };
export const POR_LOTE = 10;

/** Máscara de CPF: 000.000.000-00 */
export function mascaraCpf(valor) {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length > 9) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  if (d.length > 6) return d.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  if (d.length > 3) return d.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  return d;
}

// --- Rotas ------------------------------------------------------------------
const ROTAS = { portal: 'portal', autorizacao: 'consent', inicio: 'inicio', vagas: 'vagas', curriculo: 'curriculo' };
const HASH_DA_VIEW = Object.fromEntries(Object.entries(ROTAS).map(([hash, view]) => [view, hash]));
// Endereço antigo: a aba "Candidaturas" virou "Meu currículo" em 07/10/2026.
ROTAS.candidaturas = 'curriculo';

function lerHash() {
  const [, rota = 'portal', sel = null] = window.location.hash.replace(/^#/, '').split('/');
  return { view: ROTAS[rota] || 'portal', sel: rota === 'vagas' ? sel : null };
}
function montarHash(view, sel) {
  return `#/${HASH_DA_VIEW[view] || 'portal'}${view === 'vagas' && sel ? `/${sel}` : ''}`;
}

/** Executa a atualização dentro de uma View Transition quando o navegador oferece. */
function comTransicao(atualizar) {
  if (typeof document !== 'undefined' && document.startViewTransition
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(() => flushSync(atualizar));
  } else {
    atualizar();
  }
}

function novoId(prefixo) {
  return `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Currículos salvos antes de 08/10 guardavam habilidades como texto solto. */
function normalizarHabilidades(lista) {
  return (lista || []).map((h) => (typeof h === 'string'
    ? { id: novoId('h'), nome: h, nivel: '', onde: '', ano: '', arquivo: '' }
    : h));
}

function carregarCurriculo() {
  const cv = { ...CURRICULO_SEED, ...lerLocal(CHAVE_CURRICULO, {}) };
  return { ...cv, habilidadesDeclaradas: normalizarHabilidades(cv.habilidadesDeclaradas) };
}

function estadoInicial() {
  const rota = lerHash();
  return {
    view: rota.view,
    sel: rota.sel,
    menuAberto: false,
    notasAbertas: false,
    toast: null,

    cpf: '',
    senha: '',
    verSenha: false,
    erroLogin: false,

    ...FILTROS_PADRAO,
    ord: 'compat',
    visiveis: POR_LOTE,

    salvas: lerLocal(CHAVE_SALVAS, ['v4']),
    aplicadas: lerLocal(CHAVE_APLICADAS, []),
    curriculo: carregarCurriculo(),
    habilidadeEmEdicao: null,

    vagas: VAGAS.map((v) => ({ ...v })),
    vagasFonte: 'mock',
    vagasCarregando: true,
    campos: CAMPOS_ACADEMICOS_MOCK,
    academicoFonte: 'mock',
    semestreAluno: SEMESTRE_ALUNO_MOCK,
  };
}

const AppContext = createContext(null);

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
      sair: () => set({ view: 'portal', sel: null, menuAberto: false, cpf: '', senha: '', erroLogin: false }),

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
      entrar: () => set((p) => (
        p.cpf === CPF_DEMO && p.senha === SENHA_DEMO ? { view: 'consent', erroLogin: false } : { erroLogin: true }
      )),

      // Consentimento
      autorizar: () => {
        set({ view: 'inicio' });
        mostrarToast('Autorização concedida. O StartMe recebeu vínculo, nome, curso e semestre, e nada além disso.');
      },
      naoAutorizar: () => {
        set({ view: 'portal', cpf: '', senha: '' });
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
