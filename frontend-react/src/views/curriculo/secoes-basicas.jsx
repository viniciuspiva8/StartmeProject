import { useApp } from '../../state/AppContext.jsx';
import Icone from '../../components/Icone.jsx';
import { Secao, Campo, ENTRADA } from './ui';

export function SecaoPortal() {
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

export function SecaoContato() {
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

export function SecaoResumo() {
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
