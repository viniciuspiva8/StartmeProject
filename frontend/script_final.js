/**
 * =================================================================
 * SCRIPT DE GERENCIAMENTO DO PAINEL ADMIN
 * =================================================================
 * Este script controla todas as interações do painel administrativo,
 * incluindo:
 * - Cadastro de Empresas e Instituições.
 * - Cadastro de Vagas e Cursos associados a eles.
 * - Visualização, Edição e Exclusão de todos os dados.
 * - Comunicação com a API backend via Fetch.
 * =================================================================
 */

// --- CONFIGURAÇÕES GLOBAIS E VARIÁVEIS ---

// Constante para a URL da API. Altere se o endereço do seu backend for diferente.
const API_URL = 'http://localhost:3000';

// Variável de estado para controlar a edição na tabela. Evita edições múltiplas simultaneamente.
let editandoLinha = null;
// Variável para guardar o estado original da linha antes da edição, permitindo cancelar a operação.
let backupDadosLinha = {};


// --- SEÇÃO 1: LÓGICA DOS FORMULÁRIOS DINÂMICOS (UI) ---
// Funções que controlam a visibilidade e o comportamento dos formulários de cadastro.

/**
 * Observador de eventos para o campo 'tipoCadastro'.
 * Altera os formulários visíveis com base na seleção (Empresa ou Instituição).
 */
document.getElementById('tipoCadastro').addEventListener('change', function () {
    const tipoCadastroSelecionado = this.value;
    const ofereceSelect = document.getElementById('oferece');
    const vagaOption = ofereceSelect.querySelector('option[value="vaga"]');
    const cursoOption = ofereceSelect.querySelector('option[value="curso"]');
    const ambosOption = ofereceSelect.querySelector('option[value="ambos"]');

    document.getElementById('formEmpresa').classList.add('hidden');
    document.getElementById('formInstituicao').classList.add('hidden');
    document.querySelectorAll('#formEmpresa input, #formInstituicao input').forEach(input => input.value = '');
    document.getElementById('vagasContainer').innerHTML = '';
    document.getElementById('cursosContainer').innerHTML = '';

    if (ambosOption) {
        ambosOption.style.display = 'none';
        if (ofereceSelect.value === 'ambos') ofereceSelect.value = '';
    }

    ofereceSelect.disabled = false;
    if (vagaOption) vagaOption.style.display = 'block';
    if (cursoOption) cursoOption.style.display = 'block';

    if (tipoCadastroSelecionado === 'empresa') {
        document.getElementById('formEmpresa').classList.remove('hidden');
        ofereceSelect.value = 'vaga';
        ofereceSelect.disabled = true;
        if (cursoOption) cursoOption.style.display = 'none';
        if (vagaOption) vagaOption.style.display = 'block';
    } else if (tipoCadastroSelecionado === 'instituicao') {
        document.getElementById('formInstituicao').classList.remove('hidden');
        ofereceSelect.value = 'curso';
        ofereceSelect.disabled = true;
        if (vagaOption) vagaOption.style.display = 'none';
        if (cursoOption) cursoOption.style.display = 'block';
    } else {
        ofereceSelect.value = '';
    }

    ofereceSelect.dispatchEvent(new Event('change'));

    if (!tipoCadastroSelecionado) {
        document.getElementById('campoVaga').classList.add('hidden');
        document.getElementById('campoCurso').classList.add('hidden');
    }
});

/**
 * Observador de eventos para o campo 'oferece'.
 * Mostra os campos para adicionar Vagas ou Cursos.
 */
document.getElementById('oferece').addEventListener('change', function () {
    document.getElementById('campoVaga').classList.add('hidden');
    document.getElementById('campoCurso').classList.add('hidden');
    document.getElementById('vagasContainer').innerHTML = '';
    document.getElementById('cursosContainer').innerHTML = '';

    if (this.value === 'vaga') {
        document.getElementById('campoVaga').classList.remove('hidden');
    } else if (this.value === 'curso') {
        document.getElementById('campoCurso').classList.remove('hidden');
    }
});

/**
 * Observador de eventos para o campo 'tipoConteudoAdicional'.
 * Controla o formulário para adicionar novas vagas ou cursos a entidades existentes.
 */
document.getElementById('tipoConteudoAdicional').addEventListener('change', async function () {
    const tipoSelecionado = this.value;
    document.getElementById('secaoAdicionarVaga').classList.add('hidden');
    document.getElementById('secaoAdicionarCurso').classList.add('hidden');
    document.getElementById('novaVagaContainer').innerHTML = '';
    document.getElementById('novoCursoContainer').innerHTML = '';

    if (tipoSelecionado === 'novaVaga') {
        document.getElementById('secaoAdicionarVaga').classList.remove('hidden');
        await preencherEmpresasSelect('empresaSelectVaga');
    } else if (tipoSelecionado === 'novoCurso') {
        document.getElementById('secaoAdicionarCurso').classList.remove('hidden');
        await preencherEntidadesSelect('entidadeSelectCurso'); // Dependência: Precisa carregar empresas E instituições
    }
});


