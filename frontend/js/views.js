// StartMe — funções de renderização (HTML como template literals).
//
// Cada `renderX(state)` devolve uma string HTML equivalente a uma das 13
// pranchas do protótipo original. Todo texto em português, nomes de empresas
// e conteúdo das notas "Decisões e por quê" foi preservado do design de
// referência (design-reference/StartMe.dc.html) — é documentação de decisão
// de projeto do TCC, não enfeite.
"use strict";

const esc = Api.esc;
const linkSeguro = Api.linkSeguro;

function mostraApp(view) {
  return ['home', 'lista', 'detalhe', 'candidaturas', 'perfil', 'curriculo', 'certificados'].includes(view);
}

// ------------------------------------------------------------------
// Casca: navegação lateral + cabeçalho + aviso + view atual + modal
// ------------------------------------------------------------------
function renderShell() {
  const s = App.state;
  return `
    <div class="sm-shell">
      ${renderNav(s)}
      <div class="sm-main-col">
        ${mostraApp(s.view) ? renderHeader(s) : ''}
        ${s.aviso ? renderAvisoTopo(s.aviso) : ''}
        ${renderView(s)}
      </div>
    </div>
    ${s.modal === 'ok' ? renderModalOk(s) : ''}
  `;
}

function renderView(s) {
  switch (s.view) {
    case 'portal': return renderPortal(s);
    case 'login': return renderLogin(s);
    case 'consent': return renderConsent(s);
    case 'home': return renderHome(s);
    case 'lista': return renderLista(s);
    case 'detalhe': return renderDetalhe(s);
    case 'candidaturas': return renderCandidaturas(s);
    case 'perfil': return renderPerfil(s);
    case 'excecoes': return renderExcecoes(s);
    case 'sistema': return renderSistema(s);
    case 'curriculo': return renderCurriculo(s);
    case 'certificados': return renderCertificados(s);
    default: return renderPortal(s);
  }
}

function renderNav(s) {
  const grupos = NAV_GRUPOS_DEF.map((g) => `
    <div class="sm-nav__group">
      ${!s.navRecolhida ? `<span class="sm-nav__group-label">${esc(g.rotulo)}</span>` : ''}
      ${g.itens.map(([v, num, titulo]) => {
        const ativo = s.view === v;
        return `<button type="button" class="sm-nav__item${ativo ? ' is-active' : ''}" title="${esc(num + ' ' + titulo)}" onclick="App.irView('${v}')">
          <span class="sm-nav__item-num">${num}</span>
          ${!s.navRecolhida ? `<span>${esc(titulo)}</span>` : ''}
        </button>`;
      }).join('')}
    </div>`).join('');

  return `
    <aside class="sm-nav${s.navRecolhida ? ' is-collapsed' : ''}">
      <div class="sm-nav__head">
        ${!s.navRecolhida ? '<div class="sm-nav__brand">StartMe · TCC 15</div>' : ''}
        <button type="button" class="sm-nav__toggle" aria-label="${s.navRecolhida ? 'Expandir navegação' : 'Recolher navegação'}" onclick="App.toggleNav()">${s.navRecolhida ? '›' : '‹'}</button>
      </div>
      ${grupos}
      <button type="button" class="sm-nav__notes-btn" title="Notas de design" onclick="App.toggleNotas()">${s.navRecolhida ? 'i' : 'Notas de design'}</button>
    </aside>`;
}

function renderHeader(s) {
  return `
    <header class="sm-header">
      <div class="sm-header__row">
        <button type="button" class="sm-logo-btn" onclick="App.irView('lista')">
          <div class="sm-logo-mark" aria-hidden="true">S</div>
          <div class="sm-logo-text">
            <div class="sm-logo-title">StartMe</div>
            <div class="sm-logo-sub">Módulo institucional</div>
          </div>
        </button>
        <div class="sm-search">
          <span aria-hidden="true">⌕</span>
          <input id="busca-topo" type="text" value="${esc(s.q)}" oninput="App.setQ(this.value)" placeholder="Buscar vaga, empresa ou tecnologia" aria-label="Buscar vagas">
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="sm-avatar">VP</div>
          <button type="button" class="sm-menu-btn" aria-haspopup="true" onclick="App.toggleMenu()">Vinicius P. <span aria-hidden="true" style="color:var(--texto-terciario);font-size:11px">▾</span></button>
        </div>
      </div>
      ${s.menuAberto ? `
      <div class="sm-menu-drop">
        <div class="sm-menu-card">
          <button type="button" onclick="App.irView('perfil')">Meu perfil <small>· Prancha 9</small></button>
          <button type="button" onclick="App.irView('candidaturas')">Minhas candidaturas <small>· Prancha 8</small></button>
          <button type="button" onclick="App.irView('curriculo')">Meu currículo <small>· Prancha 12</small></button>
          <button type="button" onclick="App.irView('certificados')">Certificados <small>· Prancha 13</small></button>
          <button type="button" class="is-danger" onclick="App.irView('portal')">Sair</button>
        </div>
      </div>` : ''}
    </header>
    <div class="sm-contexto">
      <span class="sm-pill sm-pill--inst">Vindo do Portal Acadêmico</span>
      <span>Olá, <strong style="color:var(--texto-primario)">Vinicius</strong> — Engenharia de Computação, ${s.semestreAluno}º semestre</span>
    </div>`;
}

function renderAvisoTopo(texto) {
  return `<div class="sm-alerta-topo">
    <div class="sm-alerta sm-alerta--info" role="status">
      <span aria-hidden="true">ⓘ</span>
      <div style="flex:1">${esc(texto)}</div>
      <button type="button" class="sm-alerta__fechar" aria-label="Fechar aviso" onclick="App.fecharAviso()">✕</button>
    </div>
  </div>`;
}

function renderModalOk(s) {
  const v = App._internal.vagaPorId(s.sel);
  return `
  <div role="dialog" aria-modal="true" aria-label="Marcado como candidatado" class="sm-modal-overlay">
    <div class="sm-modal">
      <div class="sm-modal__icone" aria-hidden="true">✓</div>
      <h2>Marcado como "já me candidatei"</h2>
      <p>${esc(v.titulo)} · ${esc(v.empresa)}. Isso é uma anotação sua — o StartMe não confirma nem envia nada à empresa. Não se esqueça de concluir o cadastro e o envio do currículo no site de origem.</p>
      <div class="sm-modal__acoes">
        <button type="button" class="sm-btn sm-btn-secundario" onclick="App.verCandidaturas()">Ver minhas candidaturas</button>
        <button type="button" class="sm-btn sm-btn-primario" onclick="App.continuarBuscando()">Continuar buscando vagas</button>
      </div>
    </div>
  </div>`;
}

function renderNotas(prancha, titulo, listaHtml, grid) {
  return `<aside class="sm-aside-sticky sm-notas">
    <div class="sm-notas__eyebrow">Prancha ${prancha} · Decisões e por quê</div>
    <h2>${esc(titulo)}</h2>
    <ul class="${grid ? 'sm-notas__grid' : ''}">${listaHtml}</ul>
  </aside>`;
}

// ------------------------------------------------------------------
// Prancha 1 — Portal acadêmico simulado
// ------------------------------------------------------------------
function renderPortal(s) {
  const cartoesOficiais = PORTAIS.map((p) => {
    if (p.novo) {
      return `<div class="sm-portalfsa-item sm-portalfsa-item--novo">
        <h3>${esc(p.nome)}</h3>
        <button type="button" class="sm-portalfsa-acessar sm-portalfsa-acessar--novo" onclick="App.portalClicar('${esc(p.nome)}')"><span aria-hidden="true">⚡</span> Acessar</button>
        <span class="sm-portalfsa-badge-novo">Novo</span>
      </div>`;
    }
    return `<div class="sm-portalfsa-item">
      <h3>${esc(p.nome)}</h3>
      <button type="button" class="sm-portalfsa-acessar" onclick="App.portalClicar('${esc(p.nome)}')"><span aria-hidden="true">⚡</span> Acessar</button>
    </div>`;
  }).join('');

  const ferramentas = FERRAMENTAS.map((nome) => `
    <article class="sm-portal-card">
      <h3>${esc(nome)}</h3>
      <button type="button" class="sm-portal-acessar" onclick="App.nadaAinda()" style="margin-top:auto">Acessar</button>
    </article>`).join('');

  return `
  <div class="sm-faixa-simulado">AMBIENTE SIMULADO — PROTÓTIPO DE TCC, RÉPLICA CONCEITUAL DO PORTAL.FSA.BR. NÃO INSIRA CREDENCIAIS REAIS.</div>
  <div class="sm-portalfsa-topo">
    <div class="sm-portalfsa-topo__row">
      <div class="sm-portalfsa-logo" aria-hidden="true">
        <span class="sm-portalfsa-logo__c sm-portalfsa-logo__c--f">F</span>
        <span class="sm-portalfsa-logo__c sm-portalfsa-logo__c--s">S</span>
        <span class="sm-portalfsa-logo__c sm-portalfsa-logo__c--a">A</span>
      </div>
      <div>
        <div class="sm-portalfsa-instituicao__eyebrow">Centro Universitário</div>
        <div class="sm-portalfsa-instituicao__nome">Fundação Santo André</div>
      </div>
    </div>
    <button type="button" class="sm-portalfsa-trocarsenha" onclick="App.nadaAinda()">Troque sua senha</button>
  </div>
  <main class="sm-portalfsa-hero">
    <div class="sm-portalfsa-lockup">
      <span class="sm-portalfsa-lockup__portal">PORTAL</span>
      <span class="sm-portalfsa-lockup__fsa">FSA</span>
    </div>
    <div class="sm-portalfsa-grid">${cartoesOficiais}</div>
  </main>
  <div class="sm-container--narrow" style="margin:0 auto;padding:32px 20px 0">
    <h2 style="font-size:15px;font-weight:700;color:var(--texto-secundario);margin-bottom:16px;font-family:var(--fonte-corpo)">Ferramentas</h2>
    <div class="sm-portal-grid">${ferramentas}</div>
    ${App._internal.notasVisiveis() ? `
    <div style="margin-top:32px;max-width:760px">
      ${renderNotas('1', 'Portal acadêmico (réplica do portal.fsa.br)', `
        <li><strong>Cabeçalho e hero replicam o portal.fsa.br real pixel a pixel</strong> (referência: captura de tela do portal em produção) — logo em três círculos, "Troque sua senha" em vermelho, gradiente azul institucional atrás do lockup "PORTAL FSA" e da grade de oito acessos sem caixa/borda, só título e botão.</li>
        <li><strong>O StartMe entra como oitavo item da mesma grade do portal</strong>, não como cartão separado abaixo — só o selo "Novo" e o botão em azul sólido (em vez do gradiente roxo dos demais) o distinguem, mantendo-o no mesmo "quadrado" visual dos outros sete acessos.</li>
        <li><strong>Nenhuma marca de terceiros nem logotipo real da FSA usado como elemento de UI.</strong> Os círculos "F/S/A" e o "FSA" do lockup são tipográficos, não a logo oficial — a faixa declara que é réplica conceitual para demonstração acadêmica.</li>
        <li><strong>A faixa de simulação continua no topo, acima do cabeçalho.</strong> A banca vê o aviso antes de qualquer campo de credencial, não só na tela de login.</li>
      `)}
    </div>` : ''}
  </div>`;
}

