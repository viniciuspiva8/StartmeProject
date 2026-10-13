import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext.jsx';
import { GRADE } from '../../data/grade.js';
import { NIVEIS_HABILIDADE } from '../../data/curriculo-seed.js';
import { normalizar } from '../../lib/match.js';
import Icone from '../../components/Icone.jsx';
import { Secao, Campo, ENTRADA, Chip, Remover } from './ui';

export function SecaoHabilidades() {
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
              <button type="button" onClick={() => a.abrirHabilidade(h)} className="btn-fantasma px-3 text-[13px]">
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
export function FormHabilidade({ inicial }) {
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
          className="text-sm text-tinta-2 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white file:px-3 file:font-semibold file:text-azul" />
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