// --- SEÇÃO 2: FUNÇÕES DE ADIÇÃO DINÂMICA DE CAMPOS (HELPERS DE UI) ---

function adicionarVaga() {
    const container = document.getElementById('vagasContainer');
    const div = document.createElement('div');
    div.classList.add('vaga-item');
    div.innerHTML = `
        <input class="form-control vaga-titulo" placeholder="Título da Vaga" required>
        <input class="form-control vaga-descricao" placeholder="Descrição da Vaga" required>
        <input class="form-control vaga-salario" type="number" step="0.01" placeholder="Salário" required><br>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentNode.remove()">Remover Vaga</button>
    `;
    container.appendChild(div);
}

function adicionarCamposNovaVaga() {
    const container = document.getElementById('novaVagaContainer');
    const div = document.createElement('div');
    div.classList.add('vaga-item');
    div.innerHTML = `
        <input class="form-control vaga-titulo" placeholder="Título da Vaga" required>
        <input class="form-control vaga-descricao" placeholder="Descrição da Vaga" required>
        <input class="form-control vaga-salario" type="number" step="0.01" placeholder="Salário" required><br>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentNode.remove()">Remover Vaga</button>
    `;
    container.appendChild(div);
}

/**
 * =================================================================
 * INÍCIO DA SEÇÃO VISUAL DE 'CURSOS'
 * =================================================================
 * As funções abaixo estão relacionadas à manipulação de Cursos.
 * Lembre-se que um Curso sempre depende de uma Instituição ou Empresa.
 * =================================================================
 */

/**
 * Adiciona campos de input para um novo curso no formulário de cadastro inicial.
 * Esta é uma função puramente de interface.
 */
function adicionarCurso() {
    const container = document.getElementById('cursosContainer');
    const div = document.createElement('div');
    div.classList.add('curso-item');
    div.innerHTML = `
        <input class="form-control curso-nome" placeholder="Nome do Curso" required>
        <input class="form-control curso-carga" type="number" placeholder="Carga Horária" required>
        <input class="form-control curso-descricao" placeholder="Descrição do Curso" required>
        <input class="form-control curso-semestres" type="number" placeholder="Qtd. Semestres" required><br>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentNode.remove()">Remover Curso</button>
    `;
    container.appendChild(div);
}

/**
 * Adiciona campos de input para um novo curso no formulário de "Adição Posterior".
 * Esta é uma função puramente de interface.
 */
function adicionarCamposNovoCurso() {
    const container = document.getElementById('novoCursoContainer');
    const div = document.createElement('div');
    div.classList.add('curso-item');
    div.innerHTML = `
        <input class="form-control curso-nome" placeholder="Nome do Curso" required>
        <input class="form-control curso-carga" type="number" placeholder="Carga Horária" required>
        <input class="form-control curso-descricao" placeholder="Descrição do Curso" required>
        <input class="form-control curso-semestres" type="number" placeholder="Qtd. Semestres" required><br>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentNode.remove()">Remover Curso</button>
    `;
    container.appendChild(div);
}

// =================== FIM DA SEÇÃO VISUAL DE 'CURSOS' ===================


// --- SEÇÃO 3: OPERAÇÕES COM O BACKEND (API) ---

// 3.1 --- Funções de Carregamento de Dados (GET) ---

