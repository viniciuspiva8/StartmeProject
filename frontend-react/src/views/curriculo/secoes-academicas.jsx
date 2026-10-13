import { useState } from 'react';
import { useApp } from '../../state/AppContext.jsx';
import { NIVEIS_IDIOMA, TIPOS_ATIVIDADE } from '../../data/curriculo-seed.js';
import Icone from '../../components/Icone.jsx';
import { separarHabilidades } from './utilidades';
import { Secao, Campo, ENTRADA_BASE, ENTRADA, Chip, Lista, Remover } from './ui';

export function SecaoCertificacoes() {
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
              className="text-sm text-tinta-2 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-nevoa file:px-3 file:font-semibold file:text-azul" />
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

export function SecaoAtividades() {
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

export function SecaoIdiomas() {
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
