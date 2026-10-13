// Prancha 9 — Perfil do aluno. Dados acadêmicos só leitura (vêm da faculdade); o resto é do aluno.
// Revogar a autorização e apagar a conta são ações reais: no servidor quando há sessão, local caso contrário.
import { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { AREAS, INTERESSES_PADRAO, PERFIL_PADRAO } from '../data/mock.js';
import { gravarLocal, lerLocal } from '../lib/api.js';
import { apiAluno } from '../lib/apiAluno.js';
import { academicoDemo } from '../state/utilitarios.js';
import Icone from '../components/Icone.jsx';

const CHAVE_PERFIL = 'startme:perfil';

const CAMPOS = [
  { campo: 'email', rotulo: 'E-mail de contato', dica: 'seu.nome@aluno.fsa.br', tipo: 'email' },
  { campo: 'telefone', rotulo: 'Telefone', dica: '(11) 90000-0000', tipo: 'tel' },
  { campo: 'disponibilidade', rotulo: 'Disponibilidade de horário', dica: 'Manhã · 6h/dia', tipo: 'text' },
  { campo: 'github', rotulo: 'GitHub', dica: 'github.com/usuario', tipo: 'text' },
  { campo: 'linkedin', rotulo: 'LinkedIn', dica: 'linkedin.com/in/usuario', tipo: 'text' },
];

export default function Perfil() {
  const { s, a } = useApp();
  const [dados, setDados] = useState(() => ({ ...PERFIL_PADRAO, ...lerLocal(CHAVE_PERFIL, {}) }));
  const [interesses, setInteresses] = useState(() => lerLocal('startme:interesses', INTERESSES_PADRAO));
  const [salvo, setSalvo] = useState(true);

  const alterar = (campo, valor) => { setDados((d) => ({ ...d, [campo]: valor })); setSalvo(false); };
  const alternarInteresse = (area) => {
    setInteresses((lista) => (lista.includes(area) ? lista.filter((x) => x !== area) : [...lista, area]));
    setSalvo(false);
  };

  const salvar = () => {
    gravarLocal(CHAVE_PERFIL, dados);
    gravarLocal('startme:interesses', interesses);
    setSalvo(true);
    a.mostrarToast('Perfil salvo neste navegador.');
  };

  const descartar = () => {
    setDados({ ...PERFIL_PADRAO, ...lerLocal(CHAVE_PERFIL, {}) });
    setInteresses(lerLocal('startme:interesses', INTERESSES_PADRAO));
    setSalvo(true);
  };

  const revogar = async () => {
    try {
      if (s.sessao) {
        await apiAluno.revogarConsentimento();
        a.set((p) => ({ sessao: { ...p.sessao, consentimento: { ...p.sessao.consentimento, aceito: false } } }));
      }
      a.set({ view: 'excecao', sel: 'consentimento_recusado' });
      a.mostrarToast('Autorização revogada. Seu currículo e marcações foram apagados.');
    } catch {
      a.mostrarToast('Não conseguimos revogar agora. Tente de novo em instantes.');
    }
  };

  const apagarConta = async () => {
    if (!window.confirm('Apagar sua conta e todos os seus dados no StartMe? Isso não pode ser desfeito.')) return;
    try {
      if (s.sessao) await apiAluno.apagarConta();
      gravarLocal(CHAVE_PERFIL, null);
      a.set({ view: 'portal', sessao: null, cpf: '', senha: '', ...academicoDemo() });
      a.mostrarToast('Sua conta foi apagada.');
    } catch {
      a.mostrarToast('Não conseguimos apagar sua conta agora. Tente de novo em instantes.');
    }
  };

  const fonteAcademica = s.academicoFonte === 'mock'
    ? 'Dados de demonstração'
    : 'Dados da faculdade';

  return (
    <main className="mx-auto flex max-w-[860px] flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-serif text-[26px] font-bold text-tinta">Meu perfil</h1>

      <section className="rounded-2xl border border-linha bg-white p-5 sm:p-6" aria-labelledby="perfil-academico">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="perfil-academico" className="font-serif text-xl font-bold text-tinta">Dados acadêmicos</h2>
          <span className="rounded-pill bg-papel-2 px-2.5 py-0.5 text-xs font-semibold text-tinta-2">Somente leitura</span>
          <span className="text-xs text-tinta-3">{fonteAcademica}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-tinta-2">
          Estes campos vêm da faculdade e não podem ser alterados aqui. Para corrigi-los, procure a secretaria acadêmica.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {s.campos.map((c) => (
            <div key={c.rotulo} className="rounded-xl bg-papel px-3.5 py-3">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-tinta-3">
                <Icone nome="cadeado" size={13} /> {c.rotulo}
              </dt>
              <dd className="mt-1 text-[15px] font-semibold text-tinta">{c.valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-linha bg-white p-5 sm:p-6" aria-labelledby="perfil-emprego">
        <h2 id="perfil-emprego" className="font-serif text-xl font-bold text-tinta">Dados de empregabilidade</h2>
        <p className="mt-2 text-sm leading-relaxed text-tinta-2">
          Você controla estes campos. Ficam salvos neste navegador e não são enviados a nenhuma empresa sem sua ação.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {CAMPOS.map((c) => (
            <label key={c.campo} className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-tinta-2">{c.rotulo}</span>
              <input
                type={c.tipo}
                value={dados[c.campo] || ''}
                onChange={(e) => alterar(c.campo, e.target.value)}
                placeholder={c.dica}
                className="min-h-11 rounded-xl border border-linha-forte bg-white px-3 text-[16px] text-tinta outline-none placeholder:text-tinta-4 focus:border-azul-500 focus:ring-3 focus:ring-azul-300/40"
              />
            </label>
          ))}
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-tinta-2">Áreas de interesse</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {AREAS.map((area) => {
              const marcada = interesses.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  aria-pressed={marcada}
                  onClick={() => alternarInteresse(area)}
                  className={`chip ${marcada ? 'chip-ativo' : ''}`}
                >
                  {marcada && <Icone nome="check" size={16} />}
                  {area}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-wrap gap-2.5 border-t border-linha pt-5">
          <button type="button" onClick={salvar} disabled={salvo} className="btn-primario min-h-12 px-6">
            {salvo ? 'Tudo salvo' : 'Salvar alterações'}
          </button>
          <button type="button" onClick={descartar} disabled={salvo} className="btn-claro min-h-12">Descartar</button>
        </div>
      </section>

      <section className="rounded-2xl border border-azul-300 bg-white p-5 sm:p-6" aria-labelledby="perfil-privacidade">
        <h2 id="perfil-privacidade" className="font-serif text-xl font-bold text-tinta">Privacidade e seus direitos</h2>
        <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-tinta-2">
          Você pode revogar a autorização de dados acadêmicos a qualquer momento. Revogar apaga o currículo e as marcações;
          sua conta continua existindo, mas a ordenação por compatibilidade fica desligada até você autorizar de novo.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button type="button" onClick={revogar} className="btn-claro min-h-12 border-erro text-erro hover:text-erro">
            Revogar autorização de dados acadêmicos
          </button>
          <button type="button" onClick={apagarConta} className="btn-claro min-h-12 border-erro text-erro hover:text-erro">
            Apagar minha conta
          </button>
        </div>
      </section>
    </main>
  );
}