async function carregarEmpresas() {
    const tbody = document.getElementById('tabelaEmpresas').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    try {
        const response = await fetch(`${API_URL}/empresas`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const empresas = await response.json();
        empresas.forEach(empresa => {
            const linha = tbody.insertRow();
            linha.setAttribute('data-id', empresa.Id_Empresa);
            linha.setAttribute('data-tipo', 'empresa');
            linha.innerHTML = `<td>${empresa.Id_Empresa}</td><td>${empresa.Nome}</td><td>${empresa.CNPJ}</td><td>${empresa.Telefone}</td><td>${empresa.Email}</td><td>${empresa.Endereco}</td><td>${empresa.Area}</td><td><button class="btn-editar" onclick="editar(this)">Editar</button><button class="btn-excluir" onclick="excluir(this)">Excluir</button></td>`;
        });
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
        alert('Erro ao carregar empresas. Verifique o console.');
    }
}

async function carregarInstituicoes() {
    const tbody = document.getElementById('tabelaInstituicoes').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    try {
        const response = await fetch(`${API_URL}/instituicoes`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const instituicoes = await response.json();
        instituicoes.forEach(instituicao => {
            const linha = tbody.insertRow();
            linha.setAttribute('data-id', instituicao.Id_Instituicao);
            linha.setAttribute('data-tipo', 'instituicao');
            linha.innerHTML = `<td>${instituicao.Id_Instituicao}</td><td>${instituicao.Nome}</td><td>${instituicao.CNPJ}</td><td>${instituicao.Telefone}</td><td>${instituicao.Email}</td><td>${instituicao.Tipo}</td><td>${instituicao.Area_Atuacao}</td><td>${instituicao.Pais}</td><td>${instituicao.Estado}</td><td>${instituicao.Cidade}</td><td>${instituicao.Endereco}</td><td><button class="btn-editar" onclick="editar(this)">Editar</button><button class="btn-excluir" onclick="excluir(this)">Excluir</button></td>`;
        });
    } catch (error) {
        console.error('Erro ao carregar instituições:', error);
        alert('Erro ao carregar instituições. Verifique o console.');
    }
}

async function carregarCursosEVagas() {
    const tbody = document.getElementById('tabelaCursosVagas').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    try {
        // Carregar Vagas
        const responseVagas = await fetch(`${API_URL}/vagas`);
        if (!responseVagas.ok) throw new Error(`HTTP error! status: ${responseVagas.status}`);
        const vagas = await responseVagas.json();
        for (const vaga of vagas) {
            const empresaResponse = await fetch(`${API_URL}/empresas/${vaga.Id_Empresa}`);
            const empresaData = await empresaResponse.json();
            const nomeEntidade = empresaData && empresaData.length > 0 ? empresaData[0].Nome : 'Empresa Desconhecida';
            const linha = tbody.insertRow();
            linha.setAttribute('data-id', vaga.Id_Vaga);
            linha.setAttribute('data-tipo', 'vaga');
            linha.setAttribute('data-id-entidade-associada', vaga.Id_Empresa);
            linha.innerHTML = `<td>${vaga.Id_Vaga}</td><td>${nomeEntidade}</td><td>Vaga</td><td>${vaga.Titulo}</td><td><span class="vaga-descricao-display">Descrição: ${vaga.Descricao}</span><br><span class="vaga-salario-display">Salário: R$ ${parseFloat(vaga.Salario).toFixed(2)}</span></td><td><button class="btn-editar" onclick="editar(this)">Editar</button><button class="btn-excluir" onclick="excluir(this)">Excluir</button></td>`;
        }

        // Carregar Cursos
        const responseCursos = await fetch(`${API_URL}/cursos`);
        if (!responseCursos.ok) throw new Error(`HTTP error! status: ${responseCursos.status}`);
        const cursos = await responseCursos.json();
        for (const curso of cursos) {
            let nomeEntidade = 'Entidade Desconhecida';
            // =================================================================
            //              DEPENDÊNCIA DE CURSO (CARREGAMENTO)
            // =================================================================
            // Para exibir um curso, o código precisa buscar o nome da
            // Empresa ou Instituição à qual ele pertence.
            // A API de /empresas ou /instituicoes deve estar funcionando.
            //
            // AJUSTE VISUAL: O rótulo "INSTITUIÇÃO" ou "EMPRESA" é colocado em caixa alta.
            // =================================================================
            if (curso.Id_Instituicao) {
                const instituicaoResponse = await fetch(`${API_URL}/instituicoes/${curso.Id_Instituicao}`);
                const instituicaoData = await instituicaoResponse.json();
                nomeEntidade = instituicaoData && instituicaoData.length > 0 ? `INSTITUIÇÃO: ${instituicaoData[0].Nome}` : 'INSTITUIÇÃO DESCONHECIDA';
            } else if (curso.Id_Empresa) {
                const empresaResponse = await fetch(`${API_URL}/empresas/${curso.Id_Empresa}`);
                const empresaData = await empresaResponse.json();
                nomeEntidade = empresaData && empresaData.length > 0 ? `EMPRESA: ${empresaData[0].Nome}` : 'EMPRESA DESCONHECIDA';
            }

            const linha = tbody.insertRow();
            linha.setAttribute('data-id', curso.Id_Curso);
            linha.setAttribute('data-tipo', 'curso');
            if (curso.Id_Instituicao) {
                linha.setAttribute('data-id-entidade-associada', curso.Id_Instituicao);
                linha.setAttribute('data-tipo-entidade-associada', 'instituicao');
            } else if (curso.Id_Empresa) {
                linha.setAttribute('data-id-entidade-associada', curso.Id_Empresa);
                linha.setAttribute('data-tipo-entidade-associada', 'empresa');
            }
            linha.innerHTML = `<td>${curso.Id_Curso}</td><td>${nomeEntidade}</td><td>Curso</td><td>${curso.Nome}</td><td><span class="curso-carga-display">Carga Horária: ${curso.Carga_Horaria}h</span><br><span class="curso-semestres-display">Semestres: ${curso.Qtd_Semestre}</span><br><span class="curso-descricao-display">Descrição: ${curso.Descricao}</span></td><td><button class="btn-editar" onclick="editar(this)">Editar</button><button class="btn-excluir" onclick="excluir(this)">Excluir</button></td>`;
        }
    } catch (error) {
        console.error('Erro ao carregar cursos e vagas:', error);
        alert('Erro ao carregar cursos e vagas. Verifique o console.');
    }
}


// 3.2 --- Funções de Criação de Dados (POST) ---

async function salvar() {
    const tipo = document.getElementById('tipoCadastro').value;
    if (!tipo) {
        alert("Por favor, selecione o Tipo de Cadastro (Empresa ou Instituição).");
        return;
    }
    let entidadeId = null;

    try {
        if (tipo === 'empresa') {
            const dadosEmpresa = { Nome: document.getElementById('nomeEmpresa').value, CNPJ: document.getElementById('cnpjEmpresa').value, Telefone: document.getElementById('telefoneEmpresa').value, Email: document.getElementById('emailEmpresa').value, Endereco: document.getElementById('enderecoEmpresa').value, Area: document.getElementById('areaEmpresa').value };
            if (!dadosEmpresa.Nome || !dadosEmpresa.CNPJ) { alert("Nome e CNPJ da Empresa são obrigatórios."); return; }
            const response = await fetch(`${API_URL}/empresas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dadosEmpresa) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(`Erro ao cadastrar empresa: ${errorData.mensagem || response.statusText}`); }
            const data = await response.json();
            alert(data.mensagem);
            entidadeId = data.id;
        } else {
            const dadosInstituicao = { Nome: document.getElementById('nomeInstituicao').value, CNPJ: document.getElementById('cnpjInstituicao').value, Telefone: document.getElementById('telefoneInstituicao').value, Email: document.getElementById('emailInstituicao').value, Tipo: document.getElementById('tipoInstituicao').value, Area_Atuacao: document.getElementById('areaInstituicao').value, Pais: document.getElementById('paisInstituicao').value, Estado: document.getElementById('estadoInstituicao').value, Cidade: document.getElementById('cidadeInstituicao').value, Endereco: document.getElementById('enderecoInstituicao').value };
            if (!dadosInstituicao.Nome || !dadosInstituicao.CNPJ) { alert("Nome e CNPJ da Instituição são obrigatórios."); return; }
            const response = await fetch(`${API_URL}/instituicoes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dadosInstituicao) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(`Erro ao cadastrar instituição: ${errorData.mensagem || response.statusText}`); }
            const data = await response.json();
            alert(data.mensagem);
            entidadeId = data.id;
        }
        await carregarEmpresas();
        await carregarInstituicoes();
    } catch (error) {
        console.error('Erro ao salvar entidade:', error);
        alert(`Erro ao salvar entidade: ${error.message}. Verifique o console.`);
        return;
    }

    if (entidadeId) {
        if (tipo === 'empresa') {
            const vagas = document.getElementById('vagasContainer').querySelectorAll('.vaga-item');
            for (const div of vagas) {
                const dadosVaga = { Titulo: div.querySelector('.vaga-titulo').value, Descricao: div.querySelector('.vaga-descricao').value, Salario: parseFloat(div.querySelector('.vaga-salario').value), Id_Empresa: entidadeId };
                if (!dadosVaga.Titulo || isNaN(dadosVaga.Salario)) { alert("Título e Salário da vaga são obrigatórios."); continue; }
                try {
                    const response = await fetch(`${API_URL}/vagas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dadosVaga) });
                    if (!response.ok) { const errorData = await response.json(); throw new Error(`Erro ao cadastrar vaga: ${errorData.mensagem || response.statusText}`); }
                    const data = await response.json(); console.log(data.mensagem);
                } catch (error) { console.error('Erro ao salvar vaga:', error); alert(`Erro ao salvar vaga: ${error.message}.`); }
            }
        }

        // =================================================================
        //              DEPENDÊNCIA DE CURSO (CRIAÇÃO)
        // =================================================================
        // O curso só é salvo se uma Instituição foi criada antes e seu ID
        // (`entidadeId`) foi capturado com sucesso.
        // O `Id_Instituicao` é obrigatório para a API salvar o curso.
        // =================================================================
        if (tipo === 'instituicao') {
            const cursos = document.getElementById('cursosContainer').querySelectorAll('.curso-item');
            for (const div of cursos) {
                const dadosCurso = { Nome: div.querySelector('.curso-nome').value, Carga_Horaria: parseInt(div.querySelector('.curso-carga').value), Descricao: div.querySelector('.curso-descricao').value, Qtd_Semestre: parseInt(div.querySelector('.curso-semestres').value), Id_Instituicao: entidadeId };
                if (!dadosCurso.Nome || isNaN(dadosCurso.Carga_Horaria) || isNaN(dadosCurso.Qtd_Semestre)) { alert("Dados do curso são obrigatórios e devem ser números."); continue; }
                try {
                    const response = await fetch(`${API_URL}/cursos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dadosCurso) });
                    if (!response.ok) { const errorData = await response.json(); throw new Error(`Erro ao cadastrar curso: ${errorData.mensagem || response.statusText}`); }
                    const data = await response.json(); console.log(data.mensagem);
                } catch (error) { console.error('Erro ao salvar curso:', error); alert(`Erro ao salvar curso: ${error.message}.`); }
            }
        }
        await carregarCursosEVagas();
    }

    document.querySelectorAll('.form-section input').forEach(input => input.value = '');
    document.getElementById('tipoCadastro').value = '';
    const ofereceSelect = document.getElementById('oferece');
    ofereceSelect.value = '';
    ofereceSelect.disabled = false;
    const vagaOption = ofereceSelect.querySelector('option[value="vaga"]');
    const cursoOption = ofereceSelect.querySelector('option[value="curso"]');
    if (vagaOption) vagaOption.style.display = 'block';
    if (cursoOption) cursoOption.style.display = 'block';
    document.getElementById('vagasContainer').innerHTML = '';
    document.getElementById('cursosContainer').innerHTML = '';
    document.getElementById('formEmpresa').classList.add('hidden');
    document.getElementById('formInstituicao').classList.add('hidden');
    document.getElementById('campoVaga').classList.add('hidden');
    document.getElementById('campoCurso').classList.add('hidden');
}

