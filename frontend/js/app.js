// StartMe — state machine e renderização das 13 pranchas, em JS vanilla.
//
// Portado do <script data-dc-script> do protótipo proprietário
// (design-reference/StartMe.dc.html), que usava uma classe `Component
// extends DCLogic` só executável dentro do editor de canvas da Anthropic.
// Aqui a mesma lógica de estado (filtros, ordenação, paginação, cálculo de
// "compatibilidade" mock) vira um objeto `App` comum: `App.state` guarda o
// estado, `App.setState(patch)` mescla e re-renderiza, e cada tela tem uma
// função `renderX(state)` que devolve uma string HTML injetada via innerHTML.
//
// Sem framework, sem build step: basta abrir index.html com um servidor
// estático (Live Server, `npx serve frontend`) — ver README.md.
"use strict";

const App = (function () {
  const els = {};

  // ------------------------------------------------------------------
  // Estado inicial
  // ------------------------------------------------------------------
  const candState = Api.getCandidaturasState();

  const state = {
    view: 'portal', sel: 'v1', menuAberto: false, aviso: '',

    // Filtros e listagem (Prancha 5)
    q: '', faixa: 'todas', mods: [], areas: [], compatOnly: false, janela: '30',
    ord: 'compat', pagina: 1, visiveis: POR_PAGINA,

    salvas: ['v4'],
    modal: null,
    notasOverride: null, navRecolhida: false,

    // Login (Prancha 2)
    cpf: '', senha: '', verSenha: false, erroLogin: false,

    // Candidaturas (Prancha 8)
    statusFiltro: 'todos', candAberta: null,
    candidaturas: candState.candidaturas,
    aplicadas: candState.aplicadas,

    // Perfil (Prancha 9)
    perfil: Api.getPerfil(),
    interesses: INTERESSES_PADRAO.slice(),
    perfilRascunho: null,

    // Certificados (Prancha 12/13)
    certificados: Api.getCertificados(),

    // Vagas — carregadas de forma otimista com o mock, substituídas se o
    // coletor real responder (ver carregarVagas() no fim deste arquivo).
    vagas: VAGAS.map((v) => ({ ...v, _fonte: 'mock' })),
    vagasFonte: 'mock',
    vagasCarregando: true,

    // Dados acadêmicos — idem, otimista com o mock, substituídos se o
    // cadastro real responder (ver carregarAcademico()).
    academicoCampos: CAMPOS_ACADEMICOS_MOCK,
    academicoFonte: 'mock',
    semestreAluno: SEMESTRE_ALUNO_MOCK,
    academicoCarregando: true
  };

  function setState(patch) {
    const parcial = typeof patch === 'function' ? patch(state) : patch;
    Object.assign(state, parcial);
    render();
  }

  // ------------------------------------------------------------------
  // Helpers de domínio (equivalentes aos métodos da classe Component original)
  // ------------------------------------------------------------------
  function mascaraCpf(v) {
    const d = v.replace(/\D/g, '').slice(0, 11);
    let out = d;
    if (d.length > 9) out = d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (d.length > 6) out = d.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (d.length > 3) out = d.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    return out;
  }

  function salarioMin(v) {
    const nums = (v.salario || '').replace(/\./g, '').match(/\d+/g);
    if (!nums) return null;
    return parseInt(nums[0], 10);
  }

  function quando(d) {
    if (d === 0) return 'hoje';
    if (d === 1) return 'ontem';
    return 'há ' + d + ' dias';
  }

  function passaFiltro(v) {
    if (state.q) {
      const alvo = (v.titulo + ' ' + v.empresa + ' ' + v.descricao).toLowerCase();
      if (!alvo.includes(state.q.toLowerCase())) return false;
    }
    if (state.compatOnly && v.semestreMin > state.semestreAluno) return false;
    if (state.compatOnly && v.pct < 70) return false;
    if (state.mods.length && !state.mods.includes(v.modalidade)) return false;
    if (state.areas.length && !state.areas.includes(v.area)) return false;
    if (parseInt(state.janela, 10) === 1 && v.dias > 0) return false;
    if (parseInt(state.janela, 10) === 7 && v.dias > 7) return false;
    if (state.faixa !== 'todas') {
      const min = salarioMin(v);
      if (state.faixa === 'sem') { if (min !== null) return false; }
      else if (min === null) return false;
      else if (state.faixa === 'ate1500' && min > 1500) return false;
      else if (state.faixa === '1500a2000' && (min < 1500 || min > 2000)) return false;
      else if (state.faixa === 'acima2000' && min <= 2000) return false;
    }
    return true;
  }

  function enfeitar(v) {
    const aplicada = state.aplicadas.includes(v.id);
    const salva = state.salvas.includes(v.id);
    return {
      ...v,
      monograma: v.empresa.trim().charAt(0).toUpperCase(),
      quandoTxt: quando(v.dias),
      temSalario: !!v.salario, semSalario: !v.salario,
      compatAlta: v.pct >= 80, compatMedia: v.pct >= 60 && v.pct < 80, compatBaixa: v.pct < 60,
      nivel: v.pct >= 80 ? 'Alta compatibilidade com o seu momento no curso' : (v.pct >= 60 ? 'Compatibilidade parcial — leia as ressalvas' : 'Distante do seu momento no curso'),
      largura: v.pct + '%',
      aplicada, salva,
      temDescricao: !!v.descricao, semDescricao: !v.descricao,
      criterios: (v.criterios || []).map((c) => ({ ...c, negativo: !c.positivo })),
      rotuloCompat: v.pct + (v.pct >= 80 ? '% compatível' : (v.pct >= 60 ? '% parcial' : '% distante'))
    };
  }

  function vagaPorId(id) {
    return state.vagas.find((v) => v.id === id) || state.vagas[0];
  }

  function listaFiltrada() {
    let lista = state.vagas.filter(passaFiltro);
    if (state.ord === 'compat') lista = lista.slice().sort((a, b) => b.pct - a.pct);
    if (state.ord === 'recentes') lista = lista.slice().sort((a, b) => a.dias - b.dias);
    if (state.ord === 'salario') lista = lista.slice().sort((a, b) => (salarioMin(b) ?? -1) - (salarioMin(a) ?? -1));
    return lista;
  }

  function notasVisiveis() {
    return state.notasOverride === null ? true : state.notasOverride;
  }

  // ------------------------------------------------------------------
  // Ações — expostas como App.* e chamadas via atributos onclick/oninput
  // gerados pelas próprias funções de render (ex.: onclick="App.abrirVaga('v3')").
  // ------------------------------------------------------------------
  function irView(v) { setState({ view: v, menuAberto: false, aviso: '' }); }
  function toggleMenu() { setState({ menuAberto: !state.menuAberto }); }
  function toggleNav() { setState({ navRecolhida: !state.navRecolhida }); }
  function toggleNotas() { setState({ notasOverride: !notasVisiveis() }); }
  function fecharAviso() { setState({ aviso: '' }); }
  function nadaAinda() {
    setState({ aviso: 'Ação ilustrativa desta prancha — o comportamento real depende do endpoint correspondente, listado em "Contratos de API" na Prancha 11.' });
  }

  // Prancha 1
  function portalClicar(nome) {
    if (nome === 'PROJETO STARTME') { setState({ view: 'login', aviso: '' }); return; }
    setState({ aviso: 'Este cartão faz parte do ambiente simulado do portal e não abre nada — só o cartão PROJETO STARTME é funcional na demonstração.' });
  }

  // Prancha 2
  function setCpf(valor) { setState({ cpf: mascaraCpf(valor), erroLogin: false }); }
  function setSenha(valor) { setState({ senha: valor, erroLogin: false }); }
  function toggleSenha() { setState({ verSenha: !state.verSenha }); }
  function preencherDemo() { setState({ cpf: CPF_DEMO, senha: SENHA_DEMO, erroLogin: false }); }
  function entrar() {
    if (state.cpf === CPF_DEMO && state.senha === SENHA_DEMO) setState({ view: 'consent', erroLogin: false });
    else setState({ erroLogin: true });
  }

  // Prancha 3
  function autorizar() { setState({ view: 'home', aviso: 'Autorização concedida. O StartMe recebeu vínculo, nome, curso e semestre — e nada além disso.' }); }
  function naoAutorizar() { setState({ view: 'excecoes', aviso: 'Você recusou o compartilhamento. É o estado 6 da Prancha 10, abaixo — com caminho para autorizar depois.' }); }

  // Filtros (Prancha 5)
  function setQ(valor) { setState({ q: valor, pagina: 1, visiveis: POR_PAGINA }); }
  function toggleCompat() { setState({ compatOnly: !state.compatOnly, pagina: 1 }); }
  function setFaixa(v) { setState({ faixa: v, pagina: 1 }); }
  function toggleModalidade(m) {
    setState({ mods: state.mods.includes(m) ? state.mods.filter((x) => x !== m) : state.mods.concat(m), pagina: 1 });
  }
  function toggleArea(a) {
    setState({ areas: state.areas.includes(a) ? state.areas.filter((x) => x !== a) : state.areas.concat(a), pagina: 1 });
  }
  function setJanela(v) { setState({ janela: v, pagina: 1 }); }
  function limparFiltros() { setState({ q: '', faixa: 'todas', mods: [], areas: [], compatOnly: false, janela: '30', pagina: 1, visiveis: POR_PAGINA }); }
  function setOrd(v) { setState({ ord: v, pagina: 1 }); }
  function irPagina(n) { setState({ pagina: n }); }
  function paginaAnterior() { setState({ pagina: Math.max(1, state.pagina - 1) }); }
  function paginaProxima() {
    const total = listaFiltrada().length;
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    setState({ pagina: Math.min(totalPaginas, state.pagina + 1) });
  }
  function carregarMais() { setState({ visiveis: state.visiveis + POR_PAGINA }); }

  // Vagas
  function abrirVaga(id) { setState({ view: 'detalhe', sel: id, menuAberto: false }); }
  function toggleSalvar(id) {
    setState({ salvas: state.salvas.includes(id) ? state.salvas.filter((x) => x !== id) : state.salvas.concat(id) });
  }
  function toggleAplicada() {
    const id = state.sel;
    const ja = state.aplicadas.includes(id);
    if (ja) {
      const novoEstado = Api.desfazerCandidatura(id);
      setState({ aplicadas: novoEstado.aplicadas, candidaturas: novoEstado.candidaturas, modal: null });
    } else {
      const novoEstado = Api.registrarCandidatura(vagaPorId(id));
      setState({ aplicadas: novoEstado.aplicadas, candidaturas: novoEstado.candidaturas, modal: 'ok' });
    }
  }
  function fecharModal() { setState({ modal: null }); }
  function verCandidaturas() { setState({ modal: null, view: 'candidaturas' }); }
  function continuarBuscando() { setState({ modal: null, view: 'lista' }); }

  // Candidaturas (Prancha 8)
  function setStatusFiltro(v) { setState({ statusFiltro: v, candAberta: null }); }
  function limparStatus() { setState({ statusFiltro: 'todos' }); }
  function toggleCandAberta(protocolo) { setState({ candAberta: state.candAberta === protocolo ? null : protocolo }); }

  // Perfil (Prancha 9)
  function garantirRascunho() {
    if (!state.perfilRascunho) state.perfilRascunho = { ...state.perfil };
    return state.perfilRascunho;
  }
  function setPerfilCampo(campo, valor) {
    const rascunho = garantirRascunho();
    rascunho[campo] = valor;
    setState({ perfilRascunho: { ...rascunho } });
  }
  function salvarPerfilForm() {
    const novo = state.perfilRascunho ? { ...state.perfil, ...state.perfilRascunho } : state.perfil;
    Api.salvarPerfil(novo);
    setState({ perfil: novo, perfilRascunho: null, aviso: 'Dados de contato salvos neste navegador (localStorage) — não existe coluna para eles no schema relacional do cadastro.' });
  }
  function descartarPerfilForm() { setState({ perfilRascunho: null }); }
  function toggleInteresse(a) {
    setState({ interesses: state.interesses.includes(a) ? state.interesses.filter((x) => x !== a) : state.interesses.concat(a) });
  }
  function revogar() { setState({ view: 'excecoes', aviso: 'Autorização revogada. O aluno cai no estado 6 abaixo: o produto continua, sem compatibilidade.' }); }

  // Certificados (Prancha 13)
  function toggleCertificado(id) {
    const lista = state.certificados.map((c) => c.id === id ? { ...c, incluido: !c.incluido } : c);
    Api.salvarCertificados(lista);
    setState({ certificados: lista });
  }

  // Navegação utilitária (Prancha 10 e menus)
  function irLogin() { setState({ view: 'login', cpf: '', senha: '', erroLogin: false, aviso: '' }); }
  function irConsent() { setState({ view: 'consent', aviso: '' }); }
  function irListaLimpa() { setState({ view: 'lista', q: '', faixa: 'todas', mods: [], areas: [], compatOnly: false, janela: '30', pagina: 1, aviso: '' }); }

  // ------------------------------------------------------------------
  // Render — monta o HTML da tela atual e injeta em #app
  // ------------------------------------------------------------------
  function render() {
    const appEl = els.app;
    if (!appEl) return;

    let focusInfo = null;
    const ativo = document.activeElement;
    if (ativo && appEl.contains(ativo) && ativo.id) {
      focusInfo = { id: ativo.id, start: ativo.selectionStart, end: ativo.selectionEnd };
    }

    appEl.innerHTML = renderShell();

    if (focusInfo) {
      const el = document.getElementById(focusInfo.id);
      if (el) {
        el.focus();
        if (typeof el.setSelectionRange === 'function' && focusInfo.start != null) {
          try { el.setSelectionRange(focusInfo.start, focusInfo.end); } catch (e) { /* input sem seleção de texto */ }
        }
      }
    }
  }

  function init() {
    els.app = document.getElementById('app');
    render();
    carregarVagas();
    carregarAcademico();
  }

  async function carregarVagas() {
    const resultado = await Api.fetchVagas();
    setState({ vagas: resultado.vagas, vagasFonte: resultado.fonte, vagasCarregando: false });
  }

  async function carregarAcademico() {
    const resultado = await Api.fetchAlunoDemo();
    setState({ academicoCampos: resultado.campos, academicoFonte: resultado.fonte, semestreAluno: resultado.semestreAluno, academicoCarregando: false });
  }

  return {
    init, setState, state,
    irView, toggleMenu, toggleNav, toggleNotas, fecharAviso, nadaAinda,
    portalClicar,
    setCpf, setSenha, toggleSenha, preencherDemo, entrar,
    autorizar, naoAutorizar,
    setQ, toggleCompat, setFaixa, toggleModalidade, toggleArea, setJanela, limparFiltros, setOrd,
    irPagina, paginaAnterior, paginaProxima, carregarMais,
    abrirVaga, toggleSalvar, toggleAplicada, fecharModal, verCandidaturas, continuarBuscando,
    setStatusFiltro, limparStatus, toggleCandAberta,
    setPerfilCampo, salvarPerfilForm, descartarPerfilForm, toggleInteresse, revogar,
    toggleCertificado,
    irLogin, irConsent, irListaLimpa,
    // expostos para views.js
    _internal: {
      enfeitar, vagaPorId, listaFiltrada, notasVisiveis, quando, salarioMin
    }
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
