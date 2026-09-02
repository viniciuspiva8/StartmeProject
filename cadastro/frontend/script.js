document.getElementById('tipoCadastro').addEventListener('change', function () {
  document.getElementById('formEmpresa').classList.add('hidden');
  document.getElementById('formInstituicao').classList.add('hidden');
  if (this.value === 'empresa') document.getElementById('formEmpresa').classList.remove('hidden');
  else if (this.value === 'instituicao') document.getElementById('formInstituicao').classList.remove('hidden');
});

document.getElementById('oferece').addEventListener('change', function () {
  document.getElementById('campoVaga').classList.add('hidden');
  document.getElementById('campoCurso').classList.add('hidden');
  if (this.value === 'vaga') document.getElementById('campoVaga').classList.remove('hidden');
  else if (this.value === 'curso') document.getElementById('campoCurso').classList.remove('hidden');
  else if (this.value === 'ambos') {
    document.getElementById('campoVaga').classList.remove('hidden');
    document.getElementById('campoCurso').classList.remove('hidden');
  }
});

function adicionarVaga() {
  const container = document.getElementById('vagasContainer');
  const div = document.createElement('div');
  div.innerHTML = `
    <input placeholder="Título da Vaga">
    <input placeholder="Descrição da Vaga">
    <input placeholder="Salário"><br>
  `;
  container.appendChild(div);
}

function adicionarCurso() {
  const container = document.getElementById('cursosContainer');
  const div = document.createElement('div');
  div.innerHTML = '<input placeholder="Descrição do Curso"> <input placeholder="Carga Horária"> <input placeholder="Qtd. Semestres"><br>';
  container.appendChild(div);
}

function salvar() {
  const tipo = document.getElementById('tipoCadastro').value;
  const oferece = document.getElementById('oferece').value;

  let nome = '', cnpj = '', telefone = '', email = '', endereco = '', area = '';
  let tipoInstituicao = '', pais = '', estado = '', cidade = '';

  if (tipo === 'empresa') {
    nome = document.getElementById('nomeEmpresa').value;
    cnpj = document.getElementById('cnpjEmpresa').value;
    telefone = document.getElementById('telefoneEmpresa').value;
    email = document.getElementById('emailEmpresa').value;
    endereco = document.getElementById('enderecoEmpresa').value;
    area = document.getElementById('areaEmpresa').value;
  } else {
    nome = document.getElementById('nomeInstituicao').value;
    cnpj = document.getElementById('cnpjInstituicao').value;
    telefone = document.getElementById('telefoneInstituicao').value;
    email = document.getElementById('emailInstituicao').value;

    tipoInstituicao = document.getElementById('tipoInstituicao').value;
    area = document.getElementById('areaInstituicao').value;
    pais = document.getElementById('paisInstituicao').value;
    estado = document.getElementById('estadoInstituicao').value;
    cidade = document.getElementById('cidadeInstituicao').value;
    endereco = document.getElementById('enderecoInstituicao').value;
  }

  const tabelaEnt = document.getElementById('tabelaEntidades').getElementsByTagName('tbody')[0];
  const linhaEnt = tabelaEnt.insertRow();

  if (tipo === 'empresa') {
    linhaEnt.innerHTML = `
      <td>${tipo}</td>
      <td>${nome}</td>
      <td>${cnpj}</td>
      <td>${telefone}</td>
      <td>${email}</td>
      <td>${endereco}</td>
      <td>${area}</td>
      <td><button onclick="editar(this)">Editar</button> <button onclick="excluir(this)">Excluir</button></td>
    `;
  } else {
    linhaEnt.innerHTML = `
      <td>${tipo}</td>
      <td>${nome}</td>
      <td>${cnpj}</td>
      <td>${telefone}</td>
      <td>${email}</td>
      <td>${endereco}, ${cidade}, ${estado}, ${pais}</td>
      <td>${tipoInstituicao} - ${area}</td>
      <td><button onclick="editar(this)">Editar</button> <button onclick="excluir(this)">Excluir</button></td>
    `;
  }

  const tabelaCV = document.getElementById('tabelaCursosVagas').getElementsByTagName('tbody')[0];

  if (oferece === 'vaga' || oferece === 'ambos') {
    const vagas = document.getElementById('vagasContainer').querySelectorAll('div');
    vagas.forEach(div => {
      const inputs = div.querySelectorAll('input');
      const titulo = inputs[0].value;
      const descricao = inputs[1].value;  // nova captura do campo descrição
      const salario = inputs[2].value;
      const linha = tabelaCV.insertRow();
      linha.innerHTML = `
        <td>${nome}</td>
        <td>Vaga</td>
        <td>${titulo}</td>
        <td>Descrição: ${descricao} | Salário: ${salario}</td>
        <td><button onclick="editar(this)">Editar</button> <button onclick="excluir(this)">Excluir</button></td>
      `;
    });
  }

  if (oferece === 'curso' || oferece === 'ambos') {
    const cursos = document.getElementById('cursosContainer').querySelectorAll('div');
    cursos.forEach(div => {
      const inputs = div.querySelectorAll('input');
      const desc = inputs[0].value;
      const carga = inputs[1].value;
      const semestres = inputs[2].value;
      const linha = tabelaCV.insertRow();
      linha.innerHTML = `
        <td>${nome}</td>
        <td>Curso</td>
        <td>${desc}</td>
        <td>Carga Horária: ${carga}, Semestres: ${semestres}</td>
        <td><button onclick="editar(this)">Editar</button> <button onclick="excluir(this)">Excluir</button></td>
      `;
    });
  }

  // Limpa os inputs
  document.querySelectorAll('input').forEach(input => input.value = '');
  document.querySelectorAll('select').forEach(select => select.value = '');
  document.getElementById('vagasContainer').innerHTML = '';
  document.getElementById('cursosContainer').innerHTML = '';
}

function excluir(btn) {
  btn.parentNode.parentNode.remove();
}

function editar(btn) {
  alert("Edição ainda não implementada.");
}
