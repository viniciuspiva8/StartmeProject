-- Dados FICTÍCIOS para a simulação. Nenhum deles corresponde a uma pessoa real.
-- CPFs com dígitos verificadores válidos (são exemplos públicos de documentação), usados só aqui.
-- Idempotente: pode rodar de novo sem duplicar.

INSERT INTO curso (nome, qtd_semestres)
SELECT 'Engenharia de Computação', 10
WHERE NOT EXISTS (SELECT 1 FROM curso WHERE nome = 'Engenharia de Computação');

INSERT INTO curso (nome, qtd_semestres)
SELECT 'Ciência da Computação', 8
WHERE NOT EXISTS (SELECT 1 FROM curso WHERE nome = 'Ciência da Computação');

INSERT INTO aluno (cpf, nome, situacao, id_curso, periodo_atual)
SELECT '00000000000', 'Vinicius Pereira', 'ATIVO',
       (SELECT id FROM curso WHERE nome = 'Engenharia de Computação'), 7
WHERE NOT EXISTS (SELECT 1 FROM aluno WHERE cpf = '00000000000');

INSERT INTO aluno (cpf, nome, situacao, id_curso, periodo_atual)
SELECT '11144477735', 'Aluno Fictício 1', 'ATIVO',
       (SELECT id FROM curso WHERE nome = 'Engenharia de Computação'), 7
WHERE NOT EXISTS (SELECT 1 FROM aluno WHERE cpf = '11144477735');

INSERT INTO aluno (cpf, nome, situacao, id_curso, periodo_atual)
SELECT '52998224725', 'Aluna Fictícia 2', 'ATIVO',
       (SELECT id FROM curso WHERE nome = 'Ciência da Computação'), 3
WHERE NOT EXISTS (SELECT 1 FROM aluno WHERE cpf = '52998224725');

INSERT INTO aluno (cpf, nome, situacao, id_curso, periodo_atual)
SELECT '12345678909', 'Aluno Fictício 3', 'TRANCADO',
       (SELECT id FROM curso WHERE nome = 'Engenharia de Computação'), 4
WHERE NOT EXISTS (SELECT 1 FROM aluno WHERE cpf = '12345678909');
