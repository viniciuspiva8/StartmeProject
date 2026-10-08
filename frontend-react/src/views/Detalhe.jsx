// Painel de detalhe da vaga (Pranchas 6 e 7). No desktop fica ao lado da
// lista; no celular abre em tela cheia, com a barra de ações fixa embaixo.
import { useEffect, useRef } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { linkSeguro } from '../lib/api.js';
import Icone from '../components/Icone.jsx';
import { Monograma } from '../components/VagaCard.jsx';
import { TriagemCompleta } from '../components/Triagem.jsx';

export default function Detalhe({ v, telaCheia = false }) {
  const { s, a } = useApp();
  const tituloRef = useRef(null);

  // Ao abrir em tela cheia, o foco vai para o título (leitores de tela anunciam a vaga).
  useEffect(() => { if (telaCheia) tituloRef.current?.focus(); }, [telaCheia, v.id]);

  const fatos = [
    { icone: 'dinheiro', rotulo: 'Salário', valor: v.salarioTxt ?? 'Não informado na origem', fraco: !v.salarioTxt },
    { icone: 'local', rotulo: 'Modalidade', valor: v.modalidade },
    { icone: 'capelo', rotulo: 'Área', valor: v.area },
    { icone: 'relogio', rotulo: 'Coletada em', valor: v.dataColeta || v.quandoTxt },
  ];

  return (
    <article className="@container flex min-h-full flex-col [view-transition-name:detalhe]">
      {telaCheia && (
        <div className="sticky top-0 z-10 flex h-14 items-center border-b border-linha bg-white/95 px-2 backdrop-blur">
          <button type="button" onClick={a.fecharVaga} className="btn-fantasma">
            <Icone nome="voltar" size={20} /> Vagas
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <Monograma letra={v.monograma} grande />
            <div className="min-w-0">
              <h1 ref={tituloRef} tabIndex={-1} className="font-serif text-[26px] leading-[1.2] font-bold text-tinta focus:outline-none sm:text-[30px]">
                {v.titulo}
              </h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-[15px] text-tinta-2">
                <Icone nome="predio" size={17} className="text-tinta-4" /> {v.empresa}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-linha py-4 @3xl:grid-cols-4">
            {fatos.map((f) => (
              <div key={f.rotulo} className="min-w-0">
                <dt className="rotulo flex items-center gap-1.5">
                  <Icone nome={f.icone} size={15} className="text-tinta-4" /> {f.rotulo}
                </dt>
                <dd className={`mt-0.5 text-[15px] ${f.fraco ? 'text-tinta-3' : 'font-semibold text-tinta'}`}>{f.valor}</dd>
              </div>
            ))}
          </dl>

          <Acoes v={v} fixa={false} className={telaCheia ? 'hidden' : 'flex'} />
        </header>

        <TriagemCompleta triagem={v.triagem} />

        <section aria-labelledby="descricao-titulo" className="flex flex-col gap-3">
          <h2 id="descricao-titulo" className="font-serif text-xl font-bold text-tinta">Descrição do anúncio</h2>
          {v.descricao ? (
            <>
              <div className="max-w-[68ch] text-[15px] leading-[1.7] whitespace-pre-line text-tinta-2">{v.descricao}</div>
              <p className="text-[13px] text-tinta-3">Texto como veio da coleta automática, sem reformatação.</p>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-linha-forte p-6">
              <p className="font-semibold text-tinta">A coleta não trouxe descrição para esta vaga.</p>
              <p className="mt-1 max-w-[56ch] text-sm leading-relaxed text-tinta-3">
                O anúncio original tem as informações completas. Abra antes de decidir.
              </p>
              <a href={linkSeguro(v.link)} target="_blank" rel="noopener noreferrer" className="btn-claro mt-4">
                Abrir anúncio original <Icone nome="externo" size={16} />
              </a>
            </div>
          )}
        </section>
      </div>

      {telaCheia && <Acoes v={v} fixa />}
    </article>
  );
}

function Acoes({ v, fixa, className = 'flex' }) {
  const { a } = useApp();
  return (
    <div className={fixa
      ? 'sticky bottom-0 z-10 border-t border-linha bg-white/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur'
      : `${className} flex-col gap-2`}
    >
      <div className={fixa ? 'grid grid-cols-[1fr_auto] gap-2' : 'flex flex-wrap items-center gap-2'}>
        <a href={linkSeguro(v.link)} target="_blank" rel="noopener noreferrer" className={`btn-primario whitespace-nowrap ${fixa ? 'col-span-2' : ''}`}>
          Ir para a vaga <Icone nome="externo" size={17} />
          <span className="sr-only">(abre o site da empresa em outra aba)</span>
        </a>
        <button
          type="button"
          aria-pressed={v.aplicada}
          onClick={() => a.toggleAplicada(v, v.aplicada)}
          className={`btn-claro ${v.aplicada ? 'border-agua bg-agua-fundo text-agua-texto hover:border-agua hover:text-agua-texto' : ''}`}
        >
          <Icone nome={v.aplicada ? 'check' : 'enviado'} size={17} />
          {v.aplicada ? 'Você se candidatou' : 'Já me candidatei'}
        </button>
        <button
          type="button"
          aria-pressed={v.salva}
          aria-label={v.salva ? 'Remover das salvas' : 'Salvar vaga'}
          onClick={() => a.toggleSalvar(v.id)}
          className={`btn-claro px-3 ${v.salva ? 'text-azul' : ''}`}
        >
          <Icone nome="marcador" size={18} cheio={v.salva} />
          <span className="hidden sm:inline">{v.salva ? 'Salva' : 'Salvar'}</span>
        </button>
      </div>
      {!fixa && (
        <p className="text-[13px] leading-relaxed text-tinta-3">
          A candidatura é feita no site da empresa. "Já me candidatei" é uma anotação sua, que o StartMe não envia a ninguém.
        </p>
      )}
    </div>
  );
}
