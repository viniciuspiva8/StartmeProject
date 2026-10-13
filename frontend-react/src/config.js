// Configuração de ambiente do frontend React.
// Valores vêm de .env.local (prefixo VITE_). Ver .env.example.
export const CONFIG = Object.freeze({
  COLETOR_URL: String(import.meta.env.VITE_COLETOR_URL || 'http://localhost:8000').replace(/\/$/, ''),
});
