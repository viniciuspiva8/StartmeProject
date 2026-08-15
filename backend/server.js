const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const PORT = 3000; // Define a porta uma vez

app.use(cors());
app.use(express.json());

// Conexão com o banco de dados
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'DB12'
});

// Middleware de tratamento de erros global (para capturar erros que chegam aqui)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ mensagem: 'Algo deu errado no servidor!', erro: err.message });
});

// ---------------- EMPRESA ----------------
app.get('/empresas', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM Empresa');
        res.json(rows);
    } catch (error) {
        next(error); // Passa o erro para o middleware de tratamento de erros global
    }
});

// Novo endpoint para buscar empresa por ID
app.get('/empresas/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM Empresa WHERE Id_Empresa = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ mensagem: 'Empresa não encontrada.' });
        }
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

app.post('/empresas', async (req, res, next) => {
    const { Nome, Area, CNPJ, Endereco, Email, Telefone } = req.body;
    try {
        const [result] = await db.query('INSERT INTO Empresa (Nome, Area, CNPJ, Endereco, Email, Telefone) VALUES (?, ?, ?, ?, ?, ?)', [Nome, Area, CNPJ, Endereco, Email, Telefone]);
        // Melhoria: Retornar o ID gerado pelo banco de dados
        res.status(201).json({ mensagem: 'Empresa criada com sucesso', id: result.insertId });
    } catch (error) {
        next(error);
    }
});

app.put('/empresas/:id', async (req, res, next) => {
    const { id } = req.params;
    const { Nome, Area, CNPJ, Endereco, Email, Telefone } = req.body;
    try {
        const [result] = await db.query('UPDATE Empresa SET Nome = ?, Area = ?, CNPJ = ?, Endereco = ?, Email = ?, Telefone = ? WHERE Id_Empresa = ?', [Nome, Area, CNPJ, Endereco, Email, Telefone, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Empresa não encontrada para atualização.' });
        }
        res.json({ mensagem: 'Empresa atualizada com sucesso' });
    } catch (error) {
        next(error);
    }
});

app.delete('/empresas/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM Empresa WHERE Id_Empresa = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Empresa não encontrada para remoção.' });
        }
        res.json({ mensagem: 'Empresa removida com sucesso' });
    } catch (error) {
        next(error);
    }
});

// ---------------- INSTITUICAO ----------------
app.get('/instituicoes', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM Instituicao');
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

// Novo endpoint para buscar instituicao por ID
app.get('/instituicoes/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM Instituicao WHERE Id_Instituicao = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ mensagem: 'Instituição não encontrada.' });
        }
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

app.post('/instituicoes', async (req, res, next) => {
    const { Nome, Tipo, CNPJ, Area_Atuacao, Pais, Estado, Cidade, Endereco, Telefone, Email } = req.body;
    try {
        const [result] = await db.query('INSERT INTO Instituicao (Nome, Tipo, CNPJ, Area_Atuacao, Pais, Estado, Cidade, Endereco, Telefone, Email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [Nome, Tipo, CNPJ, Area_Atuacao, Pais, Estado, Cidade, Endereco, Telefone, Email]);
        // Melhoria: Retornar o ID gerado pelo banco de dados
        res.status(201).json({ mensagem: 'Instituição criada com sucesso', id: result.insertId });
    } catch (error) {
        next(error);
    }
});

app.put('/instituicoes/:id', async (req, res, next) => {
    const { id } = req.params;
    const { Nome, Tipo, CNPJ, Area_Atuacao, Pais, Estado, Cidade, Endereco, Telefone, Email } = req.body;
    try {
        const [result] = await db.query('UPDATE Instituicao SET Nome = ?, Tipo = ?, CNPJ = ?, Area_Atuacao = ?, Pais = ?, Estado = ?, Cidade = ?, Endereco = ?, Telefone = ?, Email = ? WHERE Id_Instituicao = ?', [Nome, Tipo, CNPJ, Area_Atuacao, Pais, Estado, Cidade, Endereco, Telefone, Email, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Instituição não encontrada para atualização.' });
        }
        res.json({ mensagem: 'Instituição atualizada com sucesso' });
    } catch (error) {
        next(error);
    }
});

app.delete('/instituicoes/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM Instituicao WHERE Id_Instituicao = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Instituição não encontrada para remoção.' });
        }
        res.json({ mensagem: 'Instituição removida com sucesso' });
    } catch (error) {
        next(error);
    }
});

