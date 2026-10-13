// Camada de acesso a dados. Nenhuma falha de rede pode quebrar a interface:
// todo fetch tem timeout e cai para os dados de demonstração em src/data/mock.js,
// sinalizando a origem (`fonte`) para a tela mostrar um aviso discreto.
// (Versão original em JS puro: tag legado-pre-react.)
import { CONFIG } from '../config.js';
import { VAGAS } from '../data/mock.js';
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
