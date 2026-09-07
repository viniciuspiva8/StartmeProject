// Camada de acesso a dados do StartMe.
//
// Regra geral: NENHUMA falha de rede pode quebrar a interface. Os dois
// backends (coletor e cadastro) muito provavelmente não estarão rodando
// quando esta demo for aberta — todo fetch aqui tem try/catch e cai de volta
// para os dados mock de js/mock-data.js, sinalizando a origem (`fonte`) para
// quem consome, para a UI poder mostrar um aviso discreto quando aplicável.
"use strict";

const Api = (function () {

  /** Escapa texto vindo de dado coletado/dinâmico antes de ir para o DOM.
   *  Mesmo padrão de coletor/web/script.js — requisito de segurança do projeto. */
  function esc(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  /** Só aceita links http(s) — evita javascript: vindo de dado coletado.
   *  Mesmo padrão de coletor/web/script.js. */
  function linkSeguro(url) {
    try {
      const u = new URL(url, CONFIG.COLETOR_URL);
      return (u.protocol === "http:" || u.protocol === "https:") ? u.href : "#";
    } catch {
      return "#";
    }
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("tempo esgotado")), ms))
    ]);
  }

  // --------------------------------------------------------------------
  // Vagas — GET {COLETOR_URL}/api/vagas (Firestore, via coletor/main.py)
  // --------------------------------------------------------------------
  // Contrato real devolvido pelo coletor: { id, titulo, empresa, link,
  // data_coleta, descricao, salario }. Os campos de compatibilidade
  // (modalidade/area/semestreMin/pct/criterios/razao) NÃO existem nesse
  // contrato — são inteiramente inventados pelo design para ilustrar uma
  // feature que ainda não tem regra de cálculo definida pelo time (ver
  // Prancha 6 / views.js:renderDetalhe, aviso "Regra de cálculo pendente").
  // Quando a coleta real responde, nós os derivamos aqui no cliente com uma
  // heurística simples de palavra-chave, claramente sinalizada como estimada.
  function derivarAreaDoTitulo(texto) {
    const t = texto.toLowerCase();
    if (/\bqa\b|teste|qualidade/.test(t)) return 'QA';
    if (/dados|data|analytics|\bbi\b|business intelligence/.test(t)) return 'Dados';
    if (/infra|rede|servidor|devops|infraestrutura/.test(t)) return 'Infraestrutura';
    if (/suporte|helpdesk|atendimento/.test(t)) return 'Suporte';
    return 'Desenvolvimento';
  }

  function derivarModalidade(texto) {
    const t = texto.toLowerCase();
    if (/remoto|home ?office/.test(t)) return 'Remoto';
    if (/híbrid|hibrid/.test(t)) return 'Híbrido';
    return 'Presencial';
  }

  function diasDesde(dataIso) {
    if (!dataIso) return 0;
    const d = new Date(dataIso);
    if (Number.isNaN(d.getTime())) return 0;
    const diffMs = Date.now() - d.getTime();
    return Math.max(0, Math.round(diffMs / 86400000));
  }

  /** Enriquece uma vaga REAL (vinda do coletor) com os campos mock/derivados
   *  que a interface de compatibilidade precisa, marcando-os como estimados. */
  function enriquecerVagaReal(v) {
    const base = `${v.titulo || ''} ${v.descricao || ''}`;
    return {
      id: v.id,
      titulo: v.titulo || 'Vaga sem título na origem',
      empresa: v.empresa || 'Empresa não informada',
      link: v.link || '',
      salario: v.salario || '',
      dataColeta: v.data_coleta || '',
      dias: diasDesde(v.data_coleta),
      descricao: v.descricao || '',
      modalidade: derivarModalidade(base),
      area: derivarAreaDoTitulo(base),
      semestreMin: 1,
      pct: 50,
      razao: 'Compatibilidade não calculada pela coleta real — estimativa neutra até a regra ser definida pelo time.',
      criterios: [
        { texto: 'A vaga coletada não tem campo de competências: não é possível gerar critérios detalhados (ver aviso na Prancha 6).', positivo: false }
      ],
      _fonte: 'coletor'
    };
  }

  async function fetchVagas() {
    try {
      const resposta = await withTimeout(fetch(`${CONFIG.COLETOR_URL}/api/vagas`), 6000);
      if (!resposta.ok) throw new Error(`servidor respondeu ${resposta.status}`);
      const dados = await resposta.json();
      if (!Array.isArray(dados) || dados.length === 0) {
        throw new Error('coleta real vazia');
      }
      return { fonte: 'coletor', vagas: dados.map(enriquecerVagaReal) };
    } catch (erro) {
      console.warn('StartMe: coletor indisponível, usando dados de demonstração.', erro);
      return { fonte: 'mock', vagas: VAGAS.map((v) => ({ ...v, _fonte: 'mock' })) };
    }
  }

  // --------------------------------------------------------------------
  // Aluno — GET {CADASTRO_URL}/alunos/:id (MySQL, via cadastro/backend/server.js)
  // --------------------------------------------------------------------
  // A tabela Aluno só tem Id_Aluno, Nome, CPF, RG, Idade, Data_Nascimento,
  // Semestre, Id_Curso — sem e-mail/telefone/github/linkedin/disponibilidade.
  // Por isso só os "Dados acadêmicos" da Prancha 9 tentam vir daqui; os
  // "Dados de contato" continuam mock (ver getPerfil/salvarPerfil abaixo).
  async function fetchAlunoDemo() {
    try {
      const respAluno = await withTimeout(fetch(`${CONFIG.CADASTRO_URL}/alunos/${CONFIG.ID_ALUNO_DEMO}`), 5000);
      if (!respAluno.ok) throw new Error(`servidor respondeu ${respAluno.status}`);
      const linhas = await respAluno.json();
      const aluno = Array.isArray(linhas) ? linhas[0] : linhas;
      if (!aluno || !aluno.Nome) throw new Error('aluno de demonstração não encontrado');

      let nomeCurso = `Curso #${aluno.Id_Curso}`;
      let qtdSemestre = null;
      try {
        const respCurso = await withTimeout(fetch(`${CONFIG.CADASTRO_URL}/cursos/${aluno.Id_Curso}`), 5000);
        if (respCurso.ok) {
          const linhasCurso = await respCurso.json();
          const curso = Array.isArray(linhasCurso) ? linhasCurso[0] : linhasCurso;
          if (curso && curso.Nome) {
            nomeCurso = curso.Nome;
            qtdSemestre = curso.Qtd_Semestre || null;
          }
        }
      } catch (erroCurso) {
        console.warn('StartMe: não foi possível carregar o curso do aluno de demonstração.', erroCurso);
      }

      const semestre = Number(aluno.Semestre) || SEMESTRE_ALUNO_MOCK;
      return {
        fonte: 'cadastro',
        semestreAluno: semestre,
        campos: [
          { rotulo: 'Nome completo', valor: aluno.Nome },
          { rotulo: 'Curso', valor: nomeCurso },
          { rotulo: 'Semestre', valor: qtdSemestre ? `${semestre}º de ${qtdSemestre}` : `${semestre}º semestre` },
          { rotulo: 'Situação do vínculo', valor: 'Ativo' }
        ]
      };
    } catch (erro) {
      console.warn('StartMe: cadastro indisponível, usando dados acadêmicos de demonstração.', erro);
      return { fonte: 'mock', semestreAluno: SEMESTRE_ALUNO_MOCK, campos: CAMPOS_ACADEMICOS_MOCK };
    }
  }

  // --------------------------------------------------------------------
  // Persistência local (localStorage) — tudo aqui é mock por definição do
  // projeto (não existe endpoint real para nenhum destes três recursos),
  // mas persiste entre recarregamentos para a jornada da demo ficar coerente.
  // --------------------------------------------------------------------
  const CHAVE_PERFIL = 'startme:perfil';
  const CHAVE_CANDIDATURAS = 'startme:candidaturas';
  const CHAVE_CERTIFICADOS = 'startme:certificados';

  function lerJson(chave, padrao) {
    try {
      const bruto = window.localStorage.getItem(chave);
      if (!bruto) return padrao;
      const valor = JSON.parse(bruto);
      return valor ?? padrao;
    } catch (erro) {
      console.warn(`StartMe: não foi possível ler ${chave} do localStorage.`, erro);
      return padrao;
    }
  }

  function gravarJson(chave, valor) {
    try {
      window.localStorage.setItem(chave, JSON.stringify(valor));
    } catch (erro) {
      console.warn(`StartMe: não foi possível gravar ${chave} no localStorage.`, erro);
    }
  }

  function getPerfil() {
    return { ...PERFIL_PADRAO, ...lerJson(CHAVE_PERFIL, {}) };
  }
  function salvarPerfil(perfil) {
    gravarJson(CHAVE_PERFIL, perfil);
  }

  /** Retorna { candidaturas, aplicadas } já mesclado com a seed na primeira leitura. */
  function getCandidaturasState() {
    const padrao = { candidaturas: CANDIDATURAS_SEED, aplicadas: ['v2', 'v4', 'v5', 'v1'] };
    return lerJson(CHAVE_CANDIDATURAS, padrao);
  }
  function salvarCandidaturasState(estado) {
    gravarJson(CHAVE_CANDIDATURAS, estado);
  }

  function gerarProtocolo() {
    const n = Math.floor(1000 + Math.random() * 9000);
    return `SM-2026-${n}`;
  }

  function hojeFormatado() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  /** Cria uma nova candidatura mock a partir de uma vaga e devolve o estado já persistido. */
  function registrarCandidatura(vaga) {
    const estado = getCandidaturasState();
    if (estado.aplicadas.includes(vaga.id)) return estado; // já registrada
    const nova = {
      protocolo: gerarProtocolo(),
      vagaId: vaga.id,
      titulo: vaga.titulo,
      empresa: vaga.empresa,
      link: vaga.link,
      data: hojeFormatado(),
      status: 'enviada',
      etapas: [
        { nome: 'Candidatura enviada', quando: hojeFormatado(), feita: true },
        { nome: 'Em análise pela empresa', quando: '—', feita: false },
        { nome: 'Resultado final', quando: '—', feita: false }
      ]
    };
    const novoEstado = {
      candidaturas: [nova, ...estado.candidaturas],
      aplicadas: estado.aplicadas.concat(vaga.id)
    };
    salvarCandidaturasState(novoEstado);
    return novoEstado;
  }

  /** Desmarca "já me candidatei". Candidaturas da seed original só saem da
   *  lista de "aplicadas" (o card volta a mostrar "Candidatar-se"); a
   *  candidatura em si permanece em Minhas Candidaturas, pois representa um
   *  protocolo já emitido. Candidaturas criadas pelo próprio usuário nesta
   *  demo são removidas por completo, já que o protocolo nunca existiu de fato. */
  function desfazerCandidatura(vagaId) {
    const estado = getCandidaturasState();
    const eraSeed = CANDIDATURAS_SEED.some((s) => s.vagaId === vagaId);
    const novoEstado = {
      candidaturas: eraSeed ? estado.candidaturas : estado.candidaturas.filter((c) => c.vagaId !== vagaId),
      aplicadas: estado.aplicadas.filter((id) => id !== vagaId)
    };
    salvarCandidaturasState(novoEstado);
    return novoEstado;
  }

  function getCertificados() {
    return lerJson(CHAVE_CERTIFICADOS, CERTIFICADOS_SEED);
  }
  function salvarCertificados(lista) {
    gravarJson(CHAVE_CERTIFICADOS, lista);
  }

  return {
    esc, linkSeguro,
    fetchVagas, fetchAlunoDemo,
    getPerfil, salvarPerfil,
    getCandidaturasState, salvarCandidaturasState, registrarCandidatura, desfazerCandidatura,
    getCertificados, salvarCertificados
  };
})();
