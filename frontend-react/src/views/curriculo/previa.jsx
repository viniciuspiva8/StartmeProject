import { useApp } from '../../state/AppContext.jsx';
import { normalizar } from '../../lib/match.js';

// ---------------------------------------------------------------------------
// Prévia: o que a empresa vê e o que sai no PDF. É o único bloco impresso.
// ---------------------------------------------------------------------------
export function Previa() {
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

export function BlocoPrevia({ titulo, children }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h3 className="mb-1.5 font-serif text-[15px] font-bold text-azul">{titulo}</h3>
      {children}
    </section>
  );
}