// ------------------------------------------------------------------
// Prancha 2 — Login simulado
// ------------------------------------------------------------------
function renderLogin(s) {
  const podeEntrar = s.cpf.length === 14 && s.senha.length > 0;
  return `
  <div class="sm-faixa-simulado">AMBIENTE SIMULADO — PROTÓTIPO DE TCC. NÃO INSIRA CREDENCIAIS REAIS.</div>
  <main class="sm-auth-bg">
    <div class="sm-auth-card">
      <section class="sm-auth-form">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:26px">
          <div class="sm-auth-badge" aria-hidden="true">PA</div>
          <div style="font-family:var(--fonte-titulo);font-size:18px;font-weight:700;color:var(--acao-600)">Portal Acadêmico</div>
        </div>
        <h1 style="font-size:26px;color:var(--texto-primario);letter-spacing:-.01em;margin-bottom:6px">Entrar</h1>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:var(--texto-secundario)">Use o CPF cadastrado na secretaria acadêmica.</p>

        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="sm-field">
            <label for="cpf">CPF</label>
            <div class="sm-input-icon-row">
              <input id="cpf" type="text" inputmode="numeric" value="${esc(s.cpf)}" oninput="App.setCpf(this.value)" placeholder="000.000.000-00" autocomplete="off">
            </div>
          </div>
          <div class="sm-field">
            <label for="senha">Senha</label>
            <div class="sm-input-icon-row">
              <input id="senha" type="${s.verSenha ? 'text' : 'password'}" value="${esc(s.senha)}" oninput="App.setSenha(this.value)" placeholder="Sua senha">
              <button type="button" onclick="App.toggleSenha()" aria-label="${s.verSenha ? 'Ocultar' : 'Mostrar'}" style="min-width:44px;min-height:44px;border:none;background:none;color:var(--texto-secundario);font-size:12px;font-weight:700;cursor:pointer;border-radius:8px">${s.verSenha ? 'Ocultar' : 'Mostrar'}</button>
            </div>
          </div>

          ${s.erroLogin ? `<div role="alert" class="sm-alerta sm-alerta--erro"><span aria-hidden="true">✕</span><div>CPF ou senha inválidos. Use as credenciais de demonstração abaixo — nenhuma credencial real é aceita.</div></div>` : ''}

          <button type="button" class="sm-btn sm-btn-primario" style="min-height:50px;font-size:16px" ${podeEntrar ? '' : 'disabled'} onclick="App.entrar()">Entrar</button>
          <a href="#" onclick="return false" style="align-self:flex-start;font-size:13.5px">Esqueceu sua senha?</a>

          <div class="sm-demo-box">
            <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--texto-terciario);margin-bottom:6px">Credenciais fixas de demonstração</div>
            <div style="font-size:14px;color:var(--texto-primario);font-family:ui-monospace,monospace">CPF ${CPF_DEMO} · senha ${SENHA_DEMO}</div>
            <button type="button" class="sm-btn sm-btn-secundario" style="margin-top:10px;min-height:40px" onclick="App.preencherDemo()">Preencher automaticamente</button>
          </div>
        </div>
      </section>
      <section class="sm-auth-side">
        <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:#9DC1E4">Missão institucional</div>
        <p style="margin:0;font-family:var(--fonte-titulo);font-size:19px;line-height:1.5;color:#fff">${esc(MISSAO_INSTITUCIONAL)}</p>
        <div style="height:1px;background:#14507F"></div>
        <ul style="margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px">
          ${VALORES_INSTITUCIONAIS.map((v) => `<li style="font-size:12px;font-weight:600;color:#E3F6F4;border:1px solid #14507F;border-radius:999px;padding:5px 11px">${esc(v)}</li>`).join('')}
        </ul>
        <p style="margin:0;font-size:12px;line-height:1.55;color:#BDD4EA">Texto e valores citados do Manual da Marca da instituição. Nenhum logotipo, marca ou nome de fornecedor de ERP é reproduzido nesta simulação.</p>
      </section>
    </div>
    ${App._internal.notasVisiveis() ? `
    <aside style="max-width:1080px;margin:22px auto 0;background:rgba(2,32,63,.55);border:1px solid #14507F;border-radius:14px;padding:20px" class="sm-notas">
      ${renderNotas('2', 'Autenticação institucional (mockada)', `
        <li><strong>Ordem de tabulação declarada:</strong> CPF → Senha → revelar senha → Entrar → Esqueceu sua senha → Preencher automaticamente. Nenhum <code>tabindex</code> positivo: a ordem do DOM já é a ordem correta.</li>
        <li><strong>"Entrar" desabilitado é honesto, não hostil.</strong> Só habilita com 11 dígitos de CPF e senha preenchida; o motivo fica visível no próprio formato do campo (<code>000.000.000-00</code>).</li>
        <li><strong>Erro inline, sem recarregar.</strong> A mensagem entra como <code>role="alert"</code> acima do botão, mantendo o que foi digitado.</li>
        <li><strong>A coluna direita não é ilustração decorativa.</strong> É a missão institucional citada do manual — comunica continuidade sem clonar sistema de terceiros nem inventar imagem.</li>
        <li><strong>CPF entra, mas não fica.</strong> Ele autentica e é descartado: nenhuma tela do StartMe volta a exibi-lo, nem completo nem parcial.</li>
      `)}
    </aside>` : ''}
  </main>`;
}

// ------------------------------------------------------------------
// Prancha 3 — Consentimento
// ------------------------------------------------------------------
function renderConsent(s) {
  return `
  <main class="sm-auth-bg">
    <div style="max-width:660px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 28px 56px -28px rgba(2,32,63,.7);padding:30px 28px">
      <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:22px">
        <div class="sm-auth-badge" style="width:44px;height:44px" aria-hidden="true">PA</div>
        <span aria-hidden="true" style="color:var(--texto-terciario);font-size:18px">→</span>
        <div class="sm-logo-mark" style="width:44px;height:44px;font-size:21px" aria-hidden="true">S</div>
      </div>
      <h1 style="font-size:23px;line-height:1.3;color:var(--texto-primario);text-align:center;margin-bottom:8px">O Portal Acadêmico deseja compartilhar seus dados com o StartMe</h1>
      <p style="margin:0 auto 24px;max-width:52ch;font-size:14px;line-height:1.6;color:var(--texto-secundario);text-align:center">Esta autorização é pedida uma única vez, no primeiro acesso, e pode ser revogada depois no seu perfil.</p>

      <div class="sm-consent-bloco-sim">
        <div style="font-size:13px;font-weight:700;color:var(--agua-700);margin-bottom:12px">✓ Dados que serão compartilhados</div>
        <ul style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:11px">
          ${DADOS_SIM.map((i) => `<li style="display:flex;gap:11px;align-items:flex-start">
            <span aria-hidden="true" style="color:var(--agua-700);font-weight:700;font-size:14px">·</span>
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--texto-primario)">${esc(i.nome)}</div>
              <div style="font-size:12.5px;line-height:1.5;color:var(--texto-secundario)">${esc(i.para)}</div>
            </div>
          </li>`).join('')}
        </ul>
      </div>

      <div class="sm-consent-bloco-nao">
        <div style="font-size:13px;font-weight:700;color:var(--texto-secundario);margin-bottom:10px">✕ Dados que o StartMe <span style="text-decoration:underline">nunca</span> acessa</div>
        <div class="sm-chips-wrap">
          ${DADOS_NAO.map((n) => `<span class="sm-pill sm-pill--neutro sm-riscado">${esc(n)}</span>`).join('')}
        </div>
        <p style="margin:12px 0 0;font-size:12.5px;line-height:1.55;color:var(--texto-terciario)">O StartMe é um microsserviço satélite: recebe do portal apenas os quatro dados acima, pelo tempo da sessão, e não replica o histórico acadêmico.</p>
      </div>

      <div style="display:flex;flex-direction:column;gap:9px">
        <button type="button" class="sm-btn sm-btn-primario" style="min-height:50px;font-size:16px" onclick="App.autorizar()">Autorizar e continuar</button>
        <button type="button" style="min-height:44px;border-radius:10px;border:none;background:none;color:var(--texto-secundario);font-size:14px;font-weight:600;cursor:pointer" onclick="App.naoAutorizar()">Não autorizar</button>
        <a href="#" onclick="return false" style="text-align:center;font-size:13px;padding:4px 0">Como tratamos seus dados</a>
      </div>
    </div>
    ${App._internal.notasVisiveis() ? `
    <aside style="max-width:660px;margin:22px auto 0;background:rgba(2,32,63,.55);border:1px solid #14507F;border-radius:14px;padding:20px" class="sm-notas">
      ${renderNotas('3', 'Consentimento e transferência de dados', `
        <li><strong>É esta a prancha que a banca vai apontar.</strong> Minimização de dados deixa de ser texto na monografia e passa a ser uma tela: quatro dados concedidos, seis explicitamente negados.</li>
        <li><strong>O bloco negativo é visualmente mais frio.</strong> Cinza-azulado e texto riscado contra o verde-água do bloco concedido — a diferença é lida antes da leitura.</li>
        <li><strong>Cada dado declara a finalidade.</strong> Exigência do princípio de finalidade: nenhum item aparece sem dizer para que serve.</li>
        <li><strong>"Não autorizar" é botão de texto, não botão desabilitado.</strong> Recusar é um caminho legítimo e leva ao estado 6 da Prancha 10, não a um beco sem saída.</li>
        <li><strong>Uma vez só, mas reversível.</strong> Aparece no primeiro acesso e a revogação vive na Prancha 9 — sem isso a conformidade seria apenas de entrada.</li>
      `)}
    </aside>` : ''}
  </main>`;
}

// ------------------------------------------------------------------
// Cartão de vaga reutilizável (Prancha 5 e Prancha 4 "recomendadas")
// ------------------------------------------------------------------
function compatClasse(v) { return v.compatAlta ? 'alta' : (v.compatMedia ? 'media' : 'baixa'); }
function compatIcone(v) { return v.compatAlta ? '◆' : (v.compatMedia ? '◐' : '○'); }

