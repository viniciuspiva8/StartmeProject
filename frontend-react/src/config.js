// Configuração de ambiente do frontend React.
// Valores vêm de .env.local (prefixo VITE_). Ver .env.example.
export const CONFIG = Object.freeze({
  COLETOR_URL: String(import.meta.env.VITE_COLETOR_URL || 'http://localhost:8000').replace(/\/$/, ''),
  CADASTRO_URL: String(import.meta.env.VITE_CADASTRO_URL || 'http://localhost:3000').replace(/\/$/, ''),
  // Sem autenticação de usuário final no cadastro (README, "Pendências conhecidas"):
  // a tela de dados acadêmicos lê sempre este aluno fixo.
  ID_ALUNO_DEMO: 1,
});
