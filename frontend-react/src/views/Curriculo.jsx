// Meu currículo: o ativo central do aluno no StartMe.
// Tudo o que entra aqui (certificações, atividades, voluntariado, habilidades)
// alimenta o match com as vagas na hora, e o mesmo conteúdo vira o currículo
// padrão que o aluno exporta em PDF para os sites das empresas.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { GRADE } from '../data/grade.js';
import { NIVEIS_HABILIDADE, NIVEIS_IDIOMA, TIPOS_ATIVIDADE } from '../data/curriculo-seed.js';
import { normalizar } from '../lib/match.js';
import Icone from '../components/Icone.jsx';

/** O que falta para o currículo ficar completo (usado aqui e no início). */
export function pendenciasDoCurriculo(cv) {
  const p = [];
  if (!cv.contato?.email || !cv.contato?.telefone) p.push('Preencher e-mail e telefone');
  if (!cv.resumo?.trim()) p.push('Escrever um resumo de duas ou três frases');
  if (!cv.certificacoes?.length) p.push('Adicionar uma certificação');
  if (!cv.atividades?.length) p.push('Adicionar uma atividade acadêmica ou voluntariado');
  if (!cv.idiomas?.length) p.push('Adicionar um idioma');
  return p;
}

const separarHabilidades = (texto) => texto.split(/[,;]/).map((x) => x.trim()).filter(Boolean);