function renderVagaCard(v) {
  return `
  <article class="sm-vaga-card">
    <div class="sm-vaga-card__top">
      <div class="sm-monograma" aria-hidden="true">${esc(v.monograma)}</div>
      <div style="flex:1 1 220px;min-width:0">
        <h3 class="sm-vaga-card__titulo">${esc(v.titulo)}</h3>
        <div class="sm-vaga-card__empresa">${esc(v.empresa)}</div>
      </div>
      <div class="sm-compat sm-compat--${compatClasse(v)}">
        <div class="sm-compat__valor"><span aria-hidden="true" style="margin-right:5px">${compatIcone(v)}</span><span>${v.rotuloCompat}</span></div>
        <div class="sm-compat__razao">${esc(v.razao)}</div>
      </div>
    </div>
    <div class="sm-vaga-card__meta">
      ${v.temSalario ? `<span class="sm-vaga-card__salario">${esc(v.salario)}</span>` : `<span class="sm-vaga-card__sem-salario"><span aria-hidden="true">—</span>Salário não informado na origem</span>`}
      <span class="sm-divisor-v"></span>
      <span class="sm-pill sm-pill--neutro">${esc(v.modalidade)}</span>
      <span class="sm-pill sm-pill--neutro">${esc(v.area)}</span>
      <span style="font-size:12px;color:var(--texto-terciario)">Coletada ${v.quandoTxt}</span>
    </div>
    <div class="sm-vaga-card__acoes">
      ${v.aplicada ? `<span class="sm-pill sm-pill--sucesso"><span aria-hidden="true">✓</span>Já me candidatei</span>` : ''}
      <button type="button" class="sm-btn sm-btn-primario" onclick="App.abrirVaga('${v.id}')">Ver detalhes</button>
      <button type="button" class="sm-btn sm-btn-secundario" onclick="App.toggleSalvar('${v.id}')">${v.salva ? '<span aria-hidden="true" style="color:var(--acao-600)">★</span> Salva' : '<span aria-hidden="true">☆</span> Salvar'}</button>
      <a href="${esc(linkSeguro(v.link))}" target="_blank" rel="noopener noreferrer" class="sm-vaga-card__link-origem">Ver anúncio original ↗</a>
    </div>
  </article>`;
}

// ------------------------------------------------------------------
// Prancha 5 — Listagem e busca
// ------------------------------------------------------------------
function renderLista(s) {
  const lista = App._internal.listaFiltrada();
  const total = lista.length;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(s.pagina, totalPaginas);
  const recorte = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map(App._internal.enfeitar);
  const resultadosTxt = total === 1 ? '1 vaga encontrada' : total + ' vagas encontradas';

  const paginasBtns = [];
  for (let i = 1; i <= totalPaginas; i++) {
    paginasBtns.push(`<button type="button" aria-current="${i === pagina}" onclick="App.irPagina(${i})">${i === pagina ? `<span class="sm-pager__atual">${i}</span>` : i}</button>`);
  }

  const fonteAviso = s.vagasFonte === 'mock'
    ? '<span class="sm-pill sm-pill--atencao" style="text-transform:none;letter-spacing:normal;font-weight:600">Dados de demonstração — coletor indisponível</span>'
    : '<span class="sm-pill sm-pill--info" style="text-transform:none;letter-spacing:normal;font-weight:600">Vagas reais do coletor · compatibilidade estimada no cliente</span>';

  return `
  <main class="sm-container">
    <div class="sm-row">
      <aside class="sm-filtros">
        <div class="sm-filtros__head">
          <h2 style="font-size:15px;font-weight:700;color:var(--texto-primario);font-family:var(--fonte-corpo)">Filtros</h2>
          <button type="button" class="sm-btn-texto" onclick="App.limparFiltros()">Limpar filtros</button>
        </div>

        <div class="sm-filtros__grupo">
          <label for="f-compat" class="sm-check-row">
            <span style="font-size:14px;font-weight:600;color:var(--texto-primario)">Só vagas compatíveis com o meu semestre</span>
            <input id="f-compat" type="checkbox" class="sm-checkbox" ${s.compatOnly ? 'checked' : ''} onchange="App.toggleCompat()">
          </label>
          <p class="sm-filtros__ajuda">Usa curso e semestre do Portal Acadêmico. Nenhum formulário de perfil.</p>
        </div>

        <div class="sm-filtros__grupo">
          <div class="sm-filtros__titulo" style="margin-bottom:8px">Faixa salarial declarada</div>
          <div style="display:flex;flex-direction:column;gap:2px">
            ${FAIXAS.map((f) => `<label class="sm-check-row-simple"><input type="radio" name="faixa" class="sm-radio" ${s.faixa === f.v ? 'checked' : ''} onchange="App.setFaixa('${f.v}')">${esc(f.label)}</label>`).join('')}
          </div>
          <p class="sm-filtros__ajuda">O campo <code>salario</code> é texto livre. Vagas sem valor só aparecem em "Qualquer" e "Não informado".</p>
        </div>

        <div class="sm-filtros__grupo">
          <div class="sm-filtros__label-row">
            <div class="sm-filtros__titulo">Modalidade</div>
            <span class="sm-pill sm-pill--atencao">Requer novo campo na coleta</span>
          </div>
          <div class="sm-chips-wrap">
            ${MODALIDADES.map((m) => `<button type="button" class="sm-btn-chip${s.mods.includes(m) ? ' is-on' : ''}" aria-pressed="${s.mods.includes(m)}" onclick="App.toggleModalidade('${m}')">${s.mods.includes(m) ? '<span aria-hidden="true" style="color:var(--acao-600)">✓ </span>' : ''}${esc(m)}</button>`).join('')}
          </div>
        </div>

        <div class="sm-filtros__grupo">
          <div class="sm-filtros__label-row">
            <div class="sm-filtros__titulo">Área</div>
            <span class="sm-pill sm-pill--atencao">Derivado do título</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px">
            ${AREAS.map((a) => {
              const n = s.vagas.filter((v) => v.area === a).length;
              return `<label class="sm-check-row"><span style="display:flex;align-items:center;gap:9px"><input type="checkbox" class="sm-radio" ${s.areas.includes(a) ? 'checked' : ''} onchange="App.toggleArea('${a}')">${esc(a)}</span><span style="font-size:12px;color:var(--texto-terciario);font-variant-numeric:tabular-nums">${n}</span></label>`;
            }).join('')}
          </div>
        </div>

        <div class="sm-filtros__grupo" style="margin-bottom:0">
          <div class="sm-filtros__titulo" style="margin-bottom:8px">Data de coleta</div>
          <div class="sm-chips-wrap">
            ${JANELAS.map((j) => `<button type="button" class="sm-btn-chip${s.janela === j.v ? ' is-on' : ''}" aria-pressed="${s.janela === j.v}" onclick="App.setJanela('${j.v}')">${s.janela === j.v ? '<span aria-hidden="true" style="color:var(--acao-600)">✓ </span>' : ''}${esc(j.label)}</button>`).join('')}
          </div>
          <p class="sm-filtros__ajuda">"Coletada em", nunca "publicada em": <code>data_coleta</code> é a data da nossa captura.</p>
        </div>
      </aside>

      <section class="sm-col-main">
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between;margin-bottom:14px">
          <div>
            <h1 style="font-size:24px;font-weight:700;letter-spacing:-.02em;color:var(--texto-primario);font-family:var(--fonte-corpo)">Vagas coletadas</h1>
            <p style="margin:4px 0 0;font-size:14px;color:var(--texto-secundario)">${resultadosTxt} · ${fonteAviso}</p>
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--texto-secundario)">
            Ordenar por
            <select onchange="App.setOrd(this.value)" style="min-height:44px;border:1px solid var(--borda);border-radius:10px;background:#fff;padding:0 10px;font-size:14px;color:var(--texto-primario);cursor:pointer">
              <option value="compat" ${s.ord === 'compat' ? 'selected' : ''}>Maior compatibilidade</option>
              <option value="recentes" ${s.ord === 'recentes' ? 'selected' : ''}>Mais recentes</option>
              <option value="salario" ${s.ord === 'salario' ? 'selected' : ''}>Maior salário declarado</option>
            </select>
          </label>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          ${recorte.map(renderVagaCard).join('') || ''}
        </div>

        ${total === 0 ? `
        <div class="sm-empty-state">
          <div class="sm-empty-state__titulo">Nenhuma vaga encontrada com esses filtros</div>
          <p>A coleta de hoje trouxe ${s.vagas.length} vagas ativas. Afrouxe um critério para voltar a vê-las.</p>
          <button type="button" class="sm-btn sm-btn-primario" onclick="App.limparFiltros()">Limpar filtros</button>
        </div>` : ''}

        ${total > POR_PAGINA ? `
        <nav aria-label="Paginação de resultados" class="sm-pager">
          <button type="button" onclick="App.paginaAnterior()">← Anterior</button>
          ${paginasBtns.join('')}
          <button type="button" onclick="App.paginaProxima()">Próxima →</button>
        </nav>` : ''}
      </section>

      ${App._internal.notasVisiveis() ? renderNotas('5', 'Listagem e busca', `
        <li><strong>Paginação, não rolagem infinita.</strong> A contagem de resultados é o dado que orienta o filtro, e rolagem infinita a torna inútil; além disso é navegável por teclado e é um <code>slice()</code> de array — trivial sem biblioteca.</li>
        <li><strong>Compatibilidade nunca sozinha.</strong> O percentual sempre carrega a razão em texto ao lado, e ícone + cor + rótulo ("compatível/parcial/distante") garantem que a informação não dependa de cor.</li>
        <li><strong>Monograma no lugar de logotipo.</strong> A coleta não traz logotipo da empresa; o cartão é desenhado para nunca precisar de um.</li>
        <li><strong>"Salário não informado" é um estado, não um vazio.</strong> <code>salario</code> é texto livre e o coletor grava "A combinar" por padrão — a etiqueta tracejada é honesta sobre isso.</li>
        <li><strong>Modalidade e área estão marcadas como pendentes.</strong> Nenhum dos dois existe na coleta atual; ficam visíveis com selo de pendência em vez de fingir que o backend já entrega.</li>
      `) : ''}
    </div>
  </main>`;
}