async function salvarNovaVaga() {
    const empresaId = document.getElementById('empresaSelectVaga').value;
    if (!empresaId) { alert("Por favor, selecione a empresa para a vaga."); return; }
    const vagasParaSalvar = [];
    const vagasInputs = document.getElementById('novaVagaContainer').querySelectorAll('.vaga-item');
    if (vagasInputs.length === 0) { alert("Adicione pelo menos uma vaga antes de salvar."); return; }
    for (const div of vagasInputs) {
        const dadosVaga = { Titulo: div.querySelector('.vaga-titulo').value, Descricao: div.querySelector('.vaga-descricao').value, Salario: parseFloat(div.querySelector('.vaga-salario').value), Id_Empresa: parseInt(empresaId) };
        if (!dadosVaga.Titulo || isNaN(dadosVaga.Salario) || dadosVaga.Salario <= 0) { alert("Título e Salário (maior que zero) da vaga são obrigatórios."); return; }
        vagasParaSalvar.push(dadosVaga);
    }
    try {
        for (const vaga of vagasParaSalvar) {
            const response = await fetch(`${API_URL}/vagas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vaga) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(`Erro ao cadastrar vaga: ${errorData.mensagem || response.statusText}`); }
            console.log((await response.json()).mensagem);
        }
        alert("Vaga(s) adicionada(s) com sucesso!");
        document.getElementById('novaVagaContainer').innerHTML = '';
        document.getElementById('empresaSelectVaga').value = '';
        document.getElementById('tipoConteudoAdicional').value = '';
        document.getElementById('secaoAdicionarVaga').classList.add('hidden');
        await carregarCursosEVagas();
    } catch (error) { console.error('Erro ao salvar vaga(s):', error); alert(`Erro ao salvar vaga(s): ${error.message}.`); }
}

/**
 * Salva um ou mais cursos associados a uma entidade (Empresa/Instituição) existente.
 */
async function salvarNovoCurso() {
    // =================================================================
    //              DEPENDÊNCIA DE CURSO (CRIAÇÃO POSTERIOR)
    // =================================================================
    // Esta função exige que o usuário selecione uma Empresa ou Instituição
    // de uma lista. O ID da entidade selecionada é enviado junto com os
    // dados do curso para a API.
    // =================================================================
    const entidadeCompleta = document.getElementById('entidadeSelectCurso').value;
    if (!entidadeCompleta) {
        alert("Por favor, selecione a entidade (Empresa ou Instituição) para o curso.");
        return;
    }
    const [tipoEntidade, idEntidade] = entidadeCompleta.split('-');
    const cursosParaSalvar = [];
    const cursosInputs = document.getElementById('novoCursoContainer').querySelectorAll('.curso-item');
    if (cursosInputs.length === 0) { alert("Adicione pelo menos um curso antes de salvar."); return; }
    for (const div of cursosInputs) {
        const dadosCurso = { Nome: div.querySelector('.curso-nome').value, Carga_Horaria: parseInt(div.querySelector('.curso-carga').value), Descricao: div.querySelector('.curso-descricao').value, Qtd_Semestre: parseInt(div.querySelector('.curso-semestres').value), };
        if (tipoEntidade === 'empresa') {
            dadosCurso.Id_Empresa = parseInt(idEntidade);
        } else if (tipoEntidade === 'instituicao') {
            dadosCurso.Id_Instituicao = parseInt(idEntidade);
        }
        if (!dadosCurso.Nome || isNaN(dadosCurso.Carga_Horaria) || isNaN(dadosCurso.Qtd_Semestre) || dadosCurso.Carga_Horaria <= 0 || dadosCurso.Qtd_Semestre <= 0) {
            alert("Dados do curso são obrigatórios e devem ser números maiores que zero."); return;
        }
        cursosParaSalvar.push(dadosCurso);
    }
    try {
        for (const curso of cursosParaSalvar) {
            const response = await fetch(`${API_URL}/cursos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(curso) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(`Erro ao cadastrar curso: ${errorData.mensagem || response.statusText}`); }
            console.log((await response.json()).mensagem);
        }
        alert("Curso(s) adicionado(s) com sucesso!");
        document.getElementById('novoCursoContainer').innerHTML = '';
        document.getElementById('entidadeSelectCurso').value = '';
        document.getElementById('tipoConteudoAdicional').value = '';
        document.getElementById('secaoAdicionarCurso').classList.add('hidden');
        await carregarCursosEVagas();
    } catch (error) { console.error('Erro ao salvar curso(s):', error); alert(`Erro ao salvar curso(s): ${error.message}.`); }
}