export default function Curriculo() {
  const { s } = useApp();
  const [aba, setAba] = useState('editar');
  const pendencias = pendenciasDoCurriculo(s.curriculo);

  return (
    <main className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:p-0">
      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-serif text-[32px] leading-tight font-bold text-tinta">Meu currículo</h1>
          <p className="mt-2 max-w-[64ch] text-[15px] leading-relaxed text-tinta-3">
            Tudo o que você adiciona aqui entra na comparação com as vagas na hora. É também o currículo que você exporta
            para os sites das empresas.
          </p>
        </div>
        <button type="button" onClick={() => window.print()} className="btn-primario">
          <Icone nome="baixar" size={17} /> Exportar PDF
        </button>
      </header>

      <div role="tablist" aria-label="Modo" className="mt-6 grid grid-cols-2 rounded-xl bg-papel-2 p-1 lg:hidden print:hidden">
        {[['editar', 'Editar'], ['previa', 'Ver como a empresa vê']].map(([id, rot]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
            className={`min-h-10 cursor-pointer rounded-lg text-sm font-semibold ${aba === id ? 'bg-white text-azul shadow-painel' : 'text-tinta-3'}`}>
            {rot}
          </button>
        ))}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(400px,540px)] print:mt-0 print:block">
        <div className={`flex-col gap-5 print:hidden ${aba === 'editar' ? 'flex' : 'hidden'} lg:flex`}>
          {pendencias.length > 0 && (
            <div className="rounded-2xl border border-ressalva-barra/50 bg-ressalva-fundo px-5 py-4">
              <p className="text-sm font-bold text-ressalva">Para deixar o currículo completo</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-tinta-2">
                {pendencias.map((p) => <li key={p} className="flex items-center gap-2"><Icone nome="alerta" size={14} className="text-ressalva-barra" />{p}</li>)}
              </ul>
            </div>
          )}
          <SecaoPortal />
          <SecaoContato />
          <SecaoResumo />
          <SecaoHabilidades />
          <SecaoCertificacoes />
          <SecaoAtividades />
          <SecaoIdiomas />
          <RestaurarDemo />
        </div>

        {/* No desktop, a prévia fica presa ao lado do editor e rola sozinha: o aluno
            percorre o currículo inteiro sem perder de vista o que está editando.
            É uma região focável, para dar para rolar também pelo teclado. */}
        <div className={`${aba === 'previa' ? 'block' : 'hidden'} lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100dvh-7.5rem)] lg:flex-col print:static print:block print:max-h-none`}>
          <div className="mb-3 flex items-baseline justify-between gap-3 print:hidden">
            <p className="text-[13px] font-semibold text-tinta-3">Como a empresa vê</p>
            <p className="hidden text-xs text-tinta-4 lg:block">Role aqui para ver o currículo inteiro</p>
          </div>
          <div
            role="region"
            aria-label="Prévia do currículo"
            tabIndex={0}
            className="rounded-2xl lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-gutter:stable] print:overflow-visible"
          >
            <Previa />
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Blocos do editor
// ---------------------------------------------------------------------------
function Secao({ titulo, descricao, children, id }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-linha bg-white p-5 sm:p-6">
      <h2 id={id} className="text-[17px] font-bold text-tinta">{titulo}</h2>
      {descricao && <p className="mt-1 text-[13px] leading-relaxed text-tinta-3">{descricao}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Campo({ rotulo, children, largo = false }) {
  return (
    <label className={`flex flex-col gap-1.5 ${largo ? 'sm:col-span-2' : ''}`}>
      <span className="text-[13px] font-semibold text-tinta-2">{rotulo}</span>
      {children}
    </label>
  );
}
const ENTRADA_BASE = 'min-h-11 rounded-xl border border-linha-forte bg-white px-3 text-sm text-tinta outline-none placeholder:text-tinta-4 focus:border-azul-500 focus:ring-3 focus:ring-azul-300/40';
const ENTRADA = `${ENTRADA_BASE} w-full`;

function SecaoPortal() {
  const { s } = useApp();
  return (
    <Secao id="sec-portal" titulo="Do Portal Acadêmico" descricao="Vem do portal da faculdade e não pode ser editado aqui. É o que garante que a formação no seu currículo é verdadeira.">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {s.campos.map((c) => (
          <div key={c.rotulo}>
            <dt className="flex items-center gap-1.5 text-[13px] text-tinta-3"><Icone nome="cadeado" size={14} /> {c.rotulo}</dt>
            <dd className="mt-0.5 text-[15px] font-semibold text-tinta">{c.valor}</dd>
          </div>
        ))}
      </dl>
    </Secao>
  );
}

function SecaoContato() {
  const { s, a } = useApp();
  const c = s.curriculo.contato;
  const campos = [['email', 'E-mail', 'email'], ['telefone', 'Telefone', 'tel'], ['cidade', 'Cidade', 'text'], ['linkedin', 'LinkedIn', 'text'], ['github', 'GitHub ou portfólio', 'text']];
  return (
    <Secao id="sec-contato" titulo="Contato" descricao="Aparece no topo do currículo exportado. O StartMe não envia seus dados a nenhuma empresa.">
      <div className="grid gap-3 sm:grid-cols-2">
        {campos.map(([k, rot, tipo]) => (
          <Campo key={k} rotulo={rot}>
            <input type={tipo} value={c[k] || ''} onChange={(e) => a.setContato(k, e.target.value)} className={ENTRADA} />
          </Campo>
        ))}
      </div>
    </Secao>
  );
}

function SecaoResumo() {
  const { s, a } = useApp();
  const r = s.curriculo.resumo || '';
  return (
    <Secao id="sec-resumo" titulo="Resumo" descricao="Duas ou três frases: o que você estuda, o que já fez e que tipo de estágio procura.">
      <textarea
        value={r}
        onChange={(e) => a.setResumo(e.target.value)}
        rows={4}
        aria-describedby="resumo-contagem"
        placeholder="Ex.: Estudante de Engenharia de Computação no 7º semestre, com projetos em Python e bancos de dados. Procuro estágio em desenvolvimento back-end ou dados, no período diurno."
        className={`${ENTRADA} min-h-28 resize-y py-2.5 leading-relaxed`}
      />
      <p id="resumo-contagem" className="mt-1.5 text-right text-xs text-tinta-3 tabular-nums">{r.length} de 480 caracteres</p>
    </Secao>
  );
}

function Chip({ children, onRemover, tom = 'neutro' }) {
  const estilos = {
    neutro: 'bg-papel-2 text-tinta-2',
    comprovada: 'bg-agua-fundo text-agua-texto',
    declarada: 'bg-nevoa text-azul',
  };
  return (
    <li className={`inline-flex min-h-8 items-center gap-1 rounded-pill pr-1 pl-3 text-[13px] font-semibold ${estilos[tom]} ${onRemover ? '' : 'pr-3'}`}>
      {children}
      {onRemover && (
        <button type="button" onClick={onRemover} aria-label={`Remover ${children}`} className="grid size-7 cursor-pointer place-items-center rounded-full hover:bg-white/70">
          <Icone nome="fechar" size={14} />
        </button>
      )}
    </li>
  );
}

function SecaoHabilidades() {
  const { s, a, perfil } = useApp();
  const daGrade = useMemo(
    () => [...new Set(GRADE.filter((d) => d.semestre <= s.semestreAluno).flatMap((d) => d.habilidades))],
    [s.semestreAluno],
  );
  const comprovadas = [...perfil.habilidades.values()]
    .filter((h) => h.fontes.some((f) => f.tipo === 'certificado' || f.tipo === 'atividade'))
    .map((h) => h.termo);
  const declaradas = s.curriculo.habilidadesDeclaradas;
  const editando = s.habilidadeEmEdicao;

  return (
    <Secao id="sec-hab" titulo="Habilidades" descricao="As da grade e as comprovadas por certificação ou atividade entram sozinhas. As outras, você adiciona com o nível e onde aprendeu.">
      <h3 className="text-[13px] font-semibold text-tinta-2">Da sua grade, até o {s.semestreAluno}º semestre</h3>
      <ul className="mt-2 flex flex-wrap gap-1.5">{daGrade.map((h) => <Chip key={h}>{h}</Chip>)}</ul>

      <h3 className="mt-5 text-[13px] font-semibold text-tinta-2">Comprovadas por certificação ou atividade</h3>
      {comprovadas.length
        ? <ul className="mt-2 flex flex-wrap gap-1.5">{comprovadas.map((h) => <Chip key={h} tom="comprovada">{h}</Chip>)}</ul>
        : <p className="mt-2 text-sm text-tinta-3">Adicione uma certificação para comprovar habilidades.</p>}

      <h3 className="mt-5 text-[13px] font-semibold text-tinta-2">Adicionadas por você</h3>
      {declaradas.length > 0 ? (
        <ul className="mt-2 flex flex-col divide-y divide-linha rounded-xl border border-linha">
          {declaradas.map((h) => (
            <li key={h.id} className={`flex items-center gap-3 py-2.5 pr-2 pl-4 ${editando?.id === h.id ? 'bg-nevoa' : ''}`}>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold text-tinta">{h.nome}</span>
                  {h.nivel && <span className="rounded-pill bg-nevoa px-2.5 py-0.5 text-xs font-semibold text-azul">{h.nivel}</span>}
                  {h.arquivo && <span className="inline-flex items-center gap-1 text-xs font-semibold text-agua-texto"><Icone nome="certificado" size={14} /> Certificado</span>}
                </span>
                <span className="block text-[13px] text-tinta-3">
                  {h.onde ? `${h.onde}${h.ano ? `, ${h.ano}` : ''}` : h.nivel ? 'Onde aprendeu não informado' : 'Falta informar o nível'}
                </span>
              </span>
              <button type="button" onClick={() => a.abrirHabilidade(h)} className="btn-fantasma min-h-10 px-3 text-[13px]">
                Editar<span className="sr-only"> {h.nome}</span>
              </button>
              <Remover rotulo={`Remover ${h.nome}`} onClick={() => a.removerHabilidade(h.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-tinta-3">Nenhuma ainda.</p>
      )}

      {editando ? (
        <FormHabilidade key={editando.abertoEm} inicial={editando} />
      ) : (
        <button type="button" onClick={() => a.abrirHabilidade()} className="btn-claro mt-3">+ Adicionar habilidade</button>
      )}
    </Secao>
  );
}

/** Formulário de habilidade. Aberto pelo "Eu sei X" (nome já preenchido) ou pelo botão da seção. */
function FormHabilidade({ inicial }) {
  const { s, a } = useApp();
  const [f, setF] = useState(inicial);
  const formRef = useRef(null);
  const nomeRef = useRef(null);
  const nivelRef = useRef(null);

  // Ao abrir, traz o formulário para o centro da tela e põe o foco no próximo campo a preencher.
  useEffect(() => {
    const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    formRef.current?.scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'center' });
    (inicial.nome ? nivelRef : nomeRef).current?.focus({ preventScroll: true });
  }, [inicial]);

  const duplicada = !inicial.id && f.nome.trim()
    && s.curriculo.habilidadesDeclaradas.some((h) => normalizar(h.nome) === normalizar(f.nome));
  const podeSalvar = f.nome.trim() && f.nivel;
  const enviar = (e) => {
    e.preventDefault();
    if (podeSalvar) a.salvarHabilidade(f);
  };

  return (
    <form
      ref={formRef}
      onSubmit={enviar}
      aria-labelledby="form-hab-titulo"
      className="mt-4 grid animate-entra scroll-mt-24 gap-4 rounded-xl border border-azul-300/60 bg-nevoa p-4 sm:grid-cols-[1fr_8rem] sm:p-5"
    >
      <div className="sm:col-span-2">
        <p id="form-hab-titulo" className="text-[15px] font-bold text-tinta">{inicial.id ? `Editar ${inicial.nome}` : 'Nova habilidade'}</p>
        {inicial.origemVaga && (
          <p className="mt-0.5 text-[13px] text-tinta-3">A vaga que você estava vendo pede esta habilidade. Ao salvar, a avaliação dela é refeita.</p>
        )}
      </div>

      <Campo rotulo="Habilidade" largo>
        <input ref={nomeRef} required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Power BI" className={ENTRADA} />
        {duplicada && <span className="text-xs text-tinta-3">Você já adicionou esta habilidade; salvar substitui os dados anteriores.</span>}
      </Campo>

      <fieldset className="sm:col-span-2">
        <legend className="text-[13px] font-semibold text-tinta-2">Nível de conhecimento</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
          {NIVEIS_HABILIDADE.map((n, i) => (
            <label
              key={n.v}
              className="flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border border-linha-forte bg-white px-3 py-2 transition-colors hover:border-azul-500 has-[:checked]:border-azul has-[:checked]:ring-1 has-[:checked]:ring-azul has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-azul-300"
            >
              <input
                ref={i === 0 ? nivelRef : undefined}
                type="radio"
                name="nivel-habilidade"
                value={n.v}
                checked={f.nivel === n.v}
                onChange={() => setF({ ...f, nivel: n.v })}
                className="sr-only"
              />
              <span className="text-sm font-bold text-tinta">{n.v}</span>
              <span className="text-xs leading-snug text-tinta-3">{n.desc}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Campo rotulo="Onde aprendeu">
        <input value={f.onde} onChange={(e) => setF({ ...f, onde: e.target.value })} placeholder="Ex.: Hashtag Treinamentos, estágio, sozinho" className={ENTRADA} />
      </Campo>
      <Campo rotulo="Ano">
        <input inputMode="numeric" maxLength={4} value={f.ano} onChange={(e) => setF({ ...f, ano: e.target.value.replace(/\D/g, '') })} placeholder="2025" className={ENTRADA} />
      </Campo>

      <Campo rotulo="Certificado (opcional)" largo>
        <input type="file" accept=".pdf,image/*" onChange={(e) => setF({ ...f, arquivo: e.target.files?.[0]?.name || '' })}
          className="text-sm text-tinta-2 file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white file:px-3 file:font-semibold file:text-azul" />
        <span className="text-xs text-tinta-3">
          {f.arquivo ? `Anexado: ${f.arquivo}. ` : ''}Com certificado, a habilidade conta como comprovada. Nesta versão só o nome do arquivo é guardado.
        </span>
      </Campo>

      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <button type="submit" className="btn-primario" disabled={!podeSalvar}>{inicial.id ? 'Salvar alterações' : 'Adicionar ao currículo'}</button>
        <button type="button" onClick={a.fecharHabilidade} className="btn-fantasma">Cancelar</button>
        {!f.nivel && <span className="text-[13px] text-tinta-3">Escolha o nível para salvar.</span>}
      </div>
    </form>
  );
}

function Lista({ itens, render, vazio }) {
  if (!itens.length) return <p className="text-sm text-tinta-3">{vazio}</p>;
  return <ul className="flex flex-col divide-y divide-linha rounded-xl border border-linha">{itens.map(render)}</ul>;
}

function Remover({ rotulo, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={rotulo} className="grid size-10 flex-none cursor-pointer place-items-center rounded-xl text-tinta-4 hover:bg-erro-fundo hover:text-erro">
      <Icone nome="fechar" size={18} />
    </button>
  );
}

function SecaoCertificacoes() {
  const { s, a } = useApp();
  const vazio = { nome: '', instituicao: '', ano: '', habilidades: '', arquivo: '' };
  const [form, setForm] = useState(null);
  const enviar = (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    a.addCertificacao({ ...form, nome: form.nome.trim(), habilidades: separarHabilidades(form.habilidades) });
    setForm(null);
  };
  return (
    <Secao id="sec-cert" titulo="Certificações" descricao="Cada certificação preenche o currículo e comprova as habilidades que você indicar.">
      <Lista
        itens={s.curriculo.certificacoes}
        vazio="Nenhuma certificação ainda."
        render={(c) => (
          <li key={c.id} className="flex items-start gap-3 p-4">
            <span className="grid size-10 flex-none place-items-center rounded-xl bg-agua-fundo text-agua-texto"><Icone nome="certificado" size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-tinta">{c.nome}</span>
              <span className="block text-[13px] text-tinta-3">{[c.instituicao, c.ano].filter(Boolean).join(', ')}{c.arquivo ? ` — ${c.arquivo}` : ''}</span>
              {c.habilidades?.length > 0 && <span className="mt-2 flex flex-wrap gap-1.5">{c.habilidades.map((h) => <span key={h} className="rounded-pill bg-agua-fundo px-2.5 py-0.5 text-xs font-semibold text-agua-texto">{h}</span>)}</span>}
            </span>
            <Remover rotulo={`Remover ${c.nome}`} onClick={() => a.removerCertificacao(c.id)} />
          </li>
        )}
      />
      {form ? (
        <form onSubmit={enviar} className="mt-4 grid gap-3 rounded-xl bg-papel p-4 sm:grid-cols-2">
          <Campo rotulo="Nome da certificação" largo><input required autoFocus value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={ENTRADA} /></Campo>
          <Campo rotulo="Instituição"><input value={form.instituicao} onChange={(e) => setForm({ ...form, instituicao: e.target.value })} placeholder="Ex.: Alura, AWS, Cisco" className={ENTRADA} /></Campo>
          <Campo rotulo="Ano"><input inputMode="numeric" maxLength={4} value={form.ano} onChange={(e) => setForm({ ...form, ano: e.target.value.replace(/\D/g, '') })} className={ENTRADA} /></Campo>
          <Campo rotulo="Habilidades que ela comprova (separe por vírgula)" largo>
            <input value={form.habilidades} onChange={(e) => setForm({ ...form, habilidades: e.target.value })} placeholder="Ex.: Docker, Linux" className={ENTRADA} />
          </Campo>
          <Campo rotulo="Arquivo do certificado (opcional)" largo>
            <input type="file" accept=".pdf,image/*" onChange={(e) => setForm({ ...form, arquivo: e.target.files?.[0]?.name || '' })}
              className="text-sm text-tinta-2 file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-nevoa file:px-3 file:font-semibold file:text-azul" />
            <span className="text-xs text-tinta-3">Nesta versão só o nome do arquivo é guardado; o envio depende do backend.</span>
          </Campo>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-primario">Adicionar certificação</button>
            <button type="button" onClick={() => setForm(null)} className="btn-fantasma">Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setForm(vazio)} className="btn-claro mt-4">+ Adicionar certificação</button>
      )}
    </Secao>
  );
}

function SecaoAtividades() {
  const { s, a } = useApp();
  const vazio = { tipo: TIPOS_ATIVIDADE[0], titulo: '', organizacao: '', periodo: '', descricao: '', habilidades: '' };
  const [form, setForm] = useState(null);
  const enviar = (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    a.addAtividade({ ...form, titulo: form.titulo.trim(), habilidades: separarHabilidades(form.habilidades) });
    setForm(null);
  };
  return (
    <Secao id="sec-ativ" titulo="Atividades acadêmicas e voluntariado" descricao="Projetos, iniciação científica, monitoria, empresa júnior, hackathons e trabalho voluntário contam como experiência.">
      <Lista
        itens={s.curriculo.atividades}
        vazio="Nenhuma atividade ainda."
        render={(at) => (
          <li key={at.id} className="flex items-start gap-3 p-4">
            <span className="grid size-10 flex-none place-items-center rounded-xl bg-nevoa text-azul"><Icone nome={at.tipo === 'Voluntariado' ? 'pessoa' : 'capelo'} size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-tinta-3">{at.tipo}</span>
              <span className="block text-[15px] font-semibold text-tinta">{at.titulo}</span>
              <span className="block text-[13px] text-tinta-3">{[at.organizacao, at.periodo].filter(Boolean).join(', ')}</span>
              {at.descricao && <span className="mt-1 block text-sm leading-relaxed text-tinta-2">{at.descricao}</span>}
              {at.habilidades?.length > 0 && <span className="mt-2 flex flex-wrap gap-1.5">{at.habilidades.map((h) => <span key={h} className="rounded-pill bg-agua-fundo px-2.5 py-0.5 text-xs font-semibold text-agua-texto">{h}</span>)}</span>}
            </span>
            <Remover rotulo={`Remover ${at.titulo}`} onClick={() => a.removerAtividade(at.id)} />
          </li>
        )}
      />
      {form ? (
        <form onSubmit={enviar} className="mt-4 grid gap-3 rounded-xl bg-papel p-4 sm:grid-cols-2">
          <Campo rotulo="Tipo">
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={ENTRADA}>
              {TIPOS_ATIVIDADE.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Período"><input value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} placeholder="Ex.: 2025 a 2026" className={ENTRADA} /></Campo>
          <Campo rotulo="Título" largo><input required autoFocus value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={ENTRADA} /></Campo>
          <Campo rotulo="Organização" largo><input value={form.organizacao} onChange={(e) => setForm({ ...form, organizacao: e.target.value })} className={ENTRADA} /></Campo>
          <Campo rotulo="O que você fez" largo>
            <textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={`${ENTRADA} py-2.5`} />
          </Campo>
          <Campo rotulo="Habilidades usadas (separe por vírgula)" largo>
            <input value={form.habilidades} onChange={(e) => setForm({ ...form, habilidades: e.target.value })} placeholder="Ex.: Python, Trabalho em equipe" className={ENTRADA} />
          </Campo>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-primario">Adicionar atividade</button>
            <button type="button" onClick={() => setForm(null)} className="btn-fantasma">Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setForm(vazio)} className="btn-claro mt-4">+ Adicionar atividade</button>
      )}
    </Secao>
  );
}

function SecaoIdiomas() {
  const { s, a } = useApp();
  const [idioma, setIdioma] = useState('');
  const [nivel, setNivel] = useState(NIVEIS_IDIOMA[1]);
  const enviar = (e) => {
    e.preventDefault();
    if (!idioma.trim()) return;
    a.addIdioma({ idioma: idioma.trim(), nivel });
    setIdioma('');
  };
  return (
    <Secao id="sec-idiomas" titulo="Idiomas">
      {s.curriculo.idiomas.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {s.curriculo.idiomas.map((i) => (
            <Chip key={i.id} tom="declarada" onRemover={() => a.removerIdioma(i.id)}>{`${i.idioma}, ${i.nivel.toLowerCase()}`}</Chip>
          ))}
        </ul>
      )}
      <form onSubmit={enviar} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="idioma">Idioma</label>
        <input id="idioma" value={idioma} onChange={(e) => setIdioma(e.target.value)} placeholder="Idioma" className={`${ENTRADA_BASE} min-w-0 flex-[1_1_10rem]`} />
        <label className="sr-only" htmlFor="nivel">Nível</label>
        <select id="nivel" value={nivel} onChange={(e) => setNivel(e.target.value)} className={`${ENTRADA_BASE} flex-none`}>
          {NIVEIS_IDIOMA.map((n) => <option key={n}>{n}</option>)}
        </select>
        <button type="submit" className="btn-claro flex-none" disabled={!idioma.trim()}>Adicionar</button>
      </form>
    </Secao>
  );
}

function RestaurarDemo() {
  const { a } = useApp();
  return (
    <p className="text-center text-[13px] text-tinta-3">
      Testando a demonstração?{' '}
      <button type="button" onClick={a.restaurarCurriculo} className="cursor-pointer font-semibold text-azul-700 underline-offset-2 hover:underline">
        Restaurar o currículo de exemplo
      </button>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Prévia: o que a empresa vê e o que sai no PDF. É o único bloco impresso.
// ---------------------------------------------------------------------------
function Previa() {
  const { s, perfil } = useApp();
  const cv = s.curriculo;
  const campo = (rot) => s.campos.find((c) => c.rotulo === rot)?.valor;
  const nome = campo('Nome completo') || 'Aluno';
  const curso = campo('Curso') || 'Curso';
  const contato = [cv.contato.email, cv.contato.telefone, cv.contato.cidade, cv.contato.linkedin, cv.contato.github].filter(Boolean);
  // Habilidades comprovadas primeiro, depois as da grade, por fim as declaradas.
  const peso = (h) => Math.min(...h.fontes.map((f) => (f.tipo === 'declarada' && f.comprovante ? 0 : { certificado: 0, atividade: 0, disciplina: 1, declarada: 2 }[f.tipo])));
  const nivelDe = new Map(cv.habilidadesDeclaradas.filter((h) => h.nivel).map((h) => [normalizar(h.nome), h.nivel.toLowerCase()]));
  const habilidades = [...perfil.habilidades.values()]
    .sort((a, b) => peso(a) - peso(b))
    .map((h) => (nivelDe.has(normalizar(h.termo)) ? `${h.termo} (${nivelDe.get(normalizar(h.termo))})` : h.termo));

  return (
    <article className="rounded-2xl border border-linha bg-white p-8 text-[13px] leading-relaxed text-tinta shadow-painel sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="border-b-2 border-azul pb-4">
        <h2 className="font-serif text-[26px] leading-tight font-bold text-azul">{nome}</h2>
        <p className="mt-1 text-[13px] font-semibold text-tinta-2">{curso}, {s.semestreAluno}º semestre</p>
        {contato.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-tinta-3">{contato.map((c) => <li key={c}>{c}</li>)}</ul>
        )}
      </header>

      {cv.resumo?.trim() && <BlocoPrevia titulo="Resumo"><p className="text-tinta-2">{cv.resumo}</p></BlocoPrevia>}

      <BlocoPrevia titulo="Formação">
        <p className="font-semibold">{curso}</p>
        <p className="text-tinta-3">Centro Universitário Fundação Santo André, cursando o {s.semestreAluno}º semestre</p>
      </BlocoPrevia>

      {cv.atividades.length > 0 && (
        <BlocoPrevia titulo="Atividades acadêmicas e voluntariado">
          <ul className="flex flex-col gap-2.5">
            {cv.atividades.map((at) => (
              <li key={at.id}>
                <p className="font-semibold">{at.titulo}</p>
                <p className="text-tinta-3">{[at.tipo, at.organizacao, at.periodo].filter(Boolean).join(', ')}</p>
                {at.descricao && <p className="text-tinta-2">{at.descricao}</p>}
              </li>
            ))}
          </ul>
        </BlocoPrevia>
      )}

      {cv.certificacoes.length > 0 && (
        <BlocoPrevia titulo="Certificações">
          <ul className="flex flex-col gap-1">
            {cv.certificacoes.map((c) => (
              <li key={c.id}><span className="font-semibold">{c.nome}</span>{[c.instituicao, c.ano].filter(Boolean).length ? <span className="text-tinta-3">, {[c.instituicao, c.ano].filter(Boolean).join(', ')}</span> : null}</li>
            ))}
          </ul>
        </BlocoPrevia>
      )}

      {habilidades.length > 0 && <BlocoPrevia titulo="Habilidades"><p className="text-tinta-2">{habilidades.join(', ')}</p></BlocoPrevia>}

      {cv.idiomas.length > 0 && (
        <BlocoPrevia titulo="Idiomas"><p className="text-tinta-2">{cv.idiomas.map((i) => `${i.idioma} (${i.nivel.toLowerCase()})`).join(', ')}</p></BlocoPrevia>
      )}
    </article>
  );
}

function BlocoPrevia({ titulo, children }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h3 className="mb-1.5 font-serif text-[15px] font-bold text-azul">{titulo}</h3>
      {children}
    </section>
  );
}