// ------------------------------------------------------------------
// Prancha 6/7 — Detalhe da vaga + candidatura
// ------------------------------------------------------------------
function renderDetalhe(s) {
  const d = App._internal.enfeitar(App._internal.vagaPorId(s.sel));
  return `
  <main class="sm-container">
    <button type="button" class="sm-voltar" onclick="App.irView('lista')">← Voltar para a listagem</button>
    <div class="sm-row">
      <article class="sm-col-main sm-col-main--detalhe" style="display:flex;flex-direction:column;gap:16px">
        <div class="sm-card">
          <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
            <div class="sm-monograma sm-monograma--lg" aria-hidden="true">${esc(d.monograma)}</div>
            <div style="flex:1 1 240px;min-width:0">
              <h1 style="font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-.02em;color:var(--texto-primario);font-family:var(--fonte-corpo)">${esc(d.titulo)}</h1>
              <div style="margin-top:5px;font-size:15px;color:var(--texto-secundario)">${esc(d.empresa)}</div>
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:16px">
            <span class="sm-pill sm-pill--neutro">${esc(d.modalidade)}</span>
            <span class="sm-pill sm-pill--neutro">${esc(d.area)}</span>
            <span class="sm-pill sm-pill--info">Coletada ${d.quandoTxt}</span>
          </div>
        </div>

        <div class="sm-card">
          <h2 style="font-size:16px;font-weight:700;color:var(--texto-primario);margin-bottom:6px">Compatibilidade com seu perfil</h2>
          <p style="margin:0 0 14px;font-size:13px;color:var(--texto-secundario)">Calculada com curso e semestre vindos do Portal Acadêmico. Você não preencheu nada.</p>
          <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">
            <div class="sm-compat-grande">${d.pct}%</div>
            <div style="flex:1 1 220px;min-width:180px">
              <div class="sm-barra"><div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${d.pct}" class="sm-barra__preenchida" style="width:${d.largura}"></div></div>
              <div style="margin-top:7px;font-size:13px;font-weight:600;color:var(--texto-primario)">${esc(d.nivel)}</div>
            </div>
          </div>
          <ul class="sm-criterios">
            ${d.criterios.map((c) => `<li>${c.positivo ? '<span aria-hidden="true" class="ok">✓</span>' : '<span aria-hidden="true" class="aviso">!</span>'}<span>${esc(c.texto)}</span></li>`).join('')}
          </ul>
          <div class="sm-alerta sm-alerta--atencao" style="margin-top:16px">
            <span aria-hidden="true">⚑</span>
            <div><strong>Regra de cálculo pendente de definição pelo time.</strong> A vaga coletada não tem campo de competências: o percentual precisa de um mapa palavra-chave → disciplina/semestre, ou de inferência de nível pelo título. A interface já está desenhada para exigir a razão em texto, qualquer que seja a regra escolhida.</div>
          </div>
        </div>

        <div class="sm-card">
          <h2 style="font-size:16px;font-weight:700;color:var(--texto-primario);margin-bottom:14px">Descrição da vaga</h2>
          ${d.temDescricao ? `
            <div class="sm-descricao-texto">${esc(d.descricao)}</div>
            <p style="margin:16px 0 0;font-size:12px;color:var(--texto-terciario);border-top:1px solid #E4EBF4;padding-top:12px">Texto reproduzido como veio da coleta automática, sem reformatação. Pode conter quebras irregulares.</p>
          ` : `
            <div style="border:1px dashed var(--borda-forte);border-radius:12px;padding:26px 20px;text-align:center;background:#F8FBFD">
              <div style="font-size:16px;font-weight:700;color:var(--texto-primario)">A coleta não trouxe descrição para esta vaga</div>
              <p style="margin:6px auto 16px;max-width:440px;font-size:14px;line-height:1.55;color:var(--texto-secundario)">O campo <code>descricao</code> veio vazio do portal de origem. O anúncio original é a fonte completa.</p>
              <a href="${esc(linkSeguro(d.link))}" target="_blank" rel="noopener noreferrer" class="sm-btn sm-btn-primario" style="display:inline-flex;text-decoration:none">Abrir anúncio original ↗</a>
            </div>
          `}
        </div>
      </article>

      <aside class="sm-aside-sticky sm-aside-sticky--detalhe">
        <div class="sm-card" style="box-shadow:var(--sombra-2)">
          ${d.temSalario ? `
            <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--texto-terciario)">Salário declarado na origem</div>
            <div style="margin-top:3px;font-size:22px;font-weight:700;color:var(--texto-primario)">${esc(d.salario)}</div>
          ` : `
            <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--texto-terciario)">Salário</div>
            <div class="sm-vaga-card__sem-salario" style="margin-top:5px">Não informado na origem</div>
          `}
          <dl class="sm-dl">
            <dt>Modalidade</dt><dd>${esc(d.modalidade)}</dd>
            <dt>Coletada em</dt><dd>${esc(d.dataColeta)}</dd>
            <dt>Origem</dt><dd>Portal externo</dd>
          </dl>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:18px">
            <a href="${esc(linkSeguro(d.link))}" target="_blank" rel="noopener noreferrer" class="sm-btn sm-btn-primario" style="display:flex;align-items:center;justify-content:center;min-height:48px;font-size:15px;font-weight:700;text-decoration:none">Ir para a vaga de origem ↗</a>
            <p style="margin:0;font-size:12px;line-height:1.5;color:var(--texto-terciario)">A candidatura é feita no site da empresa: é lá que você cria seu usuário e envia o currículo. O StartMe não recebe nem envia nenhum dado seu à empresa.</p>
            <label style="display:flex;align-items:center;gap:9px;min-height:40px;font-size:13.5px;color:var(--texto-primario);cursor:pointer;border-top:1px solid #E4EBF4;margin-top:6px;padding-top:14px">
              <input type="checkbox" class="sm-checkbox" style="width:19px;height:19px" ${d.aplicada ? 'checked' : ''} onchange="App.toggleAplicada()">
              Já me candidatei nesse link <span style="color:var(--texto-terciario)">(marcação sua, não confirmada pela empresa)</span>
            </label>
            <button type="button" class="sm-btn sm-btn-secundario" onclick="App.toggleSalvar('${d.id}')">${d.salva ? '★ Vaga salva' : '☆ Salvar vaga'}</button>
          </div>
        </div>
        ${App._internal.notasVisiveis() ? renderNotas('6', 'Detalhe da vaga', `
          <li><strong>A descrição vazia é uma tela, não um bug.</strong> O coletor grava um texto genérico por padrão e o campo pode vir vazio: o estado dedicado promove o anúncio original a ação principal.</li>
          <li><strong>A candidatura acontece fora do StartMe.</strong> O produto não recebe usuário nem currículo da empresa — o botão primário só leva ao link de origem, onde o RH de fato está.</li>
          <li><strong>Cartão lateral fixo.</strong> A descrição raspada pode ser longa e desestruturada; a decisão de ir à origem não deve exigir rolar de volta.</li>
          <li><strong>"Já me candidatei" é autodeclarado.</strong> Sem acesso ao sistema da empresa, o StartMe não sabe se você de fato se candidatou — a marcação é sua, e o texto diz isso. Nesta versão, marcar cria de fato um registro mock em "Minhas candidaturas", persistido no seu navegador.</li>
          <li><strong>Link para a origem é obrigatório.</strong> Transparência de fonte e respeito ao portal de onde a vaga veio — aparece na listagem e no detalhe.</li>
          <li><strong>Percentual + critérios lado a lado.</strong> Nenhuma pontuação opaca: o número nunca aparece sem a lista de razões que o produziu.</li>
          <li><strong>"Coletada em", jamais "publicada em".</strong> <code>data_coleta</code> é a data da nossa captura; a banca pode perguntar e a interface responde sozinha.</li>
        `) : ''}
      </aside>
    </div>
  </main>`;
}

// ------------------------------------------------------------------
// Prancha 4 — Painel inicial
// ------------------------------------------------------------------
function renderHome(s) {
  const vagas = s.vagas;
  const indicadores = [
    { rotulo: 'Vagas ativas hoje', valor: vagas.length, nota: 'Após remover as expiradas na origem' },
    { rotulo: 'Compatíveis com o seu semestre', valor: vagas.filter((v) => v.pct >= 70 && v.semestreMin <= s.semestreAluno).length, nota: `${s.semestreAluno}º semestre de Engenharia de Computação` },
    { rotulo: 'Candidaturas em andamento', valor: s.candidaturas.filter((c) => ['enviada', 'analise', 'entrevista'].includes(c.status)).length, nota: 'Enviada, em análise ou entrevista' }
  ];
  const recomendadas = vagas.slice().sort((a, b) => b.pct - a.pct).slice(0, 3).map(App._internal.enfeitar);
  const recentes = vagas.slice().sort((a, b) => a.dias - b.dias).slice(0, 4).map(App._internal.enfeitar);

  return `
  <main class="sm-container">
    <div class="sm-row">
      <div class="sm-col-main" style="display:flex;flex-direction:column;gap:22px">
        <div class="sm-indicadores">
          ${indicadores.map((k) => `<div class="sm-indicador">
            <div class="sm-indicador__rotulo">${esc(k.rotulo)}</div>
            <div class="sm-indicador__valor">${k.valor}</div>
            <div class="sm-indicador__nota">${esc(k.nota)}</div>
          </div>`).join('')}
        </div>

        <section>
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;justify-content:space-between;margin-bottom:12px">
            <h2 style="font-size:20px;color:var(--texto-primario);font-family:var(--fonte-corpo)">Recomendadas para você</h2>
            <button type="button" class="sm-btn-texto" onclick="App.irView('lista')">Ver todas as vagas</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
            ${recomendadas.map((v) => `
              <article class="sm-card sm-card--pad-sm" style="display:flex;flex-direction:column;gap:12px">
                <div style="display:flex;gap:11px;align-items:flex-start">
                  <div class="sm-monograma sm-monograma--md" aria-hidden="true">${esc(v.monograma)}</div>
                  <div style="min-width:0">
                    <h3 style="font-size:15px;line-height:1.35;color:var(--texto-primario);font-family:var(--fonte-corpo)">${esc(v.titulo)}</h3>
                    <div style="margin-top:2px;font-size:13px;color:var(--texto-secundario)">${esc(v.empresa)}</div>
                  </div>
                </div>
                <div style="display:inline-flex;flex-direction:column;gap:2px;background:var(--agua-50);border:1px solid var(--agua-200);border-radius:10px;padding:8px 10px">
                  <div style="font-size:13.5px;font-weight:700;color:var(--agua-700)">◆ ${v.rotuloCompat}</div>
                  <div style="font-size:12px;line-height:1.45;color:var(--agua-700)">${esc(v.razao)}</div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12.5px;color:var(--texto-secundario)">
                  ${v.temSalario ? `<strong style="color:var(--texto-primario);font-size:13.5px">${esc(v.salario)}</strong>` : `<span style="border:1px dashed var(--borda-forte);border-radius:8px;padding:2px 7px;color:var(--texto-terciario);font-weight:600">Salário não informado</span>`}
                  <span>Coletada ${v.quandoTxt}</span>
                </div>
                <button type="button" class="sm-btn sm-btn-primario" onclick="App.abrirVaga('${v.id}')">Ver detalhes</button>
              </article>`).join('')}
          </div>
        </section>

        <section>
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;justify-content:space-between;margin-bottom:12px">
            <h2 style="font-size:20px;color:var(--texto-primario);font-family:var(--fonte-corpo)">Coletadas recentemente</h2>
            <span style="font-size:12.5px;color:var(--texto-terciario)">${s.vagasFonte === 'mock' ? 'Dados de demonstração' : 'Última atualização: coleta real'}</span>
          </div>
          <div class="sm-lista-recentes">
            ${recentes.map((v) => `<button type="button" class="sm-recente-row" onclick="App.abrirVaga('${v.id}')">
              <div class="sm-monograma sm-monograma--sm" aria-hidden="true">${esc(v.monograma)}</div>
              <div style="flex:999 1 200px;min-width:0">
                <div style="font-size:14.5px;font-weight:600;color:var(--texto-primario)">${esc(v.titulo)}</div>
                <div style="font-size:12.5px;color:var(--texto-secundario)">${esc(v.empresa)} · ${esc(v.modalidade)}</div>
              </div>
              <div style="flex:none;font-size:12.5px;color:var(--texto-terciario)">Coletada ${v.quandoTxt}</div>
            </button>`).join('')}
          </div>
        </section>
      </div>

      ${App._internal.notasVisiveis() ? renderNotas('4', 'Painel inicial do aluno', `
        <li><strong>A faixa de contexto é a prova da integração.</strong> Nome, curso e semestre no topo, com o selo "Vindo do Portal Acadêmico" — o argumento central do produto na primeira linha da primeira tela.</li>
        <li><strong>Três contagens, nada de gráfico.</strong> São <code>count()</code> que o backend já sabe fazer; qualquer painel além disso seria dado que não existe.</li>
        <li><strong>O horário da coleta é discreto, mas está lá.</strong> Explica por que a lista não muda a cada minuto e prepara o estado 3 da Prancha 10.</li>
        <li><strong>Recomendadas usam o mesmo componente da Prancha 5.</strong> Cartão de vaga em variante compacta — um componente, não dois.</li>
      `) : ''}
    </div>
  </main>`;
}

