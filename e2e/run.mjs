// E2E plug-and-play do StartMe: a MESMA aplicação, três configurações, só variáveis de ambiente mudam.
//
//   arquivo-demo  : fonte de alunos em arquivo, login de demonstração (senha)
//   sql-demo      : fonte SQL (Postgres simulado da FSA), login de demonstração
//   http-oidc     : fonte HTTP (API simulada da FSA) e login único (OIDC) contra o IdP simulado
//
// Pré-requisitos: Docker (simulador-fsa sobe com o compose), Node 22, coletor/.venv com as dependências.
// Uso:  cd e2e && npm install && npm run e2e
//
// Não usa o Firestore real: o coletor fala com o emulador (FIRESTORE_EMULATOR_HOST), e a SerpApi nunca é chamada.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PY = process.platform === 'win32'
  ? path.join(RAIZ, 'coletor', '.venv', 'Scripts', 'python.exe')
  : path.join(RAIZ, 'coletor', '.venv', 'bin', 'python');
const CHROME = process.env.CHROME_PATH || (process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : '/usr/bin/google-chrome');
const FRONT = 'http://localhost:4173';
const COLETOR = 'http://localhost:8000';
const EMULADOR = 'localhost:8081';
const PROJETO_EMULADOR = 'startme-local';
const ADMIN = { email: 'admin@startme.test', senha: 'senha-admin-e2e-123' };
const SEGREDO = 'segredo-de-sessao-e2e-com-mais-de-32-bytes';
const PEPPER = 'pepper-de-cpf-e2e-com-mais-de-32-bytes';

const MODOS = {
  'arquivo-demo': {
    AUTH_MODE: 'demo',
    ACADEMICO_PROVIDER: 'arquivo',
  },
  'sql-demo': {
    AUTH_MODE: 'demo',
    ACADEMICO_PROVIDER: 'sql',
    ACADEMICO_SQL_URL: 'postgresql+psycopg://fsa:fsa-simulado@localhost:5433/faculdade_sim',
  },
  'http-oidc': {
    AUTH_MODE: 'oidc',
    ACADEMICO_PROVIDER: 'http',
    ACADEMICO_HTTP_URL: 'http://localhost:8101/fsa/alunos/{cpf}/vinculo',
    ACADEMICO_HTTP_CABECALHOS: '{"X-API-Key":"chave-de-teste-fsa"}',
    ACADEMICO_HTTP_MAPA: '{"nome":"Aluno.Nome","curso":"Matricula.Curso.Nome","semestre":"Matricula.PeriodoAtual","ativo":{"caminho":"Aluno.Situacao","em":["Matriculado"]}}',
    OIDC_ISSUER: 'http://localhost:8102',
    OIDC_CLIENT_ID: 'startme',
    OIDC_CLIENT_SECRET: 'segredo-de-teste-do-startme',
    OIDC_REDIRECT_URI: `${COLETOR}/api/auth/oidc/retorno`,
  },
};

