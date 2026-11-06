"""
StartMe - Extração de requisitos (skills/tecnologias) das descrições de vagas.

Identifica tecnologias, linguagens, frameworks e habilidades mencionadas na
descrição e título da vaga, normalizando-as para o formato esperado pelo
frontend (criterios com tipo, texto, termo).

Usa regex e listas de palavras-chave (sem dependências pesadas como NLP).
"""
import re
from typing import List, Dict, Any

# Mapa de skills: termo normalizado → variações, categoria
SKILLS = {
    # Linguagens
    'Python': {'palavras': ['python', 'py'], 'tipo': 'linguagem'},
    'JavaScript': {'palavras': ['javascript', 'js', 'typescript', 'ts'], 'tipo': 'linguagem'},
    'Java': {'palavras': ['java'], 'tipo': 'linguagem'},
    'C++': {'palavras': ['c\\+\\+', 'cpp'], 'tipo': 'linguagem'},
    'C#': {'palavras': ['c#', 'csharp'], 'tipo': 'linguagem'},
    'Go': {'palavras': ['golang', 'go'], 'tipo': 'linguagem'},
    'Rust': {'palavras': ['rust'], 'tipo': 'linguagem'},
    'PHP': {'palavras': ['php'], 'tipo': 'linguagem'},
    'Ruby': {'palavras': ['ruby'], 'tipo': 'linguagem'},
    'SQL': {'palavras': ['sql', 'postgresql', 'mysql', 'oracle', 'sqlite'], 'tipo': 'linguagem'},

    # Frameworks Web (Python)
    'Django': {'palavras': ['django'], 'tipo': 'framework'},
    'FastAPI': {'palavras': ['fastapi', 'fast api'], 'tipo': 'framework'},
    'Flask': {'palavras': ['flask'], 'tipo': 'framework'},

    # Frameworks Web (JavaScript)
    'React': {'palavras': ['react', 'reactjs'], 'tipo': 'framework'},
    'Vue': {'palavras': ['vue', 'vuejs'], 'tipo': 'framework'},
    'Angular': {'palavras': ['angular'], 'tipo': 'framework'},
    'Node.js': {'palavras': ['node', 'nodejs', 'node\\.js'], 'tipo': 'framework'},
    'Express': {'palavras': ['express'], 'tipo': 'framework'},

    # Databases
    'Firebase': {'palavras': ['firebase', 'firestore', 'realtime database'], 'tipo': 'banco'},
    'MongoDB': {'palavras': ['mongodb', 'mongo'], 'tipo': 'banco'},
    'PostgreSQL': {'palavras': ['postgresql', 'postgres', 'psql'], 'tipo': 'banco'},
    'MySQL': {'palavras': ['mysql'], 'tipo': 'banco'},
    'Redis': {'palavras': ['redis'], 'tipo': 'banco'},

    # Cloud
    'AWS': {'palavras': ['aws', 'amazon web services', 'ec2', 's3', 'lambda'], 'tipo': 'cloud'},
    'Google Cloud': {'palavras': ['google cloud', 'gcp', 'cloud run', 'cloud storage'], 'tipo': 'cloud'},
    'Azure': {'palavras': ['azure', 'microsoft azure'], 'tipo': 'cloud'},
    'Docker': {'palavras': ['docker'], 'tipo': 'devops'},
    'Kubernetes': {'palavras': ['kubernetes', 'k8s'], 'tipo': 'devops'},

    # Frontend
    'HTML': {'palavras': ['html'], 'tipo': 'frontend'},
    'CSS': {'palavras': ['css', 'tailwind', 'bootstrap'], 'tipo': 'frontend'},
    'REST API': {'palavras': ['rest api', 'rest', 'api rest'], 'tipo': 'conceito'},

    # DevOps / CI-CD
    'Git': {'palavras': ['git', 'github', 'gitlab', 'gitflow'], 'tipo': 'devops'},
    'Linux': {'palavras': ['linux'], 'tipo': 'so'},

    # Conceitos
    'Agile': {'palavras': ['agile', 'scrum', 'kanban'], 'tipo': 'conceito'},
    'TDD': {'palavras': ['tdd', 'test driven development'], 'tipo': 'conceito'},
    'Responsivo': {'palavras': ['responsivo', 'mobile first'], 'tipo': 'conceito'},
}


def extrair_requisitos(titulo: str, descricao: str, limite: int = 15) -> List[Dict[str, Any]]:
    """
    Extrai skills mencionados no título e descrição.

    Args:
        titulo: Título da vaga
        descricao: Descrição completa da vaga
        limite: Máximo de requisitos a extrair

    Returns:
        Lista de dicts com {'tipo': 'requisito', 'texto': skill, 'termo': skill normalizado}
    """
    if not titulo or not descricao:
        return []

    # Combina e normaliza
    texto_completo = (titulo + ' ' + descricao).lower()
    # Remove pontuação, mantém espaço
    texto_normalizado = re.sub(r'[^\w\s+#.]', ' ', texto_completo)

    encontrados = set()  # Evita duplicatas

    for skill, info in SKILLS.items():
        for palavra_chave in info['palavras']:
            # Regex com word boundaries para não pegar "pyt" de "python"
            padrao = rf'\b{palavra_chave}\b'
            if re.search(padrao, texto_normalizado):
                encontrados.add(skill)
                break  # Já encontrou este skill, passa para o próximo

    # Converte para lista de criterios do frontend
    requisitos = [
        {
            'tipo': 'requisito',
            'texto': skill,
            'termo': skill,
        }
        for skill in sorted(encontrados)[:limite]
    ]

    return requisitos


def enriquecer_vaga_com_requisitos(vaga_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Adiciona campo 'requisitos' à vaga se não existir.

    Args:
        vaga_dict: Documento da vaga do Firestore

    Returns:
        Mesmo dicionário com 'requisitos' adicionado (ou preservado se já existia)
    """
    if 'requisitos' not in vaga_dict or not vaga_dict['requisitos']:
        titulo = vaga_dict.get('titulo', '')
        descricao = vaga_dict.get('descricao', '')
        vaga_dict['requisitos'] = extrair_requisitos(titulo, descricao)

    return vaga_dict
