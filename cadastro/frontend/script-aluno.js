// A URL base da sua API. Certifique-se de que corresponda à porta que sua API está usando.
const API_URL = 'http://localhost:3000';

// Elementos do DOM que serão manipulados frequentemente
const formAluno = document.getElementById("form-aluno");
const selectCurso = document.getElementById("curso");
const btnSubmit = document.getElementById("btn-submit");
const btnCancelar = document.getElementById("btn-cancelar");
const tbodyAlunos = document.getElementById("tabela-alunos");

// Variável para armazenar o ID do aluno que está sendo editado
let alunoEmEdicaoId = null;

// Função para buscar e popular o dropdown de cursos
async function popularCursos() {
    selectCurso.innerHTML = '<option value="">Carregando cursos...</option>'; // Reseta e exibe mensagem de carregamento
    try {
        const response = await fetch(`${API_URL}/cursos`);
        if (!response.ok) {
            throw new Error(`Erro ao carregar cursos: ${response.statusText}`);
        }
        const cursos = await response.json();

        selectCurso.innerHTML = '<option value="">Selecione um Curso</option>'; // Opção padrão
        cursos.forEach(curso => {
            const option = document.createElement('option');
            option.value = curso.Id_Curso;
            option.textContent = curso.Nome;
            selectCurso.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao popular cursos:", error);
        selectCurso.innerHTML = '<option value="">Erro ao carregar cursos</option>';
        alert(`Não foi possível carregar os cursos: ${error.message}`);
    }
}

// Função para buscar e exibir os alunos na tabela
async function carregarAlunos() {
    tbodyAlunos.innerHTML = "<tr><td colspan='9'>Carregando alunos...</td></tr>"; // Colspan ajustado para 9

    try {
        const response = await fetch(`${API_URL}/alunos`);
        if (!response.ok) {
            throw new Error(`Erro ao carregar alunos: ${response.statusText}`);
        }
        const alunos = await response.json();
        
        tbodyAlunos.innerHTML = ""; // Limpa a tabela

        if (alunos.length === 0) {
            tbodyAlunos.innerHTML = "<tr><td colspan='9'>Nenhum aluno cadastrado.</td></tr>"; // Colspan ajustado para 9
            return;
        }

        for (const aluno of alunos) {
            const dataNascimentoFormatada = aluno.Data_Nascimento ? new Date(aluno.Data_Nascimento).toLocaleDateString('pt-BR') : 'N/A';
            
            let nomeCurso = 'N/A';
            if (aluno.Id_Curso) {
                try {
                    const cursoResponse = await fetch(`${API_URL}/cursos/${aluno.Id_Curso}`);
                    if (cursoResponse.ok) {
                        const cursoData = await cursoResponse.json();
                        if (cursoData.length > 0) {
                            nomeCurso = cursoData[0].Nome; 
                        }
                    } else {
                        console.warn(`Curso com ID ${aluno.Id_Curso} não encontrado.`);
                    }
                } catch (cursoError) {
                    console.error(`Erro ao buscar nome do curso ${aluno.Id_Curso}:`, cursoError);
                }
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${aluno.Id_Aluno}</td>
                <td>${aluno.Nome}</td>
                <td>${aluno.CPF}</td>
                <td>${aluno.RG}</td>
                <td>${aluno.Idade}</td>
                <td>${dataNascimentoFormatada}</td>
                <td>${nomeCurso}</td>
                <td>${aluno.Semestre}</td>
                <td>
                    <button class="btn-editar" onclick="prepararEdicaoAluno(${aluno.Id_Aluno})">Editar</button>
                    <button class="btn-excluir" onclick="excluirAluno(${aluno.Id_Aluno})">Excluir</button>
                </td>
            `;
            tbodyAlunos.appendChild(tr);
        }

    } catch (error) {
        console.error("Erro ao carregar alunos:", error);
        tbodyAlunos.innerHTML = `<tr><td colspan='9' style="color: red;">Falha ao carregar alunos: ${error.message}</td></tr>`; // Colspan ajustado para 9
    }
}

// Event Listener para o formulário de cadastro/atualização
formAluno.addEventListener("submit", async function (e) {
    e.preventDefault();

    const alunoData = {
        Nome: document.getElementById("nome").value,
        CPF: document.getElementById("cpf").value,
        RG: document.getElementById("rg").value,
        Idade: parseInt(document.getElementById("idade").value),
        Data_Nascimento: document.getElementById("dataNascimento").value,
        Id_Curso: parseInt(selectCurso.value),
        Semestre: parseInt(document.getElementById("semestre").value),
    };

    try {
        let response;
        if (alunoEmEdicaoId) {
            response = await fetch(`${API_URL}/alunos/${alunoEmEdicaoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alunoData),
            });
        } else {
            response = await fetch(`${API_URL}/alunos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alunoData),
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.mensagem || `Erro ao salvar aluno: ${response.statusText}`);
        }

        const result = await response.json();
        alert(result.mensagem);
        
        resetarFormulario();
        carregarAlunos();

    } catch (error) {
        console.error("Erro ao salvar aluno:", error);
        alert(`Erro ao salvar aluno: ${error.message}`);
    }
});

// Função para excluir um aluno
async function excluirAluno(id) {
    if (!confirm("Tem certeza que deseja excluir este aluno?")) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/alunos/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.mensagem || `Erro ao excluir aluno: ${response.statusText}`);
        }

        const result = await response.json();
        alert(result.mensagem);
        carregarAlunos();

    } catch (error) {
        console.error("Erro ao excluir aluno:", error);
        alert(`Erro ao excluir aluno: ${error.message}`);
    }
}

// Função para preparar o formulário para edição
async function prepararEdicaoAluno(id) {
    try {
        const response = await fetch(`${API_URL}/alunos/${id}`);
        if (!response.ok) {
            throw new Error(`Aluno com ID ${id} não encontrado para edição.`);
        }
        const alunoArray = await response.json();
        const aluno = alunoArray[0]; 

        document.getElementById("nome").value = aluno.Nome;
        document.getElementById("cpf").value = aluno.CPF;
        document.getElementById("rg").value = aluno.RG;
        document.getElementById("idade").value = aluno.Idade;
        document.getElementById("dataNascimento").value = aluno.Data_Nascimento ? aluno.Data_Nascimento.split('T')[0] : '';
        selectCurso.value = aluno.Id_Curso;
        document.getElementById("semestre").value = aluno.Semestre;

        alunoEmEdicaoId = id;
        btnSubmit.textContent = "Salvar Alterações";
        btnCancelar.style.display = 'inline-block';
        
        formAluno.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (error) {
        console.error("Erro ao carregar dados do aluno para edição:", error);
        alert(`Erro ao carregar dados do aluno para edição: ${error.message}`);
    }
}

// Função para resetar o formulário e sair do modo de edição
function resetarFormulario() {
    formAluno.reset();
    alunoEmEdicaoId = null;
    btnSubmit.textContent = "Cadastrar Aluno";
    btnCancelar.style.display = 'none';
}

// Event listener para o botão "Cancelar"
btnCancelar.addEventListener('click', resetarFormulario);

// Funções iniciais ao carregar a página
document.addEventListener('DOMContentLoaded', async () => {
    await popularCursos();
    await carregarAlunos();
});