// ------------------------------------------------------------------
// Prancha 8 — Minhas candidaturas
// ------------------------------------------------------------------
function renderCandidaturas(s) {
  const candFiltradas = s.statusFiltro === 'todos' ? s.candidaturas : s.candidaturas.filter((c) => c.status === s.statusFiltro);
  const totalTxt = s.candidaturas.length === 1 ? '1 candidatura' : s.candidaturas.length + ' candidaturas';
  const statusRotulo = { enviada: ['→', 'Enviada', 'info'], analise: ['◐', 'Em análise', 'atencao'], entrevista: ['◆', 'Entrevista', 'agua'], recusada: ['✕', 'Não selecionado', 'erro'], finalizada: ['✓', 'Finalizada', 'sucesso'] };

  function pillStatus(status) {
    const [icone, label, tom] = statusRotulo[status] || ['', status, 'info'];
    const classe = tom === 'agua' ? 'sm-pill--sucesso' : `sm-pill--${tom}`;
    const estiloAgua = tom === 'agua' ? 'style="background:var(--agua-50);border-color:var(--agua-200);color:var(--agua-700)"' : '';
    return `<span class="sm-pill ${classe}" ${estiloAgua}>${icone} ${esc(label)}</span>`;
  }

  return `
  <main class="sm-container">
    <div class="sm-row">
      <section class="sm-col-main">
        <h1 style="font-size:24px;letter-spacing:-.01em;color:var(--texto-primario);margin-bottom:4px">Minhas candidaturas</h1>
        <p style="margin:0 0 16px;font-size:14px;color:var(--texto-secundario)">${totalTxt} · o status é atualizado pela empresa; o StartMe não altera nada por conta própria.</p>

        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px">
          ${STATUS_FILTROS_DEF.map(([v, label]) => `<button type="button" class="sm-btn-chip sm-btn-chip--pilula${s.statusFiltro === v ? ' is-on' : ''}" aria-pressed="${s.statusFiltro === v}" onclick="App.setStatusFiltro('${v}')">${esc(label)}</button>`).join('')}
        </div>

        <div class="sm-cand-tabela">
          <div class="sm-cand-head">
            <div style="flex:999 1 220px">Vaga e empresa</div>
            <div style="flex:0 0 120px">Enviada em</div>
            <div style="flex:0 0 150px">Status</div>
            <div style="flex:0 0 44px"></div>
          </div>
          ${candFiltradas.map((c) => {
            const aberta = s.candAberta === c.protocolo;
            return `<div style="border-bottom:1px solid #E4EBF4">
              <button type="button" class="sm-cand-row-btn" aria-expanded="${aberta}" onclick="App.toggleCandAberta('${c.protocolo}')">
                <div style="flex:999 1 220px;min-width:0;display:flex;gap:11px;align-items:center">
                  <div class="sm-monograma sm-monograma--sm" aria-hidden="true">${esc(c.empresa.trim().charAt(0).toUpperCase())}</div>
                  <div style="min-width:0">
                    <div style="font-size:14.5px;font-weight:600;color:var(--texto-primario)">${esc(c.titulo)}</div>
                    <div style="font-size:12.5px;color:var(--texto-secundario)">${esc(c.empresa)} · protocolo ${esc(c.protocolo)}</div>
                  </div>
                </div>
                <div style="flex:0 0 120px;font-size:13px;color:var(--texto-secundario);font-variant-numeric:tabular-nums">${esc(c.data)}</div>
                <div style="flex:0 0 150px">${pillStatus(c.status)}</div>
                <div style="flex:0 0 44px;text-align:right;color:var(--texto-terciario);font-size:12px">${aberta ? '▲ fechar' : '▼ abrir'}</div>
              </button>
              ${aberta ? `<div class="sm-cand-detalhe">
                <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--texto-terciario);margin-bottom:12px">Linha do tempo</div>
                <ol class="sm-timeline">
                  ${c.etapas.map((e) => `<li>${e.feita ? '<span aria-hidden="true" class="sm-timeline__ponto-ok">✓</span>' : '<span aria-hidden="true" class="sm-timeline__ponto-pendente"></span>'}
                    <div>
                      <div style="font-size:14px;font-weight:600;color:var(--texto-primario)">${esc(e.nome)}</div>
                      <div style="font-size:12.5px;color:var(--texto-secundario)">${esc(e.quando)}</div>
                    </div>
                  </li>`).join('')}
                </ol>
                <a href="${esc(linkSeguro(c.link))}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:14px;font-size:13px">Ver anúncio original ↗</a>
              </div>` : ''}
            </div>`;
          }).join('')}
          ${candFiltradas.length === 0 ? `<div style="padding:36px 20px;text-align:center">
            <div style="font-size:16px;font-weight:700;color:var(--texto-primario)">Nenhuma candidatura com esse status</div>
            <button type="button" class="sm-btn sm-btn-secundario" style="margin-top:12px" onclick="App.limparStatus()">Ver todas</button>
          </div>` : ''}
        </div>
      </section>

      ${App._internal.notasVisiveis() ? renderNotas('8', 'Minhas candidaturas', `
        <li><strong>Nunca só cor.</strong> Cada um dos cinco status tem ícone, texto e cor própria — quem não distingue verde de vermelho lê "Não selecionado" do mesmo jeito.</li>
        <li><strong>Lista, não tabela.</strong> Em 360px uma tabela de quatro colunas quebra; a linha vira cartão empilhado com os mesmos dados e sem rolagem horizontal.</li>
        <li><strong>A linha expande no lugar.</strong> Abrir a linha do tempo não é outra rota nem modal — é <code>aria-expanded</code> em um botão, o padrão mais simples de implementar e o mais acessível.</li>
        <li><strong>Protocolo visível na linha.</strong> É o número que o aluno leva para a empresa; escondê-lo dentro do detalhe seria esconder a única prova do envio.</li>
        <li><strong>Etapas futuras aparecem tracejadas.</strong> A linha do tempo mostra o que falta sem prometer prazo que o StartMe não controla.</li>
        <li><strong>Sem endpoint real ainda.</strong> Não existe <code>GET/POST /api/candidaturas</code> em nenhum backend; esta lista combina a seed de demonstração com candidaturas marcadas por você, persistidas em localStorage.</li>
      `) : ''}
    </div>
  </main>`;
}

// ------------------------------------------------------------------
// Prancha 9 — Perfil
// ------------------------------------------------------------------
function renderPerfil(s) {
  const perfilAtual = s.perfilRascunho ? { ...s.perfil, ...s.perfilRascunho } : s.perfil;
  const camposEditaveis = [
    { campo: 'email', rotulo: 'E-mail de contato', dica: 'seu.nome@aluno.fsa.br' },
    { campo: 'telefone', rotulo: 'Telefone', dica: '(11) 9 0000-0000' },
    { campo: 'disponibilidade', rotulo: 'Disponibilidade de horário', dica: 'Manhã · 6h/dia' },
    { campo: 'github', rotulo: 'GitHub', dica: 'github.com/usuario' },
    { campo: 'linkedin', rotulo: 'LinkedIn', dica: 'linkedin.com/in/usuario' }
  ];
  const fonteAcademico = s.academicoFonte === 'mock'
    ? '<span class="sm-pill sm-pill--atencao" style="text-transform:none;letter-spacing:normal;font-weight:600">Dados de demonstração — cadastro indisponível</span>'
    : '<span class="sm-pill sm-pill--sucesso" style="font-weight:600">Dados reais do cadastro</span>';

  return `
  <main class="sm-container">
    <div class="sm-row">
      <div class="sm-col-main" style="display:flex;flex-direction:column;gap:16px">
        <h1 style="font-size:24px;letter-spacing:-.01em;color:var(--texto-primario)">Meu perfil</h1>

        <section class="sm-card">
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:6px">
            <h2 style="font-size:18px;color:var(--texto-primario)">Dados acadêmicos</h2>
            <span class="sm-pill sm-pill--inst">Somente leitura</span>
            ${fonteAcademico}
          </div>
          <p style="margin:0 0 16px;font-size:13.5px;line-height:1.55;color:var(--texto-secundario)">Estes campos vêm do Portal Acadêmico (GET ${esc(CONFIG.CADASTRO_URL)}/alunos/${CONFIG.ID_ALUNO_DEMO}) e não podem ser alterados aqui. Correções são feitas na <strong>secretaria acadêmica</strong>; na próxima sessão o StartMe já lê o valor novo.</p>
          <div class="sm-field--readonly" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px">
            ${s.academicoCampos.map((c) => `<div>
              <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--texto-terciario);margin-bottom:5px">${esc(c.rotulo)} · Vindo do Portal Acadêmico</div>
              <div class="sm-readonly-box">${esc(c.valor)}</div>
            </div>`).join('')}
          </div>
        </section>

        <section class="sm-card">
          <h2 style="font-size:18px;color:var(--texto-primario);margin-bottom:6px">Dados de empregabilidade</h2>
          <p style="margin:0 0 16px;font-size:13.5px;line-height:1.55;color:var(--texto-secundario)">Você controla estes campos. Não existe coluna para eles no schema relacional do cadastro (tabela <code>Aluno</code>): ficam salvos neste navegador (localStorage) e são usados apenas para montar sua candidatura.</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px">
            ${camposEditaveis.map((c) => `<div class="sm-field">
              <label for="perfil-${c.campo}">${esc(c.rotulo)}</label>
              <input id="perfil-${c.campo}" type="text" value="${esc(perfilAtual[c.campo])}" oninput="App.setPerfilCampo('${c.campo}', this.value)" placeholder="${esc(c.dica)}">
            </div>`).join('')}
          </div>

          <div style="margin-top:18px">
            <div style="font-size:12.5px;font-weight:600;color:var(--texto-primario);margin-bottom:6px">Áreas de interesse</div>
            <div class="sm-chips-wrap">
              ${AREAS.map((a) => `<button type="button" class="sm-btn-chip${s.interesses.includes(a) ? ' is-on' : ''}" aria-pressed="${s.interesses.includes(a)}" onclick="App.toggleInteresse('${a}')">${s.interesses.includes(a) ? '<span aria-hidden="true" style="color:var(--agua-700)">✓ </span>' : ''}${esc(a)}</button>`).join('')}
            </div>
          </div>

          <div style="margin-top:18px">
            <div style="font-size:12.5px;font-weight:600;color:var(--texto-primario);margin-bottom:6px">Currículo anexado</div>
            <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;border:1px solid var(--sucesso-borda);background:var(--sucesso-fundo);border-radius:12px;padding:13px 15px">
              <div style="flex:1 1 160px;min-width:0">
                <div style="font-size:14px;font-weight:700;color:var(--sucesso-texto)">curriculo_vinicius.pdf</div>
                <div style="font-size:12px;color:var(--sucesso-texto)">240 KB · atualizado em 28/08/2026</div>
              </div>
              <button type="button" class="sm-btn sm-btn-secundario" style="border-color:var(--sucesso-borda);color:var(--sucesso-texto)" onclick="App.nadaAinda()">Substituir</button>
            </div>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:20px;border-top:1px solid #E4EBF4;padding-top:18px">
            <button type="button" class="sm-btn sm-btn-primario" style="min-height:48px;font-size:15px;font-weight:700" onclick="App.salvarPerfilForm()">Salvar alterações</button>
            <button type="button" class="sm-btn sm-btn-secundario" style="min-height:48px;font-size:15px" onclick="App.descartarPerfilForm()">Descartar</button>
          </div>
        </section>

        <section class="sm-card" style="border-color:var(--info-borda)">
          <h2 style="font-size:18px;color:var(--texto-primario);margin-bottom:6px">Privacidade e seus direitos</h2>
          <p style="margin:0 0 16px;max-width:70ch;font-size:13.5px;line-height:1.55;color:var(--texto-secundario)">Você autorizou o compartilhamento de vínculo, nome, curso e semestre em <strong>28/08/2026</strong>. Pode exportar ou revogar a qualquer momento.</p>
          <div style="display:flex;flex-wrap:wrap;gap:10px">
            <button type="button" class="sm-btn sm-btn-secundario" style="min-height:48px;font-size:14.5px" onclick="App.nadaAinda()">Baixar meus dados</button>
            <button type="button" class="sm-btn sm-btn-perigo" style="min-height:48px;font-size:14.5px" onclick="App.revogar()"><span aria-hidden="true">⚑</span> Revogar autorização de dados acadêmicos</button>
          </div>
          <p style="margin:12px 0 0;font-size:12.5px;line-height:1.55;color:var(--texto-terciario)">Revogar mantém sua conta e suas candidaturas já enviadas, mas desliga a ordenação por compatibilidade até você autorizar de novo.</p>
        </section>
      </div>

      ${App._internal.notasVisiveis() ? renderNotas('9', 'Perfil do aluno', `
        <li><strong>Duas seções que não se confundem.</strong> O que vem do portal tem fundo cinza, cadeado e rótulo de origem; o que é seu tem campo branco e editável — a diferença é estrutural, não textual.</li>
        <li><strong>Somente leitura com saída.</strong> Bloquear sem dizer o que fazer é um beco: o texto manda para a secretaria acadêmica e avisa que o valor novo entra na próxima sessão.</li>
        <li><strong>Sem CPF, sem matrícula, sem idade.</strong> Nada além dos quatro dados autorizados aparece — nem "últimos dígitos", porque aqui nenhum identificador é necessário.</li>
        <li><strong>Exportar e revogar são botões reais.</strong> Portabilidade e reversibilidade da LGPD viram dois cliques, e a revogação declara sua consequência antes de acontecer.</li>
      `) : ''}
    </div>
  </main>`;
}

