// Conjunto pequeno de ícones de linha, desenhados para o StartMe (24×24, traço 1,75).
// Os ícones do portal simulado (maleta, capelo etc.) são pictogramas genéricos,
// não logos de terceiros. Conteúdo de PATHS é constante do código, nunca dado externo.
const PATHS = {
  // portal simulado
  pessoa: '<circle cx="12" cy="8.5" r="3.2"/><path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5"/>',
  cadeado: '<rect x="5.5" y="10.5" width="13" height="9" rx="1.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  certificado: '<circle cx="12" cy="12" r="8"/><path d="M9 12l2 2 4-4"/>',
  diploma: '<path d="M12 3l3 2v4l-3 2-3-2V5z"/><path d="M9 11l-1.5 7 2.5-1 2 2 2-2 2.5 1L15 11"/>',
  historico: '<rect x="6" y="4" width="12" height="16" rx="1.5"/><path d="M9 9h6M9 12.5h6M9 16h3.5"/>',
  maleta: '<rect x="4" y="9" width="16" height="10" rx="1.5"/><path d="M9 9V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M4 13.5h16"/>',
  capelo: '<path d="M12 6 2 10l10 4 10-4-10-4z"/><path d="M6 12.5V17c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4.5"/>',
  educa: '<path d="M12 6c-1.8-1.3-4.2-2-6.5-2-.3 0-.5.2-.5.5v11c0 .3.2.5.5.5 2.3 0 4.7.7 6.5 2 1.8-1.3 4.2-2 6.5-2 .3 0 .5-.2.5-.5v-11c0-.3-.2-.5-.5-.5-2.3 0-4.7.7-6.5 2z"/><path d="M12 6v12"/>',
  executor: '<path d="M9 8l-4 4 4 4"/><path d="M15 8l4 4-4 4"/>',
  raio: '<path d="M13 3 5 13h5l-1 8 8-10h-5l1-8z"/>',
  // interface
  busca: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  predio: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9.5 20.5v-3.5h5v3.5M9 7.5h.01M12 7.5h.01M15 7.5h.01M9 11h.01M12 11h.01M15 11h.01"/>',
  local: '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  dinheiro: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.4"/><path d="M6.5 12h.01M17.5 12h.01"/>',
  relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  marcador: '<path d="M6.5 4.5h11v16l-5.5-3.8-5.5 3.8z"/>',
  externo: '<path d="M14 4.5h5.5V10M19.5 4.5l-8.5 8.5M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10"/>',
  check: '<path d="m5 12.5 4.5 4.5 9.5-9.5"/>',
  alerta: '<path d="M12 4.5 3 19.5h18z"/><path d="M12 10v4.5M12 17h.01"/>',
  menos: '<path d="M6 12h12"/>',
  fechar: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  abaixo: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  voltar: '<path d="m14.5 6-6 6 6 6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  notas: '<path d="M6 4h10.5A2.5 2.5 0 0 1 19 6.5V20H8.5A2.5 2.5 0 0 1 6 17.5z"/><path d="M6 17.5A2.5 2.5 0 0 1 8.5 15H19M9.5 8h6M9.5 11h4"/>',
  sair: '<path d="M14.5 4.5h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10"/>',
  olho: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  olhoFechado: '<path d="M4 4l16 16M10.4 5.7c.5-.1 1-.2 1.6-.2 6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.7 3.5M6.6 7.3A15.5 15.5 0 0 0 2.5 12s3.5 6.5 9.5 6.5c1.5 0 2.9-.4 4.1-1"/>',
  casa: '<path d="M4.5 10.5 12 4l7.5 6.5V20h-15z"/><path d="M10 20v-5.5h4V20"/>',
  lista: '<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
  enviado: '<path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>',
  escudo: '<path d="M12 3.5 5 6.5v5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9v-5z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  baixar: '<path d="M12 4.5v10.5M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  bloqueio: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
};

export default function Icone({ nome, size = 20, cheio = false, className = '', titulo }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={cheio ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      className={`flex-none ${className}`}
      dangerouslySetInnerHTML={{ __html: PATHS[nome] || PATHS.info }}
    />
  );
}