// 3.3 --- Funções de Edição e Exclusão (PUT, DELETE) ---

async function excluir(btn) {
    const linha = btn.parentNode.parentNode;
    const id = linha.getAttribute('data-id');
    const tipo = linha.getAttribute('data-tipo');
    if (!confirm(`Tem certeza que deseja excluir ${tipo} com ID ${id}?`)) return;
    let endpoint = '';
    // A lógica de exclusão para curso é genérica e não tem dependências complexas aqui.
    switch (tipo) {
        case 'empresa': endpoint = 'empresas'; break;
        case 'instituicao': endpoint = 'instituicoes'; break;
        case 'vaga': endpoint = 'vagas'; break;
        case 'curso': endpoint = 'cursos'; break;
        default: alert('Tipo de exclusão desconhecido.'); return;
    }
    try {
        const response = await fetch(`${API_URL}/${endpoint}/${id}`, { method: 'DELETE' });
        if (!response.ok) { const errorData = await response.json(); throw new Error(`Erro ao excluir ${tipo}: ${errorData.mensagem || response.statusText}`); }
        alert((await response.json()).mensagem);
        linha.remove();
        if (tipo === 'empresa' || tipo === 'instituicao') await carregarCursosEVagas();
    } catch (error) { console.error(`Erro ao excluir ${tipo}:`, error); alert(`Erro ao excluir ${tipo}: ${error.message}.`); }
}

