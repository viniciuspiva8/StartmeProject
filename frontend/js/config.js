// Configuração de ambiente do frontend StartMe.
//
// As URLs dos dois backends são definidas em index.html, ANTES deste arquivo
// ser carregado — mesmo padrão de coletor/web/index.html (window.STARTME_API_URL):
//
//   <script>
//     window.STARTME_COLETOR_URL = "http://localhost:8000";
//     window.STARTME_CADASTRO_URL = "http://localhost:3000";
//   </script>
//
// Troque os valores ali, não aqui. Se nenhum dos backends estiver no ar, o
// frontend continua funcionando com os dados mock (ver js/mock-data.js e
// js/api.js) — nenhum dos dois backends é obrigatório para navegar a demo.
"use strict";

const CONFIG = Object.freeze({
  COLETOR_URL: String(window.STARTME_COLETOR_URL || "http://localhost:8000").replace(/\/$/, ""),
  CADASTRO_URL: String(window.STARTME_CADASTRO_URL || "http://localhost:3000").replace(/\/$/, ""),

  // Aluno de demonstração usado para GET {CADASTRO_URL}/alunos/:id — o cadastro
  // (Node/Express/MySQL) não tem autenticação de usuário final (ver README.md,
  // "Pendências conhecidas"), então a Prancha 9 sempre lê um Id_Aluno fixo.
  ID_ALUNO_DEMO: 1
});
