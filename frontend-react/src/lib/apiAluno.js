// Cliente da API do aluno (/api/auth, /api/me, /api/publico). Usa o cookie HttpOnly da sessão.
// Erros viram ErroApi com um código estável (o servidor manda `detail.codigo`); falha de rede é 'rede'.
import { CONFIG } from '../config.js';

export class ErroApi extends Error {
  constructor(codigo, status, extra = {}) {
    super(codigo);
    this.codigo = codigo;
    this.status = status;
    this.extra = extra;
  }
}

export async function chamar(caminho, { metodo = 'GET', corpo, timeout = 6000 } = {}) {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), timeout);
  try {
    const resposta = await fetch(`${CONFIG.COLETOR_URL}${caminho}`, {
      method: metodo,
      credentials: 'include',
      headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
    });
    if (resposta.status === 204) return null;
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new ErroApi(dados?.detail?.codigo || 'erro', resposta.status, dados?.detail || {});
    return dados;
  } catch (erro) {
    if (erro instanceof ErroApi) throw erro;
    throw new ErroApi('rede', 0);
  } finally {
    clearTimeout(relogio);
  }
}

export const apiAluno = {
  config: () => chamar('/api/publico/config', { timeout: 4000 }),
  me: () => chamar('/api/me'),
  entrar: (cpf, senha) => chamar('/api/auth/entrar', { metodo: 'POST', corpo: { cpf, senha }, timeout: 10000 }),
  sair: () => chamar('/api/auth/sair', { metodo: 'POST' }),
  aceitarConsentimento: (versao) => chamar('/api/me/consentimento', { metodo: 'PUT', corpo: { aceito: true, versao } }),
  curriculoObter: () => chamar('/api/me/curriculo'),
  curriculoSalvar: (dados, versao) => chamar('/api/me/curriculo', { metodo: 'PUT', corpo: { dados, versao }, timeout: 10000 }),
  marcacoesObter: () => chamar('/api/me/marcacoes'),
  marcacoesSalvar: (salvas, aplicadas) => chamar('/api/me/marcacoes', { metodo: 'PUT', corpo: { salvas, aplicadas } }),
  revogarConsentimento: () => chamar('/api/me/consentimento', { metodo: 'DELETE' }),
  apagarConta: () => chamar('/api/me', { metodo: 'DELETE' }),
  // Login pela FSA: navegação de página inteira (o IdP precisa do navegador, não de fetch).
  urlLoginFsa: () => `${CONFIG.COLETOR_URL}/api/auth/oidc/iniciar`,
};