const resultados = [];
function confere(modo, nome, ok, detalhe = '') {
  resultados.push({ modo, nome, ok });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${nome}${detalhe && !ok ? `  (${detalhe})` : ''}`);
}

function sh(comando, args, opcoes = {}) {
  return execFileSync(comando, args, { stdio: 'pipe', encoding: 'utf8', ...opcoes });
}

async function aguardar(url, tentativas = 60) {
  for (let i = 0; i < tentativas; i += 1) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function subirEmulador() {
  try { sh('docker', ['rm', '-f', 'startme-firestore-e2e']); } catch { /* não existia */ }
  sh('docker', ['run', '-d', '--name', 'startme-firestore-e2e', '-p', '8081:8080', '-m', '512m',
    '-e', `FIRESTORE_PROJECT_ID=${PROJETO_EMULADOR}`, 'mtlynch/firestore-emulator']);
}

function subirSimulador() {
  sh('docker', ['compose', 'up', '-d', '--build'], { cwd: path.join(RAIZ, 'simulador-fsa') });
}

function subirColetor(modo) {
  const env = {
    ...process.env,
    ...MODOS[modo],
    SESSAO_SEGREDO: SEGREDO,
    CPF_PEPPER: PEPPER,
    AMBIENTE: 'local',
    FRONT_URL: FRONT,
    ALLOWED_ORIGINS: FRONT,
    FIRESTORE_EMULATOR_HOST: EMULADOR,
    GOOGLE_CLOUD_PROJECT: PROJETO_EMULADOR,
    SCRAPER_TOKEN: 'token-de-teste-e2e',
    SERPAPI_KEY: 'nao-usada-no-e2e',
    SERPAPI_LIMITE_MENSAL: '240',
  };
  const processo = spawn(PY, ['-m', 'uvicorn', 'main:app', '--port', '8000'], {
    cwd: path.join(RAIZ, 'coletor'), env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  processo.stderr.on('data', () => {});
  return processo;
}

function semearAdmin() {
  sh(PY, [path.join(RAIZ, 'e2e', 'semear_admin.py'), ADMIN.email, ADMIN.senha], {
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: EMULADOR, GOOGLE_CLOUD_PROJECT: PROJETO_EMULADOR },
    cwd: path.join(RAIZ, 'coletor'),
  });
}

async function pausa(ms) { await new Promise((r) => setTimeout(r, ms)); }

async function digitar(pagina, seletor, texto) {
  await pagina.waitForSelector(seletor, { timeout: 15000 });
  await pagina.click(seletor, { clickCount: 3 });
  await pagina.type(seletor, texto, { delay: 15 });
}

async function clicarPorTexto(pagina, texto, tipo = 'button') {
  const alvo = await pagina.waitForFunction((t, tp) => [...document.querySelectorAll(tp)]
    .find((el) => el.textContent.trim().includes(t)), { timeout: 15000 }, texto, tipo);
  await alvo.asElement().click();
}

async function cenarioAluno(navegador, modo, comOidc) {
  const contexto = await navegador.createBrowserContext();
  const pagina = await contexto.newPage();
  await pagina.setViewport({ width: 390, height: 844 });
  try {
    await pagina.goto(`${FRONT}/#/portal`, { waitUntil: 'networkidle2' });
    if (comOidc) {
      await pagina.waitForSelector('a[href*="/api/auth/oidc/iniciar"]', { timeout: 15000 });
      confere(modo, 'portal oferece a entrada pela FSA', true);
      await pagina.click('a[href*="/api/auth/oidc/iniciar"]');
      await pagina.waitForSelector('input[name="cpf"]', { timeout: 20000 });
      await pagina.type('input[name="cpf"]', '111.444.777-35');
      await pagina.type('input[name="senha"]', 'senha');
      await pagina.click('button[type="submit"]');
    } else {
      await digitar(pagina, '#cpf', '000.000.000-00');
      await digitar(pagina, '#senha', 'senha');
      await pagina.click('button[type="submit"]');
    }
    // Primeiro acesso cai na autorização; quem já autorizou (outro modo, mesmo emulador) vai direto ao início.
    await pagina.waitForFunction(() => location.hash.includes('autorizacao') || location.hash.includes('inicio'), { timeout: 25000 });
    const pediuAutorizacao = await pagina.evaluate(() => location.hash.includes('autorizacao'));
    confere(modo, 'login conclui e leva ao próximo passo do aluno', true);
    if (pediuAutorizacao) await clicarPorTexto(pagina, 'Autorizar e continuar');
    await pagina.waitForFunction(() => location.hash.includes('inicio'), { timeout: 15000 });
    const me = await pagina.evaluate(async (base) => {
      const r = await fetch(`${base}/api/me`, { credentials: 'include' });
      return { status: r.status, corpo: await r.text() };
    }, COLETOR);
    confere(modo, 'sessão do aluno existe no servidor (/api/me 200)', me.status === 200, `status ${me.status}`);
    confere(modo, 'nenhum CPF aparece na resposta do servidor', !/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(me.corpo) && !me.corpo.includes('00000000000') && !me.corpo.includes('11144477735'));

    await pagina.goto(`${FRONT}/#/curriculo`, { waitUntil: 'networkidle2' });
    await pagina.waitForSelector('textarea', { timeout: 15000 });
    const marca = `Texto e2e ${modo} ${Date.now()}`;
    await pagina.evaluate((texto) => {
      const area = document.querySelector('textarea');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(area, texto);
      area.dispatchEvent(new Event('input', { bubbles: true }));
    }, marca);
    await pausa(2500); // salvamento com atraso de 800 ms
    const salvo = await pagina.evaluate(async (base) => {
      const r = await fetch(`${base}/api/me/curriculo`, { credentials: 'include' });
      return r.json();
    }, COLETOR);
    confere(modo, 'currículo editado é salvo no servidor com versão nova', JSON.stringify(salvo.dados).includes(marca) && salvo.versao >= 1, `versao ${salvo.versao}`);

    await pagina.reload({ waitUntil: 'networkidle2' });
    await pagina.waitForSelector('textarea', { timeout: 15000 });
    await pausa(1500);
    const apos = await pagina.evaluate(() => document.querySelector('textarea')?.value || '');
    confere(modo, 'após recarregar, o currículo continua igual (vem do servidor)', apos === marca, `valor: ${apos.slice(0, 30)}`);
  } catch (erro) {
    const onde = await pagina.evaluate(() => ({ hash: location.hash, texto: document.body.innerText.slice(0, 220) })).catch(() => null);
    confere(modo, 'fluxo do aluno completou sem erro', false, String(erro.message || erro).slice(0, 160));
    if (onde) console.log(`        tela: ${onde.hash} | ${onde.texto.replace(/\s+/g, ' ')}`);
  } finally {
    await contexto.close();
  }
}