// ------------------------------------------------------------------
// Prancha 12 — Currículo
// ------------------------------------------------------------------
function renderCurriculo(s) {
  const habilidades = CURRICULO_SECOES.habilidades.concat(s.certificados.filter((c) => c.incluido).map((c) => c.habilidade));
  return `
  <main class="sm-container">
    <div class="sm-row">
      <div class="sm-col-main" style="display:flex;flex-direction:column;gap:16px;flex:999 1 460px">
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;justify-content:space-between">
          <h1 style="font-size:24px;letter-spacing:-.01em;color:var(--texto-primario)">Meu currículo</h1>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="sm-btn sm-btn-secundario" style="font-size:13.5px" onclick="App.nadaAinda()">Exportar .docx</button>
            <button type="button" class="sm-btn sm-btn-secundario" style="font-size:13.5px" onclick="App.nadaAinda()">Exportar .xlsx</button>
          </div>
        </div>
        <p style="margin:0;font-size:13.5px;line-height:1.55;color:var(--texto-secundario)">Monte aqui o currículo que você vai enviar nos sites das empresas. O StartMe organiza e formata — o envio continua sendo feito por você, no link de origem de cada vaga.</p>

        <section class="sm-card">
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px">
            <h2 style="font-size:17px;color:var(--texto-primario)">Formação</h2>
            <span class="sm-pill sm-pill--inst">Vindo do Portal Acadêmico</span>
          </div>
          ${CURRICULO_SECOES.formacao.map((f) => `<div class="sm-curriculo-formacao">
            <div style="font-size:14.5px;font-weight:700;color:var(--texto-primario)">${esc(f.curso)}</div>
            <div style="font-size:13px;color:var(--texto-secundario)">${esc(f.instituicao)}</div>
            <div style="font-size:12.5px;color:var(--texto-terciario);margin-top:2px">${esc(f.periodo)}</div>
          </div>`).join('')}
        </section>

        <section class="sm-card">
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;justify-content:space-between;margin-bottom:12px">
            <h2 style="font-size:17px;color:var(--texto-primario)">Experiências</h2>
            <button type="button" class="sm-btn-texto" onclick="App.nadaAinda()">+ Adicionar experiência</button>
          </div>
          <div style="border:1px dashed var(--borda-forte);border-radius:10px;padding:20px;text-align:center;font-size:13.5px;color:var(--texto-terciario)">Nenhuma experiência adicionada ainda. Estágios encontrados pelo StartMe não entram aqui automaticamente — você registra o que já cursou ou trabalhou.</div>
        </section>

        <section class="sm-card">
          <h2 style="font-size:17px;color:var(--texto-primario);margin-bottom:12px">Habilidades</h2>
          <div class="sm-chips-wrap">
            ${habilidades.map((h) => `<span class="sm-pill sm-pill--info">${esc(h)}</span>`).join('')}
          </div>
          <p style="margin:12px 0 0;font-size:12.5px;color:var(--texto-terciario)">As destacadas na Prancha 13 vieram de certificados enviados por você.</p>
        </section>

        <section class="sm-card">
          <h2 style="font-size:17px;color:var(--texto-primario);margin-bottom:12px">Idiomas e links</h2>
          <div class="sm-chips-wrap" style="margin-bottom:12px">
            ${CURRICULO_SECOES.idiomas.map((i) => `<span class="sm-pill sm-pill--neutro">${esc(i)}</span>`).join('')}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:16px;font-size:13.5px;color:var(--acao-700)">
            <span>${esc(CURRICULO_SECOES.links.github)}</span>
            <span>${esc(CURRICULO_SECOES.links.linkedin)}</span>
          </div>
        </section>
      </div>

      ${App._internal.notasVisiveis() ? renderNotas('12', 'Meu currículo', `
        <li><strong>Resolve manutenção, não candidatura.</strong> O StartMe não envia isso a empresa alguma; ele só ajuda a montar e manter atualizado o arquivo que você leva para o site de origem.</li>
        <li><strong>Formação é somente leitura, o resto é seu.</strong> Mesma regra da Prancha 9: o que vem do portal tem cadeado, o que você escreve é editável.</li>
        <li><strong>Exportar para .docx e .xlsx é o requisito central.</strong> O aluno precisa continuar podendo editar na própria máquina antes de enviar num site externo.</li>
        <li><strong>Habilidades de certificado aparecem aqui, mas se gerenciam na Prancha 13.</strong> Um lugar só para adicionar evidência, sem duplicar o controle.</li>
      `) : ''}
    </div>
  </main>`;
}

// ------------------------------------------------------------------
// Prancha 13 — Certificados
// ------------------------------------------------------------------
function renderCertificados(s) {
  return `
  <main class="sm-container">
    <div class="sm-row">
      <div class="sm-col-main" style="display:flex;flex-direction:column;gap:16px;flex:999 1 460px">
        <h1 style="font-size:24px;letter-spacing:-.01em;color:var(--texto-primario)">Certificados</h1>
        <p style="margin:0;font-size:13.5px;line-height:1.55;color:var(--texto-secundario)">Envie certificados de cursos e cada um pode virar uma habilidade no seu currículo, sem digitar de novo.</p>

        <button type="button" class="sm-upload-drop" onclick="App.nadaAinda()">
          <div style="font-size:15px;font-weight:700;color:var(--texto-primario)">Arraste um certificado aqui ou clique para escolher</div>
          <div style="margin-top:4px;font-size:13px;color:var(--texto-secundario)">PDF ou imagem, até 5 MB</div>
        </button>

        <div class="sm-alerta sm-alerta--atencao">
          <span aria-hidden="true">⚑</span>
          <div><strong>Leitura automática do certificado é pendente de implementação.</strong> Extrair o nome do curso e a habilidade de um PDF exige OCR/parsing no backend — ainda não definido. Nesta prancha, os certificados abaixo estão pré-carregados para ilustrar o fluxo já com a habilidade extraída.</div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${s.certificados.map((c) => `<div class="sm-certificado-row">
            <div style="flex:1 1 200px;min-width:0">
              <div style="font-size:14px;font-weight:700;color:var(--texto-primario)">${esc(c.nome)}</div>
              <div style="font-size:12.5px;color:var(--texto-secundario)">Habilidade identificada: ${esc(c.habilidade)}</div>
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--texto-primario);cursor:pointer">
              <input type="checkbox" class="sm-checkbox" style="width:19px;height:19px" ${c.incluido ? 'checked' : ''} onchange="App.toggleCertificado('${c.id}')">
              Incluir no currículo
            </label>
          </div>`).join('')}
        </div>
      </div>

      ${App._internal.notasVisiveis() ? renderNotas('13', 'Certificados', `
        <li><strong>O aviso de pendência é honesto.</strong> Ler um PDF e extrair a habilidade é OCR/parsing real; a tela mostra o resultado esperado, não finge que o backend já existe.</li>
        <li><strong>Cada certificado tem um interruptor, não uma decisão automática.</strong> A habilidade só entra no currículo se você confirmar — evita currículo inflado por um certificado irrelevante.</li>
        <li><strong>Atualiza o currículo, não substitui.</strong> As habilidades de certificado se somam às da Prancha 12; nada é sobrescrito.</li>
      `) : ''}
    </div>
  </main>`;
}

