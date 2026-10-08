// Camada de acesso a dados. Nenhuma falha de rede pode quebrar a interface:
// todo fetch tem timeout e cai para os dados de demonstração em src/data/mock.js,
// sinalizando a origem (`fonte`) para a tela mostrar um aviso discreto.
// Portado de frontend/js/api.js.
import { CONFIG } from '../config.js';
import { VAGAS, CAMPOS_ACADEMICOS_MOCK, SEMESTRE_ALUNO_MOCK } from '../data/mock.js';
import { enriquecerVagaReal } from './vagas.js';

/** Só aceita links http(s): evita javascript: vindo de dado coletado. */
export function linkSeguro(url) {
  try {
    const u = new URL(url, CONFIG.COLETOR_URL);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '#';
  } catch {
    return '#';
  }
}

function comTimeout(promessa, ms) {
  return Promise.race([
    promessa,
    new Promise((_, rejeita) => setTimeout(() => rejeita(new Error('tempo esgotado')), ms)),
  ]);
}

/** GET {COLETOR_URL}/api/vagas — contrato real: id, titulo, empresa, link, data_coleta, descricao, salario. */
export async function fetchVagas() {
  try {
    const resposta = await comTimeout(fetch(`${CONFIG.COLETOR_URL}/api/vagas`), 6000);
    if (!resposta.ok) throw new Error(`servidor respondeu ${resposta.status}`);
    const dados = await resposta.json();
    if (!Array.isArray(dados) || dados.length === 0) throw new Error('coleta real vazia');
    return { fonte: 'coletor', vagas: dados.map(enriquecerVagaReal) };
  } catch (erro) {
    console.warn('StartMe: coletor indisponível, usando dados de demonstração.', erro);
    return { fonte: 'mock', vagas: VAGAS.map((v) => ({ ...v })) };
  }
}

/** GET {CADASTRO_URL}/alunos/:id e /cursos/:id — dados acadêmicos da Prancha 9. */
export async function fetchAlunoDemo() {
  try {
    const respAluno = await comTimeout(fetch(`${CONFIG.CADASTRO_URL}/alunos/${CONFIG.ID_ALUNO_DEMO}`), 5000);
    if (!respAluno.ok) throw new Error(`servidor respondeu ${respAluno.status}`);
    const linhas = await respAluno.json();
    const aluno = Array.isArray(linhas) ? linhas[0] : linhas;
    if (!aluno || !aluno.Nome) throw new Error('aluno de demonstração não encontrado');

    let nomeCurso = `Curso #${aluno.Id_Curso}`;
    let qtdSemestre = null;
    try {
      const respCurso = await comTimeout(fetch(`${CONFIG.CADASTRO_URL}/cursos/${aluno.Id_Curso}`), 5000);
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
        { rotulo: 'Situação do vínculo', valor: 'Ativo' },
      ],
    };
  } catch (erro) {
    console.warn('StartMe: cadastro indisponível, usando dados acadêmicos de demonstração.', erro);
    return { fonte: 'mock', semestreAluno: SEMESTRE_ALUNO_MOCK, campos: CAMPOS_ACADEMICOS_MOCK };
  }
}

// ---------------------------------------------------------------------------
// Persistência local. Currículo, vagas salvas e marcações "já me candidatei"
// ainda não têm endpoint: ficam no navegador do aluno. Toda leitura e escrita
// é protegida, porque o localStorage pode estar bloqueado.
// ---------------------------------------------------------------------------
export function lerLocal(chave, padrao) {
  try {
    const bruto = window.localStorage.getItem(chave);
    if (bruto) return JSON.parse(bruto);
  } catch (erro) {
    console.warn(`StartMe: não foi possível ler ${chave} do navegador.`, erro);
  }
  return padrao;
}

export function gravarLocal(chave, valor) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch (erro) {
    console.warn(`StartMe: não foi possível gravar ${chave} no navegador.`, erro);
  }
}