async function cenarioAdmin(navegador, modo) {
  const contexto = await navegador.createBrowserContext();
  const pagina = await contexto.newPage();
  try {
    await pagina.goto(`${FRONT}/#/admin`, { waitUntil: 'networkidle2' });
    await digitar(pagina, 'input[type="email"]', ADMIN.email);
    await digitar(pagina, 'input[type="password"]', ADMIN.senha);
    await pagina.click('button[type="submit"]');
    await pagina.waitForFunction(() => document.body.innerText.includes('Painel administrativo') && document.body.innerText.includes('Cota SerpApi'), { timeout: 20000 });
    confere(modo, 'administrador entra no painel e vê o resumo (cota e auditoria)', true);
    const botao = await pagina.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Disparar coleta')));
    confere(modo, 'painel oferece a coleta manual (papel admin)', botao);
  } catch (erro) {
    confere(modo, 'painel administrativo funciona', false, String(erro.message || erro).slice(0, 200));
  } finally {
    await contexto.close();
  }
}

async function rodarModo(navegador, modo) {
  console.log(`\n== modo: ${modo}`);
  const ocupada = await fetch(`${COLETOR}/health`).then(() => true).catch(() => false);
  if (ocupada) throw new Error('a porta 8000 já está em uso por outro servidor: feche-o antes do e2e');
  const coletor = subirColetor(modo);
  try {
    if (!(await aguardar(`${COLETOR}/health`))) {
      confere(modo, 'servidor subiu', false);
      return;
    }
    const cfg = await (await fetch(`${COLETOR}/api/publico/config`)).json();
    confere(modo, `configuração publicada: modo ${cfg.modo_auth} e fonte ${cfg.provedor}`,
      cfg.modo_auth === MODOS[modo].AUTH_MODE && cfg.provedor === MODOS[modo].ACADEMICO_PROVIDER && cfg.sessao_ativa === true);
    await cenarioAluno(navegador, modo, MODOS[modo].AUTH_MODE === 'oidc');
    await cenarioAdmin(navegador, modo);
  } finally {
    coletor.kill();
    await pausa(800);
  }
}

async function main() {
  if (!existsSync(PY)) throw new Error('coletor/.venv não encontrado: rode a instalação do coletor antes');
  mkdirSync(path.join(RAIZ, 'e2e', 'saida'), { recursive: true });
  console.log('Subindo emulador do Firestore, simulador da FSA e o front…');
  subirEmulador();
  subirSimulador();
  if (!(await aguardar('http://localhost:8102/.well-known/openid-configuration'))) throw new Error('IdP da FSA não respondeu');
  if (!(await aguardar('http://localhost:8101/docs', 60))) console.log('  (API da FSA sem /docs; seguindo, o provedor http é testado no modo http-oidc)');
  semearAdmin();
  const front = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'preview', '--port', '4173', '--strictPort'],
    { cwd: path.join(RAIZ, 'frontend-react'), stdio: 'ignore', shell: process.platform === 'win32' });
  if (!(await aguardar(FRONT))) throw new Error('o front (vite preview) não subiu na porta 4173');
  const navegador = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  try {
    for (const modo of Object.keys(MODOS)) {
      await rodarModo(navegador, modo);
    }
  } finally {
    await navegador.close();
    front.kill();
  }
  const falhas = resultados.filter((r) => !r.ok);
  console.log(`\nResultado: ${resultados.length - falhas.length}/${resultados.length} verificações passaram.`);
  process.exitCode = falhas.length ? 1 : 0;
}

main().catch((erro) => {
  console.error('E2E interrompido:', erro.message || erro);
  process.exitCode = 1;
});