// ------------------------------------------------------------------
// Prancha 10 — Estados de exceção
// ------------------------------------------------------------------
function renderExcecoes(s) {
  return `
  <main class="sm-container sm-container--sistema">
    <header style="margin-bottom:20px">
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--texto-terciario)">Prancha 10</div>
      <h1 style="font-size:30px;letter-spacing:-.02em;color:var(--texto-primario);margin:6px 0">Estados de exceção</h1>
      <p style="margin:0;max-width:70ch;font-size:15px;line-height:1.6;color:var(--texto-secundario)">Os seis estados que a Prancha 5 pode assumir quando nada corre bem. Todos com saída — nenhum termina em tela morta.</p>
    </header>

    <div class="sm-excecoes-grid">
      <section class="sm-excecao-card">
        <div class="sm-excecao-head"><div class="sm-excecao-head__eyebrow">1 · Carregando</div><div class="sm-excecao-head__sub">Esqueleto da lista, não spinner central</div></div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px" aria-busy="true">
          <div style="border:1px solid #E4EBF4;border-radius:12px;padding:14px;display:flex;gap:12px">
            <div style="width:44px;height:44px;flex:none;border-radius:11px" class="sm-skeleton"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:8px">
              <div style="height:14px;width:74%" class="sm-skeleton"></div>
              <div style="height:11px;width:42%" class="sm-skeleton-sub"></div>
              <div style="height:11px;width:58%" class="sm-skeleton-sub"></div>
            </div>
          </div>
          <div style="border:1px solid #E4EBF4;border-radius:12px;padding:14px;display:flex;gap:12px">
            <div style="width:44px;height:44px;flex:none;border-radius:11px" class="sm-skeleton"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:8px">
              <div style="height:14px;width:62%" class="sm-skeleton"></div>
              <div style="height:11px;width:50%" class="sm-skeleton-sub"></div>
              <div style="height:11px;width:36%" class="sm-skeleton-sub"></div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--texto-terciario)">O esqueleto tem a forma do cartão de vaga: nada salta de posição quando os dados chegam.</div>
        </div>
      </section>

      <section class="sm-excecao-card">
        <div class="sm-excecao-head"><div class="sm-excecao-head__eyebrow">2 · Lista vazia por filtro</div><div class="sm-excecao-head__sub">O acervo tem vagas; o recorte não</div></div>
        <div class="sm-excecao-body sm-empty-state--sm" style="text-align:center">
          <div class="sm-empty-state__titulo">Nenhuma vaga encontrada com esses filtros</div>
          <p style="max-width:38ch;margin:6px auto 16px;font-size:13.5px">A coleta de hoje trouxe ${s.vagas.length} vagas ativas. Afrouxe um critério para voltar a vê-las.</p>
          <button type="button" class="sm-btn sm-btn-primario" onclick="App.irListaLimpa()">Limpar filtros</button>
        </div>
      </section>

      <section class="sm-excecao-card">
        <div class="sm-excecao-head"><div class="sm-excecao-head__eyebrow">3 · Lista vazia por origem</div><div class="sm-excecao-head__sub">A coleta rodou e não trouxe nada</div></div>
        <div class="sm-excecao-body" style="text-align:center">
          <div style="font-size:16px;font-weight:700;color:var(--texto-primario)">A coleta de hoje ainda não trouxe vagas novas</div>
          <p style="margin:6px auto 14px;max-width:40ch;font-size:13.5px;line-height:1.55;color:var(--texto-secundario)">A última execução foi hoje às 06:00 e os portais de origem não publicaram vagas novas de TI desde então.</p>
          <div class="sm-pill sm-pill--info" style="display:inline-flex"><span aria-hidden="true">ⓘ</span> Próxima coleta programada: amanhã às 06:00</div>
        </div>
      </section>

      <section class="sm-excecao-card sm-excecao-card--erro">
        <div class="sm-excecao-head"><div class="sm-excecao-head__eyebrow">4 · Falha de rede ou serviço</div><div class="sm-excecao-head__sub">Mensagem honesta, com cache declarado</div></div>
        <div class="sm-excecao-body">
          <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px">
            <span aria-hidden="true" style="color:var(--erro-texto);font-size:16px">✕</span>
            <div>
              <div style="font-size:16px;font-weight:700;color:var(--texto-primario)">Não conseguimos falar com o serviço de vagas</div>
              <p style="margin:5px 0 0;font-size:13.5px;line-height:1.55;color:var(--texto-secundario)">A verificação em <code>/health</code> não respondeu. Não é a sua conexão.</p>
            </div>
          </div>
          <div class="sm-alerta sm-alerta--atencao" style="margin-bottom:14px">
            <span aria-hidden="true">⚑</span><div>As vagas abaixo são do último carregamento, de <strong>hoje às 06:04</strong>. Podem já ter sido preenchidas na origem.</div>
          </div>
          <button type="button" class="sm-btn sm-btn-primario" onclick="App.nadaAinda()">Tentar novamente</button>
        </div>
      </section>

      <section class="sm-excecao-card">
        <div class="sm-excecao-head"><div class="sm-excecao-head__eyebrow">5 · Sessão expirada</div><div class="sm-excecao-head__sub">Reautenticar sem perder o contexto</div></div>
        <div class="sm-excecao-body">
          <div style="border:1px solid var(--borda);border-radius:12px;background:#F8FBFD;padding:18px;text-align:center">
            <div class="sm-monograma" style="margin:0 auto 12px" aria-hidden="true">S</div>
            <div style="font-size:16px;font-weight:700;color:var(--texto-primario)">Sua sessão expirou por inatividade</div>
            <p style="margin:6px auto 16px;max-width:40ch;font-size:13.5px;line-height:1.55;color:var(--texto-secundario)">Você estava em <strong>Estagiário de Desenvolvimento Back-end Python — Nexus Sistemas</strong>. Entre de novo e voltamos exatamente para essa vaga.</p>
            <div style="display:flex;flex-wrap:wrap;gap:9px;justify-content:center">
              <button type="button" class="sm-btn sm-btn-primario" onclick="App.irLogin()">Entrar novamente</button>
              <button type="button" class="sm-btn sm-btn-secundario" onclick="App.nadaAinda()">Continuar sem entrar</button>
            </div>
            <p style="margin:12px 0 0;font-size:12px;color:var(--texto-terciario)">Sem autenticar você continua vendo as vagas, mas sem compatibilidade e sem candidatar-se.</p>
          </div>
        </div>
      </section>

      <section class="sm-excecao-card sm-excecao-card--atencao">
        <div class="sm-excecao-head"><div class="sm-excecao-head__eyebrow">6 · Sem autorização de dados</div><div class="sm-excecao-head__sub">Quem recusou a Prancha 3 vê isto</div></div>
        <div class="sm-excecao-body">
          <div style="font-size:16px;font-weight:700;color:var(--texto-primario)">O StartMe funciona, mas às cegas</div>
          <p style="margin:6px 0 14px;font-size:13.5px;line-height:1.55;color:var(--texto-secundario)">Sem o seu curso e semestre não há como dizer se uma vaga combina com o seu momento no curso. A busca e os filtros continuam funcionando.</p>
          <ul style="margin:0 0 16px;padding-left:18px;display:flex;flex-direction:column;gap:7px;font-size:13.5px;line-height:1.5;color:var(--texto-secundario)">
            <li>Sem ordenação por compatibilidade e sem selo nos cartões</li>
            <li>Sem preenchimento automático na candidatura</li>
            <li>Nenhum dado seu é enviado a empresa alguma</li>
          </ul>
          <div style="display:flex;flex-wrap:wrap;gap:9px">
            <button type="button" class="sm-btn sm-btn-primario" onclick="App.irConsent()">Autorizar agora</button>
            <button type="button" class="sm-btn sm-btn-secundario" onclick="App.irListaLimpa()">Continuar sem autorizar</button>
          </div>
        </div>
      </section>
    </div>

    ${App._internal.notasVisiveis() ? `<div style="margin-top:20px">${renderNotas('10', 'Estados de exceção', `
      <li><strong>Vazio por filtro ≠ vazio por origem.</strong> São causas diferentes e exigem ações diferentes — juntá-los na mesma mensagem faria o aluno limpar filtros que não são o problema.</li>
      <li><strong>Esqueleto com a forma do cartão.</strong> Evita salto de layout e já comunica que vem uma lista, não um formulário.</li>
      <li><strong>Falha declara o cache.</strong> Mostrar dados velhos sem avisar seria desonesto; a faixa âmbar diz a hora exata do último carregamento.</li>
      <li><strong>Sessão expirada preserva o destino.</strong> A vaga onde o aluno estava é citada por nome e ele volta para ela — sem isso, expirar sessão custa a candidatura.</li>
      <li><strong>Recusar consentimento não bloqueia o produto.</strong> Degrada com honestidade e lista o que se perde, mantendo o caminho para autorizar depois.</li>
    `, true)}</div>` : ''}
  </main>`;
}

// ------------------------------------------------------------------
// Prancha 11 — Sistema de design
// ------------------------------------------------------------------
function swatch(nome, hex, corDeFundo) {
  return `<div class="sm-swatch"><div class="sm-swatch__cor" style="background:${corDeFundo || hex}"></div><div class="sm-swatch__legenda"><div class="sm-swatch__nome">${nome}</div><div class="sm-swatch__hex">${hex}</div></div></div>`;
}

