-- Simulação do banco acadêmico da FSA (faculdade_sim). Dados fictícios.
-- O StartMe NUNCA acessa estas tabelas: fala com a faculdade só pela camada de integração
-- (a API em api/ ou a view `vw_startme`, dependendo do provedor configurado).

CREATE TABLE IF NOT EXISTS curso (
    id            SERIAL PRIMARY KEY,
    nome          TEXT NOT NULL,
    qtd_semestres INTEGER NOT NULL CHECK (qtd_semestres BETWEEN 1 AND 20)
);

CREATE TABLE IF NOT EXISTS aluno (
    id            SERIAL PRIMARY KEY,
    cpf           CHAR(11) NOT NULL UNIQUE,
    nome          TEXT NOT NULL,
    situacao      TEXT NOT NULL CHECK (situacao IN ('ATIVO', 'TRANCADO')),
    id_curso      INTEGER NOT NULL REFERENCES curso (id),
    periodo_atual INTEGER NOT NULL CHECK (periodo_atual BETWEEN 1 AND 20)
);

-- Visão que o provedor SQL consome (mesmas colunas que ACADEMICO_SQL_CONSULTA usa).
CREATE OR REPLACE VIEW vw_startme AS
SELECT a.cpf, a.nome, c.nome AS curso, a.periodo_atual AS semestre, a.situacao
FROM aluno a
JOIN curso c ON c.id = a.id_curso;
