// Meu currículo: o ativo central do aluno no StartMe.
// Tudo o que entra aqui (certificações, atividades, voluntariado, habilidades)
// alimenta o match com as vagas na hora, e o mesmo conteúdo vira o currículo
// padrão que o aluno exporta em PDF para os sites das empresas.
import { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import Icone from '../components/Icone.jsx';
import { pendenciasDoCurriculo } from './curriculo/utilidades';
import { RestaurarDemo } from './curriculo/ui';
import { SecaoPortal, SecaoContato, SecaoResumo } from './curriculo/secoes-basicas';
import { SecaoHabilidades } from './curriculo/habilidades';
import { SecaoCertificacoes, SecaoAtividades, SecaoIdiomas } from './curriculo/secoes-academicas';
import { Previa } from './curriculo/previa';

export { pendenciasDoCurriculo } from './curriculo/utilidades';

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
            className={`min-h-11 cursor-pointer rounded-lg text-sm font-semibold ${aba === id ? 'bg-white text-azul shadow-painel' : 'text-tinta-3'}`}>
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