function renderSistema(s) {
  return `
  <main class="sm-container sm-container--sistema">
    <header>
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--texto-terciario)">Prancha 11</div>
      <h1 style="font-size:32px;font-weight:700;letter-spacing:-.025em;color:var(--texto-primario);margin:6px 0">Sistema de design StartMe</h1>
      <p style="margin:0;max-width:70ch;font-size:15px;line-height:1.6;color:var(--texto-secundario)">Referência única de implementação: tokens semânticos, escalas e componentes em todos os estados. Um desenvolvedor iniciante deve conseguir montar a Prancha 5 lendo só esta página.</p>
    </header>

    <section class="sm-card" style="margin-top:20px">
      <h2 style="font-size:20px;color:var(--texto-primario);margin-bottom:4px">Cor</h2>
      <p style="margin:0 0 14px;font-size:14px;color:var(--texto-secundario)">Base retirada do <strong>Manual da Marca da Fundação Santo André</strong>: Azul Institucional <code>#042D5C</code> e Verde-água como cor secundária. Nomes semânticos, nunca literais — é o que torna o modo escuro possível depois sem refazer o design.</p>
      <div class="sm-alerta sm-alerta--info" style="margin-bottom:18px">
        <span aria-hidden="true">ⓘ</span>
        <div>O manual declara o hexadecimal apenas do Azul Institucional. O Verde-água (<code>#00A99D</code>) foi derivado da amostra impressa e <strong>precisa da sua confirmação</strong> — está exposto como tweak para você corrigir sem tocar no código.</div>
      </div>

      <div class="sm-sistema-eyebrow">Ação — Azul Institucional, só para o que é clicável</div>
      <div class="sm-swatch-grid">
        ${swatch('acao-50', '#EAF1F9')}${swatch('acao-300 · anel de foco', '#7FA8D4')}${swatch('acao-600 · padrão', '#042D5C')}${swatch('acao-700 · sobre', '#0A4A8F')}${swatch('acao-800 · pressionado', '#02203F')}
      </div>

      <div class="sm-sistema-eyebrow">Verde-água — cor secundária do manual, reservada à compatibilidade</div>
      <div class="sm-swatch-grid">
        ${swatch('agua-50 · superfície', '#E3F6F4')}${swatch('agua-200 · borda', '#A6E1DC')}${swatch('agua-500 · só preenchimento', '#00A99D')}${swatch('agua-700 · texto 4,8:1', '#067A73')}${swatch('gradiente-entrada', '140° inst-700→900', 'linear-gradient(140deg,#0A4A8F,#042D5C)')}
      </div>

      <div class="sm-sistema-eyebrow">Superfície, texto e borda — neutros azulados</div>
      <div class="sm-swatch-grid">
        ${swatch('superficie', '#FFFFFF')}${swatch('superficie-alt', '#F6F9FC')}${swatch('fundo', '#F1F5FA')}${swatch('borda', '#D5E0EE')}${swatch('borda-forte', '#B4C5DA')}${swatch('texto-primario · 14,8:1', '#0E2138')}${swatch('texto-secundario · 7,0:1', '#465A73')}${swatch('texto-terciario · 3,6:1', '#64768F')}
      </div>

      <div class="sm-sistema-eyebrow">Semânticas — cada uma com par texto/superfície e ícone obrigatório</div>
      <div class="sm-cobertura-grid">
        <div class="sm-alerta sm-alerta--sucesso">✓ sucesso · candidatura enviada</div>
        <div class="sm-alerta sm-alerta--atencao">⚑ atenção · vaga expirando</div>
        <div class="sm-alerta sm-alerta--erro">✕ erro · credencial inválida</div>
        <div class="sm-alerta sm-alerta--info">ⓘ informação · origem do dado</div>
      </div>
    </section>

    <section class="sm-card">
      <h2 style="font-size:20px;color:var(--texto-primario);margin-bottom:4px">Tipografia</h2>
      <p style="margin:0 0 18px;font-size:14px;color:var(--texto-secundario)">Duas famílias, ambas do manual: <strong>Georgia</strong> nos títulos (a serifa institucional, presente em qualquer sistema — nada para baixar) e <strong>Montserrat</strong> em textos e interface (400/500/600/700). O manual também lista Times New Roman, restrita ao logotipo — não a usamos na aplicação.</p>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:baseline;border-bottom:1px solid #E4EBF4;padding-bottom:14px"><div style="flex:999 1 240px;font-size:32px;font-weight:700;letter-spacing:-.025em;line-height:1.2;color:var(--texto-primario);font-family:var(--fonte-titulo)">Título de tela</div><code style="flex:1 1 200px;font-size:12px;color:var(--texto-terciario)">display · 32/38 · 700</code></div>
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:baseline;border-bottom:1px solid #E4EBF4;padding-bottom:14px"><div style="flex:999 1 240px;font-size:26px;font-weight:700;letter-spacing:-.02em;line-height:1.25;color:var(--texto-primario);font-family:var(--fonte-titulo)">Título de vaga no detalhe</div><code style="flex:1 1 200px;font-size:12px;color:var(--texto-terciario)">titulo-lg · 26/33 · 700</code></div>
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:baseline;border-bottom:1px solid #E4EBF4;padding-bottom:14px"><div style="flex:999 1 240px;font-size:15px;line-height:1.65;color:#22364F">Corpo de texto longo — descrição de vaga, política de dados, ajuda contextual.</div><code style="flex:1 1 200px;font-size:12px;color:var(--texto-terciario)">corpo-lg · 15/25 · 400</code></div>
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:baseline"><div style="flex:999 1 240px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--texto-terciario)">Rótulo estrutural</div><code style="flex:1 1 200px;font-size:12px;color:var(--texto-terciario)">rotulo · 11/16 · 700 · 0.1em</code></div>
      </div>
    </section>

    <section class="sm-card">
      <h2 style="font-size:20px;color:var(--texto-primario);margin-bottom:16px">Componentes nomeados</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;font-size:14px">
        <div class="sm-componente-card"><code>CabecalhoApp</code><div style="color:var(--texto-secundario);margin-top:4px">Logotipo, busca global, avatar e menu.</div></div>
        <div class="sm-componente-card"><code>FaixaContexto</code><div style="color:var(--texto-secundario);margin-top:4px">Saudação + curso + semestre + origem do dado.</div></div>
        <div class="sm-componente-card"><code>FiltroLateral</code><div style="color:var(--texto-secundario);margin-top:4px">Todos os filtros da Prancha 5, com selos de pendência.</div></div>
        <div class="sm-componente-card"><code>CartaoVaga</code><div style="color:var(--texto-secundario);margin-top:4px">Monograma, título, empresa, selo, etiquetas, ações.</div></div>
        <div class="sm-componente-card"><code>SeloCompatibilidade</code><div style="color:var(--texto-secundario);margin-top:4px">Percentual + ícone + rótulo + razão em texto.</div></div>
        <div class="sm-componente-card"><code>SeloStatus</code><div style="color:var(--texto-secundario);margin-top:4px">Cinco status de candidatura, nunca só por cor.</div></div>
        <div class="sm-componente-card"><code>PainelDetalheVaga</code><div style="color:var(--texto-secundario);margin-top:4px">Cartão lateral fixo com as ações da Prancha 6.</div></div>
        <div class="sm-componente-card"><code>Paginacao</code><div style="color:var(--texto-secundario);margin-top:4px">Navegação por página, acessível por teclado.</div></div>
      </div>
    </section>

    <section class="sm-notas" style="border-radius:14px">
      <h2 style="font-size:20px;color:#fff;margin-bottom:4px">Tokens para o Tailwind</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#BDD4EA">Colar em <code>tailwind.config.js</code>. Nomes semânticos deixam o modo escuro possível depois sem tocar no markup.</p>
      <pre class="sm-sistema-pre">theme: { extend: {
  colors: {
    acao:   { 50:'#EAF1F9', 300:'#7FA8D4', 600:'#042D5C', 700:'#0A4A8F', 800:'#02203F' }, // #042D5C = manual
    agua:   { 50:'#E3F6F4', 200:'#A6E1DC', 500:'#00A99D', 700:'#067A73' },
    inst:   { 100:'#DCE7F3', 700:'#0A4A8F', 900:'#042D5C' },
    superficie: { DEFAULT:'#FFFFFF', alt:'#F6F9FC' },
    fundo:  '#F1F5FA',
    borda:  { DEFAULT:'#D5E0EE', forte:'#B4C5DA' },
    texto:  { primario:'#0E2138', secundario:'#465A73', terciario:'#64768F' },
    sucesso:{ texto:'#05603A', fundo:'#E7F6EE', borda:'#A9DDC1' },
    atencao:{ texto:'#93370D', fundo:'#FDF3E7', borda:'#F3D3A6' },
    erro:   { texto:'#B42318', fundo:'#FDECEA', borda:'#F5C4BF' },
    info:   { texto:'#0A4A8F', fundo:'#EAF2FE', borda:'#B6D0FA' },
  },
  fontFamily: {
    sans:  ['Montserrat', 'system-ui', 'sans-serif'],
    serif: ['Georgia', '"Times New Roman"', 'serif'],
  },
  borderRadius: { sm:'8px', md:'10px', lg:'14px' },
} }</pre>
    </section>

    <section class="sm-card">
      <h2 style="font-size:20px;color:var(--texto-primario);margin-bottom:4px">Contratos de API que este design exige</h2>
      <p style="margin:0 0 16px;font-size:14px;color:var(--texto-secundario)">Já existem: <code>GET /health</code>, <code>GET /api/vagas</code>, <code>POST /api/coleta</code> (coletor) e o CRUD REST padrão de <code>/alunos</code>, <code>/cursos</code>, <code>/empresas</code>, <code>/instituicoes</code>, <code>/vagas</code> (cadastro). O que falta para o Lote 1 rodar de ponta a ponta:</p>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="sm-contrato-card">
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span class="sm-metodo-badge sm-metodo-badge--get">GET</span><code style="font-size:14px;font-weight:700;color:var(--texto-primario)">/api/aluno/me</code></div>
          <div style="margin-top:8px;font-size:13.5px;line-height:1.6;color:var(--texto-secundario)"><strong style="color:var(--texto-primario)">Saída:</strong> <code>{ nome, curso, semestre, qtd_semestre_curso, vinculo_ativo, email_institucional }</code>. <strong style="color:var(--texto-primario)">Nunca</strong> CPF, RG, idade ou data de nascimento — o schema DB12 tem esses campos e a API precisa filtrá-los na borda. Nesta versão do frontend usamos <code>GET /alunos/${CONFIG.ID_ALUNO_DEMO}</code> diretamente como aproximação, já que o endpoint dedicado não existe.</div>
        </div>
        <div class="sm-contrato-card">
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span class="sm-metodo-badge sm-metodo-badge--get">GET</span><code style="font-size:14px;font-weight:700;color:var(--texto-primario)">/api/vagas?q&area&modalidade&coleta_desde&ordenar&pagina&por_pagina</code></div>
          <div style="margin-top:8px;font-size:13.5px;line-height:1.6;color:var(--texto-secundario)"><strong style="color:var(--texto-primario)">Saída:</strong> <code>{ total, pagina, por_pagina, itens: [{ id, titulo, empresa, link, data_coleta, descricao, salario, compatibilidade }] }</code>. <span style="color:var(--atencao-texto);font-weight:600">Extensão da rota atual</span>: hoje ela devolve a coleção inteira sem filtro nem paginação — o frontend faz filtro/ordenação/paginação no cliente enquanto isso não existe.</div>
        </div>
        <div class="sm-contrato-card">
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span class="sm-metodo-badge sm-metodo-badge--post">POST</span><code style="font-size:14px;font-weight:700;color:var(--texto-primario)">/api/candidaturas</code></div>
          <div style="margin-top:8px;font-size:13.5px;line-height:1.6;color:var(--texto-secundario)"><strong style="color:var(--texto-primario)">Entrada:</strong> <code>{ id_vaga, status_autodeclarado }</code> · <strong style="color:var(--texto-primario)">Saída:</strong> <code>{ id, status, atualizado_em }</code>. Não existe ainda — este frontend simula com localStorage (chave <code>startme:candidaturas</code>).</div>
        </div>
        <div class="sm-contrato-card">
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span class="sm-metodo-badge sm-metodo-badge--lote">Lote 2</span><code style="font-size:14px;color:var(--texto-secundario)">GET /api/candidaturas · PATCH /api/aluno/me · POST /api/aluno/curriculo · POST /api/consentimento · DELETE /api/consentimento</code></div>
          <div style="margin-top:8px;font-size:13.5px;line-height:1.6;color:var(--texto-secundario)">Exigidos pelas Pranchas 3, 8 e 9. Os dois últimos materializam revogação e portabilidade — o capítulo de LGPD depende deles.</div>
        </div>
      </div>
    </section>

    <section class="sm-card">
      <h2 style="font-size:20px;color:var(--texto-primario);margin-bottom:14px">Cobertura da entrega</h2>
      <p style="margin:0 0 14px;max-width:70ch;font-size:14px;line-height:1.6;color:var(--texto-secundario)">As 13 pranchas do design original estão implementadas em HTML/CSS/JS vanilla, navegáveis pela barra lateral — identidade visual do Manual da Marca da FSA aplicada em toda a aplicação (Azul Institucional #042D5C, Verde-água, Georgia + Montserrat).</p>
      <div class="sm-cobertura-grid">
        <div class="sm-cobertura-card"><strong style="color:var(--texto-primario)">Entrada · 1, 2, 3</strong><div style="margin-top:4px">Portal, login simulado e consentimento LGPD.</div></div>
        <div class="sm-cobertura-card"><strong style="color:var(--texto-primario)">Aplicação · 4, 5, 6, 7, 8, 9</strong><div style="margin-top:4px">Painel, listagem, detalhe, candidatura, minhas candidaturas e perfil.</div></div>
        <div class="sm-cobertura-card"><strong style="color:var(--texto-primario)">Currículo · 12, 13</strong><div style="margin-top:4px">Currículo e certificados, com toggles persistidos.</div></div>
        <div class="sm-cobertura-card"><strong style="color:var(--texto-primario)">Referência · 10, 11</strong><div style="margin-top:4px">Estados de exceção e este sistema de design.</div></div>
      </div>
    </section>
  </main>`;
}
