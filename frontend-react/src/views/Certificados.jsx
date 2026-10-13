// Prancha 13 — Certificados. Cada certificado pode virar habilidade no currículo, sem digitar de novo.
// O envio de arquivo e a leitura automática ainda não existem (dependem de OCR no servidor): a tela diz isso.
import { useApp } from '../state/AppContext.jsx';
import Icone from '../components/Icone.jsx';

export default function Certificados() {
  const { s, a } = useApp();
  const certificados = s.curriculo.certificacoes || [];

  return (
    <main className="mx-auto flex max-w-[860px] flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-serif text-[26px] font-bold text-tinta">Certificados</h1>
      <p className="text-sm leading-relaxed text-tinta-2">
        Cada certificado pode virar uma habilidade no seu currículo, sem digitar de novo. As habilidades se somam às
        que você já tem; nada é substituído.
      </p>

      <div role="note" className="flex gap-3 rounded-2xl border border-ressalva-barra bg-ressalva-fundo p-4 text-sm leading-relaxed text-ressalva">
        <Icone nome="alerta" size={18} className="mt-0.5 flex-none" />
        <div>
          <p className="font-semibold">O envio de arquivo ainda não está disponível.</p>
          <p className="mt-1">Por enquanto, adicione a certificação no seu currículo, com o nome do curso e as habilidades.</p>
        </div>
      </div>

      <button type="button" onClick={() => a.irView('curriculo')} className="btn-primario min-h-12 self-start px-6">
        Adicionar certificação no currículo
      </button>

      {certificados.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linha-forte bg-white p-6 text-sm text-tinta-2">
          Nenhum certificado ainda. Quando você adicionar um, ele aparece aqui.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {certificados.map((c) => (
            <li key={c.id} className="flex flex-col gap-1.5 rounded-2xl border border-linha bg-white p-4 sm:p-5">
              <p className="text-[15px] font-bold text-tinta">{c.nome}</p>
              <p className="text-sm text-tinta-3">
                {[c.instituicao, c.ano].filter(Boolean).join(' · ')}
              </p>
              {c.habilidades?.length > 0 && (
                <p className="text-sm text-tinta-2">Habilidades: {c.habilidades.join(', ')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
