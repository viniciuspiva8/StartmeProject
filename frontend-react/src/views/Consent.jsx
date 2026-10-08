// Prancha 3: consentimento e transferência de dados. A minimização da LGPD
// em forma de tela: o que é compartilhado (com finalidade) ao lado do que nunca é.
import { DADOS_NAO, DADOS_SIM } from '../data/mock.js';
import { useApp } from '../state/AppContext.jsx';
import Icone from '../components/Icone.jsx';

export default function Consent() {
  const { a } = useApp();
  return (
    <main className="min-h-dvh bg-azul px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-[880px] rounded-3xl bg-white p-6 shadow-flutuante sm:p-10">
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="grid size-11 place-items-center rounded-xl border-2 border-azul font-serif font-bold text-azul">PA</span>
          <span className="h-px w-8 bg-linha-forte" />
          <span className="grid size-11 place-items-center rounded-xl bg-azul font-serif text-xl font-bold text-white">S</span>
        </div>
        <h1 className="mt-6 max-w-[28ch] font-serif text-[28px] leading-tight font-bold text-tinta sm:text-[32px]">
          O Portal Acadêmico vai compartilhar quatro dados seus com o StartMe
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-tinta-3">
          Você autoriza uma vez, no primeiro acesso, e pode revogar depois no seu perfil.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <section aria-labelledby="sim" className="rounded-2xl bg-agua-fundo p-5">
            <h2 id="sim" className="flex items-center gap-2 text-[15px] font-bold text-agua-texto">
              <Icone nome="check" size={18} /> Compartilhado, e para quê
            </h2>
            <ul className="mt-4 flex flex-col gap-4">
              {DADOS_SIM.map((d) => (
                <li key={d.nome}>
                  <p className="text-[15px] font-semibold text-tinta">{d.nome}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-tinta-2">{d.para}</p>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="nao" className="rounded-2xl border border-linha bg-papel p-5">
            <h2 id="nao" className="flex items-center gap-2 text-[15px] font-bold text-tinta-2">
              <Icone nome="bloqueio" size={18} /> Nunca acessado
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {DADOS_NAO.map((n) => (
                <li key={n} className="rounded-pill border border-linha-forte bg-white px-3 py-1 text-[13px] text-tinta-3 line-through decoration-tinta-4">{n}</li>
              ))}
            </ul>
            <p className="mt-4 text-[13px] leading-relaxed text-tinta-3">
              Os quatro dados valem pelo tempo da sessão. O StartMe não copia o seu histórico acadêmico.
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={a.naoAutorizar} className="btn-fantasma">Não autorizar</button>
          <button type="button" onClick={a.autorizar} className="btn-primario min-h-12 px-6 text-[15px]">Autorizar e continuar</button>
        </div>
      </div>
    </main>
  );
}