// ---------------- CURSO ----------------
app.get('/cursos', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM Curso');
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

// Novo endpoint para buscar curso por ID
app.get('/cursos/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM Curso WHERE Id_Curso = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ mensagem: 'Curso não encontrado.' });
        }
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

app.post('/cursos', async (req, res, next) => {
    const { Nome, Carga_Horaria, Descricao, Qtd_Semestre, Id_Instituicao } = req.body;
    try {
        const [result] = await db.query('INSERT INTO Curso (Nome, Carga_Horaria, Descricao, Qtd_Semestre, Id_Instituicao) VALUES (?, ?, ?, ?, ?)', [Nome, Carga_Horaria, Descricao, Qtd_Semestre, Id_Instituicao]);
        res.status(201).json({ mensagem: 'Curso criado com sucesso', id: result.insertId });
    } catch (error) {
        next(error);
    }
});

app.put('/cursos/:id', async (req, res, next) => {
    const { id } = req.params;
    const { Nome, Carga_Horaria, Descricao, Qtd_Semestre, Id_Instituicao } = req.body;
    try {
        const [result] = await db.query('UPDATE Curso SET Nome = ?, Carga_Horaria = ?, Descricao = ?, Qtd_Semestre = ?, Id_Instituicao = ? WHERE Id_Curso = ?', [Nome, Carga_Horaria, Descricao, Qtd_Semestre, Id_Instituicao, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Curso não encontrado para atualização.' });
        }
        res.json({ mensagem: 'Curso atualizado com sucesso' });
    } catch (error) {
        next(error);
    }
});

app.delete('/cursos/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM Curso WHERE Id_Curso = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Curso não encontrado para remoção.' });
        }
        res.json({ mensagem: 'Curso removido com sucesso' });
    } catch (error) {
        next(error);
    }
});

// ---------------- VAGAS ----------------
app.get('/vagas', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM Vagas');
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

// Novo endpoint para buscar vaga por ID
app.get('/vagas/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM Vagas WHERE Id_Vaga = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ mensagem: 'Vaga não encontrada.' });
        }
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

app.post('/vagas', async (req, res, next) => {
    const { Titulo, Descricao, Salario, Id_Empresa } = req.body;
    try {
        const [result] = await db.query('INSERT INTO Vagas (Titulo, Descricao, Salario, Id_Empresa) VALUES (?, ?, ?, ?)', [Titulo, Descricao, Salario, Id_Empresa]);
        res.status(201).json({ mensagem: 'Vaga criada com sucesso', id: result.insertId });
    } catch (error) {
        next(error);
    }
});

app.put('/vagas/:id', async (req, res, next) => {
    const { id } = req.params;
    const { Titulo, Descricao, Salario, Id_Empresa } = req.body;
    try {
        const [result] = await db.query('UPDATE Vagas SET Titulo = ?, Descricao = ?, Salario = ?, Id_Empresa = ? WHERE Id_Vaga = ?', [Titulo, Descricao, Salario, Id_Empresa, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Vaga não encontrada para atualização.' });
        }
        res.json({ mensagem: 'Vaga atualizada com sucesso' });
    } catch (error) {
        next(error);
    }
});

app.delete('/vagas/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM Vagas WHERE Id_Vaga = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Vaga não encontrada para remoção.' });
        }
        res.json({ mensagem: 'Vaga removida com sucesso' });
    } catch (error) {
        next(error);
    }
});

// ---------------- ALUNO ----------------
app.get('/alunos', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM Aluno');
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

// Novo endpoint para buscar aluno por ID
app.get('/alunos/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM Aluno WHERE Id_Aluno = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ mensagem: 'Aluno não encontrado.' });
        }
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

app.post('/alunos', async (req, res, next) => {
    const { Nome, CPF, RG, Idade, Data_Nascimento, Semestre, Id_Curso } = req.body;
    try {
        const [result] = await db.query('INSERT INTO Aluno (Nome, CPF, RG, Idade, Data_Nascimento, Semestre, Id_Curso) VALUES (?, ?, ?, ?, ?, ?, ?)', [Nome, CPF, RG, Idade, Data_Nascimento, Semestre, Id_Curso]);
        res.status(201).json({ mensagem: 'Aluno criado com sucesso', id: result.insertId });
    } catch (error) {
        next(error);
    }
});

app.put('/alunos/:id', async (req, res, next) => {
    const { id } = req.params;
    const { Nome, CPF, RG, Idade, Data_Nascimento, Semestre, Id_Curso } = req.body;
    try {
        const [result] = await db.query('UPDATE Aluno SET Nome = ?, CPF = ?, RG = ?, Idade = ?, Data_Nascimento = ?, Semestre = ?, Id_Curso = ? WHERE Id_Aluno = ?', [Nome, CPF, RG, Idade, Data_Nascimento, Semestre, Id_Curso, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Aluno não encontrado para atualização.' });
        }
        res.json({ mensagem: 'Aluno atualizado com sucesso' });
    } catch (error) {
        next(error);
    }
});

app.delete('/alunos/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM Aluno WHERE Id_Aluno = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensagem: 'Aluno não encontrado para remoção.' });
        }
        res.json({ mensagem: 'Aluno removido com sucesso' });
    } catch (error) {
        next(error);
    }
});

// ---------------- SERVER LISTEN ----------------
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