async function editar(btn) {
    if (editandoLinha) { alert("Por favor, finalize a edição atual antes de iniciar outra."); return; }
    const linha = btn.parentNode.parentNode;
    const cells = linha.cells;
    const tipo = linha.getAttribute('data-tipo');
    editandoLinha = linha;
    backupDadosLinha = {};
    for (let i = 1; i < cells.length - 1; i++) {
        const cell = cells[i];
        backupDadosLinha[i] = cell.innerHTML;

        // =================================================================
        //              LÓGICA DE EDIÇÃO PARA 'CURSO'
        // =================================================================
        // Esta seção cria os campos de input específicos para editar um curso
        // diretamente na tabela, tratando seus múltiplos campos (carga, semestres, etc.)
        // que estão agrupados em uma única célula da tabela.
        // =================================================================
        if (tipo === 'vaga' && i === 4) {
            const descricao = cell.querySelector('.vaga-descricao-display').innerText.replace('Descrição: ', '').trim();
            const salario = parseFloat(cell.querySelector('.vaga-salario-display').innerText.replace('Salário: R$ ', '').trim());
            cell.innerHTML = `<input type="text" class="form-control edit-vaga-descricao" value="${descricao}"><input type="number" step="0.01" class="form-control edit-vaga-salario" value="${salario}">`;
            continue;
        } else if (tipo === 'curso' && i === 4) {
            const cargaHoraria = parseInt(cell.querySelector('.curso-carga-display').innerText.replace('Carga Horária: ', '').replace('h', '').trim());
            const semestres = parseInt(cell.querySelector('.curso-semestres-display').innerText.replace('Semestres: ', '').trim());
            const descricao = cell.querySelector('.curso-descricao-display').innerText.replace('Descrição: ', '').trim();
            cell.innerHTML = `<input type="number" class="form-control edit-curso-carga" value="${cargaHoraria}"><input type="number" class="form-control edit-curso-semestres" value="${semestres}"><input type="text" class="form-control edit-curso-descricao" value="${descricao}">`;
            continue;
        }

        let valorAtual = cell.innerText.trim();
        if (tipo === 'empresa' || tipo === 'instituicao' || (tipo === 'vaga' && i === 3) || (tipo === 'curso' && i === 3)) {
            cell.innerHTML = `<input type="text" class="form-control" value="${valorAtual}">`;
        }
    }
    cells[cells.length - 1].innerHTML = `<button class="btn btn-success btn-sm" onclick="salvarEdicao(this)">Salvar Edição</button><button class="btn btn-secondary btn-sm" onclick="cancelarEdicao(this)">Cancelar</button>`;
}

