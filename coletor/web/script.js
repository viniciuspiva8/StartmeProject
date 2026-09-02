// Endereco da API definido em index.html (window.STARTME_API_URL).
const API_URL = (window.STARTME_API_URL || "http://localhost:8000").replace(/\/$/, "");

/** Escapa texto vindo da coleta antes de inserir no DOM. */
function esc(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

/** So aceita links http(s) — evita javascript: vindo de dado coletado. */
function linkSeguro(url) {
    try {
        const u = new URL(url, API_URL);
        return (u.protocol === "http:" || u.protocol === "https:") ? u.href : "#";
    } catch {
        return "#";
    }
}

function aviso(tbody, texto, classe = "") {
    tbody.innerHTML = "";
    const linha = tbody.insertRow();
    const celula = linha.insertCell();
    celula.colSpan = 5;
    celula.className = "text-center " + classe;
    celula.textContent = texto;
}

async function carregarVagas() {
    const tbody = document.querySelector("#tabelaVagas tbody");
    aviso(tbody, "Procurando vagas recentes...");

    try {
        const resposta = await fetch(`${API_URL}/api/vagas`);
        if (!resposta.ok) {
            throw new Error(`servidor respondeu ${resposta.status}`);
        }

        const vagas = await resposta.json();
        if (!vagas.length) {
            aviso(tbody, "Nenhuma vaga encontrada no momento.");
            return;
        }

        tbody.innerHTML = vagas.map((vaga) => `
            <tr>
                <td><strong>${esc(vaga.titulo)}</strong></td>
                <td>${esc(vaga.empresa)}</td>
                <td>${esc(vaga.descricao) || "Sem descricao"}</td>
                <td>${esc(vaga.salario) || "A combinar"}</td>
                <td class="text-center">
                    <a href="${esc(linkSeguro(vaga.link))}" target="_blank" rel="noopener noreferrer"
                       class="btn btn-sm btn-primary">Ver Vaga</a>
                </td>
            </tr>`).join("");
    } catch (erro) {
        console.error("StartMe: falha ao carregar as vagas:", erro);
        aviso(tbody, `Nao foi possivel conectar a API em ${API_URL}. Confira se o servico esta no ar.`,
              "text-danger font-weight-bold");
    }
}

document.addEventListener("DOMContentLoaded", carregarVagas);
