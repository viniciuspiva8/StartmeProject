// Definimos a constante com o IP público da sua máquina virtual (D2s v3) na Azure
const API_URL = 'http://4.203.65.164:8000';

async function carregarVagas() {
    const tbody = document.querySelector('#tabelaVagas tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Procurando vagas recentes...</td></tr>';

    // SONDA DE DEBUG: Isso vai imprimir no painel F12 para onde o navegador está ligando
    console.log("StartMe Debug: Tentando buscar dados no endereço ->", `${API_URL}/api/vagas`);

    try {
        // O fetch realiza a comunicação real (A chamada para o motor na nuvem)
        const response = await fetch(`${API_URL}/api/vagas`);
        
        if (!response.ok) {
            throw new Error(`Erro na comunicação com o servidor: ${response.status}`);
        }
        
        const vagas = await response.json();
        tbody.innerHTML = ''; 

        if (vagas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma vaga encontrada no momento.</td></tr>';
            return;
        }

        vagas.forEach(vaga => {
            const linha = tbody.insertRow();
            linha.innerHTML = `
                <td>${vaga.id}</td>
                <td><strong>${vaga.titulo}</strong></td>
                <td>${vaga.empresa}</td>
                <td>${vaga.descricao || 'Sem descrição'}</td>
                <td>${vaga.salario ? 'R$ ' + vaga.salario : 'A combinar'}</td>
                <td class="text-center">
                    <a href="${vaga.link}" target="_blank" class="btn btn-sm btn-primary">Ver Vaga</a>
                </td>
            `;
        });

    } catch (error) {
        // Captura o erro e imprime no painel para análise
        console.error('StartMe Debug: Erro ao carregar as vagas:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger font-weight-bold">
                    Erro ao conectar com o servidor. Verifique o console (F12).
                </td>
            </tr>
        `;
    }
}

document.addEventListener('DOMContentLoaded', carregarVagas);