async function salvarEdicao(btn) {
    const linha = btn.parentNode.parentNode;
    const id = linha.getAttribute('data-id');
    const tipo = linha.getAttribute('data-tipo');
    const cells = linha.cells;
    let dadosAtualizados = {};
    let endpoint = '';

    try {
        switch (tipo) {
            case 'empresa':
                endpoint = 'empresas';
                dadosAtualizados = { Nome: cells[1].querySelector('input').value, CNPJ: cells[2].querySelector('input').value, Telefone: cells[3].querySelector('input').value, Email: cells[4].querySelector('input').value, Endereco: cells[5].querySelector('input').value, Area: cells[6].querySelector('input').value };
                if (!dadosAtualizados.Nome || !dadosAtualizados.CNPJ) throw new Error("Nome e CNPJ são obrigatórios.");
                break;
            case 'instituicao':
                endpoint = 'instituicoes';
                dadosAtualizados = { Nome: cells[1].querySelector('input').value, CNPJ: cells[2].querySelector('input').value, Telefone: cells[3].querySelector('input').value, Email: cells[4].querySelector('input').value, Tipo: cells[5].querySelector('input').value, Area_Atuacao: cells[6].querySelector('input').value, Pais: cells[7].querySelector('input').value, Estado: cells[8].querySelector('input').value, Cidade: cells[9].querySelector('input').value, Endereco: cells[10].querySelector('input').value };
                if (!dadosAtualizados.Nome || !dadosAtualizados.CNPJ) throw new Error("Nome e CNPJ são obrigatórios.");
                break;
            case 'vaga':
                endpoint = 'vagas';
                dadosAtualizados = { Titulo: cells[3].querySelector('input').value, Descricao: cells[4].querySelector('.edit-vaga-descricao').value, Salario: parseFloat(cells[4].querySelector('.edit-vaga-salario').value), Id_Empresa: parseInt(linha.getAttribute('data-id-entidade-associada')) };
                if (!dadosAtualizados.Titulo || isNaN(dadosAtualizados.Salario)) throw new Error("Título e Salário são obrigatórios.");
                break;
            // =================================================================
            //              DEPENDÊNCIA DE CURSO (EDIÇÃO)
            // =================================================================
            // Ao salvar a edição de um curso, o código lê os atributos
            // `data-tipo-entidade-associada` e `data-id-entidade-associada`
            // para garantir que a associação do curso com sua entidade
            // original seja mantida no pedido à API.
            // =================================================================
            case 'curso':
                endpoint = 'cursos';
                dadosAtualizados = {
                    Nome: cells[3].querySelector('input').value,
                    Carga_Horaria: parseInt(cells[4].querySelector('.edit-curso-carga').value),
                    Qtd_Semestre: parseInt(cells[4].querySelector('.edit-curso-semestres').value),
                    Descricao: cells[4].querySelector('.edit-curso-descricao').value,
                };
                const tipoEntidadeAssociada = linha.getAttribute('data-tipo-entidade-associada');
                const idEntidadeAssociada = parseInt(linha.getAttribute('data-id-entidade-associada'));
                if (tipoEntidadeAssociada === 'instituicao') {
                    dadosAtualizados.Id_Instituicao = idEntidadeAssociada;
                } else if (tipoEntidadeAssociada === 'empresa') {
                    dadosAtualizados.Id_Empresa = idEntidadeAssociada;
                }
                if (!dadosAtualizados.Nome || isNaN(dadosAtualizados.Carga_Horaria) || isNaN(dadosAtualizados.Qtd_Semestre)) throw new Error("Dados do curso são obrigatórios e devem ser números.");
                break;
            default:
                throw new Error('Tipo de entidade desconhecido para edição.');
        }

        const response = await fetch(`${API_URL}/${endpoint}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dadosAtualizados) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(`Erro ao atualizar ${tipo}: ${errorData.mensagem || response.statusText}`); }
        alert((await response.json()).mensagem);

        if (tipo === 'empresa') await carregarEmpresas();
        else if (tipo === 'instituicao') await carregarInstituicoes();
        else await carregarCursosEVagas();
    } catch (error) {
        console.error(`Erro ao salvar edição de ${tipo}:`, error);
        alert(`Erro ao salvar edição de ${tipo}: ${error.message}.`);
        cancelarEdicao(btn);
    } finally {
        editandoLinha = null;
        backupDadosLinha = {};
    }
}

function cancelarEdicao(btn) {
    const linhaParaCancelar = btn.parentNode.parentNode;
    if (!editandoLinha || editandoLinha !== linhaParaCancelar || Object.keys(backupDadosLinha).length === 0) {
        if (linhaParaCancelar) {
            const cells = linhaParaCancelar.cells;
            cells[cells.length - 1].innerHTML = `<button class="btn-editar" onclick="editar(this)">Editar</button><button class="btn-excluir" onclick="excluir(this)">Excluir</button>`;
        }
        editandoLinha = null; backupDadosLinha = {}; return;
    }
    const cells = editandoLinha.cells;
    for (const index in backupDadosLinha) {
        if (cells[index]) cells[index].innerHTML = backupDadosLinha[index];
    }
    cells[cells.length - 1].innerHTML = `<button class="btn-editar" onclick="editar(this)">Editar</button><button class="btn-excluir" onclick="excluir(this)">Excluir</button>`;
    editandoLinha = null; backupDadosLinha = {};
}


// 3.4 --- Funções de Preenchimento de Selects (Helpers de API) ---

async function preencherEmpresasSelect(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Selecione uma Empresa...</option>';
    try {
        const response = await fetch(`${API_URL}/empresas`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const empresas = await response.json();
        empresas.forEach(empresa => {
            select.add(new Option(empresa.Nome, empresa.Id_Empresa));
        });
    } catch (error) { console.error('Erro ao preencher empresas:', error); alert('Erro ao carregar empresas para seleção.'); }
}

/**
 * Preenche um campo <select> com todas as empresas e instituições cadastradas.
 * ESSENCIAL PARA A FUNCIONALIDADE DE ADICIONAR NOVOS CURSOS.
 */
async function preencherEntidadesSelect(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Selecione uma Empresa ou Instituição...</option>';
    try {
        const responseEmpresas = await fetch(`${API_URL}/empresas`);
        if (!responseEmpresas.ok) throw new Error(`HTTP error! status: ${responseEmpresas.status}`);
        const empresas = await responseEmpresas.json();
        empresas.forEach(empresa => {
            // AJUSTE: O rótulo "EMPRESA:" agora está em caixa alta.
            select.add(new Option(`EMPRESA: ${empresa.Nome}`, `empresa-${empresa.Id_Empresa}`));
        });
        const responseInstituicoes = await fetch(`${API_URL}/instituicoes`);
        if (!responseInstituicoes.ok) throw new Error(`HTTP error! status: ${responseInstituicoes.status}`);
        const instituicoes = await responseInstituicoes.json();
        instituicoes.forEach(instituicao => {
            // AJUSTE: O rótulo "INSTITUIÇÃO:" agora está em caixa alta.
            select.add(new Option(`INSTITUIÇÃO: ${instituicao.Nome}`, `instituicao-${instituicao.Id_Instituicao}`));
        });
    } catch (error) { console.error('Erro ao preencher entidades:', error); alert('Erro ao carregar entidades para seleção.'); }
}


// --- SEÇÃO 4: INICIALIZAÇÃO DA PÁGINA ---

/**
 * Observador de evento que garante que os dados das tabelas sejam carregados
 * assim que a página estiver pronta.
 */
document.addEventListener('DOMContentLoaded', () => {
    carregarEmpresas();
    carregarInstituicoes();
    carregarCursosEVagas();
});