// Início do aluno (Prancha 4). A saudação com nome, curso e semestre é a prova
// visível de que a integração com o Portal Acadêmico funcionou.
import { useApp } from '../state/AppContext.jsx';
import { enfeitar, ordenar } from '../lib/vagas.js';
import VagaCard from '../components/VagaCard.jsx';
import Icone from '../components/Icone.jsx';
import { lacunas } from '../lib/match.js';
import { pendenciasDoCurriculo } from './Curriculo.jsx';

function saudacao(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Home() {
  const { s, a, perfil } = useApp();
  const ctx = { aplicadas: s.aplicadas, salvas: s.salvas, perfil };
  const todas = s.vagas.map((v) => enfeitar(v, ctx));
  const novas = todas.filter((v) => v.dias === 0).length;
  const combinam = todas.filter((v) => ['vale', 'ressalvas'].includes(v.triagem.estado) && !v.triagem.acimaDoSemestre).length;
  const destaques = ordenar(s.vagas, 'compat', perfil).slice(0, 3).map((v) => enfeitar(v, ctx));
  const faltam = lacunas(s.vagas, perfil);
  const pendencias = pendenciasDoCurriculo(s.curriculo);
  const curso = s.campos.find((c) => c.rotulo === 'Curso')?.valor ?? 'seu curso';
  const nome = (s.campos.find((c) => c.rotulo === 'Nome completo')?.valor ?? 'Vinicius').split(' ')[0];
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <main>
      <section className="bg-azul text-white">
        <div className="mx-auto max-w-[1180px] px-4 pt-10 pb-24 sm:px-6 sm:pt-14">
          <p className="text-sm text-white/70 first-letter:uppercase">{hoje}</p>
          <h1 className="mt-2 font-serif text-[34px] leading-tight font-bold sm:text-[44px]">{saudacao()}, {nome}.</h1>
          <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-white/85">
            {novas > 0 ? <>Hoje entraram <strong className="text-white">{novas} {novas === 1 ? 'vaga nova' : 'vagas novas'}</strong>. </> : null}
            <strong className="text-white">{combinam} {combinam === 1 ? 'vaga combina' : 'vagas combinam'}</strong> com o seu currículo de {curso}, {s.semestreAluno}º semestre.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => a.irView('vagas')} className="btn bg-white text-azul hover:bg-nevoa">
              <Icone nome="busca" size={18} /> Buscar vagas
            </button>
            <span className="inline-flex items-center gap-2 text-[13px] text-white/70">
              <Icone nome="escudo" size={17} className="text-agua-claro" />
              Curso e semestre vieram do Portal Acadêmico.
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto -mt-14 max-w-[1180px] px-4 pb-12 sm:px-6">
        <section aria-labelledby="destaques">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 id="destaques" className="font-serif text-2xl font-bold text-white">Vale olhar primeiro</h2>
            <button type="button" onClick={() => a.irView('vagas')} className="hidden text-sm font-semibold text-white/85 hover:text-white hover:underline sm:inline">
              Ver todas as {s.vagas.length} vagas
            </button>
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            {destaques.map((v) => (
              <li key={v.id}><VagaCard v={v} variante="destaque" /></li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="curriculo-titulo" className="mt-12">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 id="curriculo-titulo" className="font-serif text-2xl font-bold text-tinta">Seu currículo</h2>
            <button type="button" onClick={() => a.irView('curriculo')} className="text-sm font-semibold whitespace-nowrap text-azul-700 hover:underline">
              Abrir currículo
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-linha bg-white p-5">
              <h3 className="text-[15px] font-bold text-tinta">Pedidas nas vagas, ausentes no seu currículo</h3>
              <p className="mt-1 text-[13px] text-tinta-3">Se você já sabe, adicione: a avaliação das vagas muda na hora.</p>
              {faltam.length === 0 ? (
                <p className="mt-4 text-sm text-agua-texto">Seu currículo cobre todos os requisitos obrigatórios das vagas atuais.</p>
              ) : (
                <ul className="mt-4 flex flex-col divide-y divide-linha">
                  {faltam.map((f) => (
                    <li key={f.termo} className="flex items-center justify-between gap-3 py-2.5">
                      <span>
                        <span className="block text-sm font-semibold text-tinta">{f.termo}</span>
                        <span className="block text-[13px] text-tinta-3">Obrigatório em {f.vagas} {f.vagas === 1 ? 'vaga' : 'vagas'}</span>
                      </span>
                      <button type="button" onClick={() => a.declararHabilidade(f.termo)} className="btn-claro min-h-9 rounded-lg px-3 text-[13px]">
                        Eu sei {f.termo}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-linha bg-white p-5">
              <h3 className="text-[15px] font-bold text-tinta">
                {pendencias.length === 0 ? 'Currículo completo' : 'Para deixar o currículo completo'}
              </h3>
              <p className="mt-1 text-[13px] text-tinta-3">É este currículo que você exporta em PDF para os sites das empresas.</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {pendencias.length === 0 ? (
                  <li className="flex items-center gap-2 text-sm text-agua-texto"><Icone nome="check" size={17} /> Todas as seções preenchidas.</li>
                ) : pendencias.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm text-tinta-2">
                    <span aria-hidden="true" className="size-4 flex-none rounded-full border-2 border-dashed border-linha-forte" />
                    {p}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => a.irView('curriculo')} className="btn-primario mt-5">Completar currículo</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
