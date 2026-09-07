# main.py
import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import datetime
from datetime import timedelta
import requests
from bs4 import BeautifulSoup

# --- CONFIGURAÇÃO DO FIREBASE ---
# 1. Carrega o "crachá" de acesso (arquivo JSON baixado do Firebase)
cred = credentials.Certificate("credenciais.json")

# 2. Inicializa o aplicativo conectando com os servidores do Google
firebase_admin.initialize_app(cred)

# 3. Cria a variável 'db' que representa o nosso banco de dados Firestore
db = firestore.client()
# --------------------------------

app = FastAPI(title="StartMe MVP API")

# Configuração de CORS (Permite que o LiveServer acesse a API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

# Definimos o formato da Vaga (Pydantic valida se os dados estão corretos)
class Vaga(BaseModel):
    # Removi o 'id' numérico, pois o Firestore cria IDs automáticos (hashes) para os documentos
    titulo: str
    empresa: str
    link: str
    data_coleta: str
    descricao: str = ""
    salario: str = ""

@app.get("/")
def ler_raiz():
    """Rota de verificação de status."""
    return {"mensagem": "API do StartMe está conectada ao Firebase!"}

@app.get("/api/vagas")
def listar_vagas():
    """
    Vai até a nuvem do Google, lê a coleção 'vagas' e devolve a lista completa.
    """
    # Aponta para a coleção 'vagas' no Firestore
    vagas_ref = db.collection('vagas')
    
    # Faz o download de todos os documentos que estão lá dentro
    docs = vagas_ref.stream()

    lista_de_vagas = []
    for doc in docs:
        vaga_dict = doc.to_dict()
        # É uma boa prática devolver também o ID real que o Firebase gerou
        vaga_dict['id'] = doc.id 
        lista_de_vagas.append(vaga_dict)

    return lista_de_vagas

@app.post("/api/iniciar-scraping")
def iniciar_scraping():
    """
    Acessa a Cia de Estágios, extrai do 'vagas__slider' com precisão cirúrgica.
    Inclui o motor de limpeza nativo (TTL) e ignora vagas já expiradas no site.
    """
    url_alvo = "https://www.ciadeestagios.com.br/vagas-de-estagio/"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
    }

    try:
        # --- PASSO 1: A FAXINA AUTOMÁTICA (Nosso TTL) ---
        print("Iniciando limpeza de vagas expiradas no banco...")
        agora = datetime.datetime.now()
        
        vagas_vencidas = db.collection('vagas').where('data_expiracao', '<', agora).stream()
        
        vagas_apagadas = 0
        for doc in vagas_vencidas:
            doc.reference.delete()
            vagas_apagadas += 1
            
        print(f"Faxina concluída: {vagas_apagadas} vagas antigas foram apagadas.")
        # ------------------------------------------------

        # --- PASSO 2: O SCRAPING DE ALTA PRECISÃO ---
        print(f"Iniciando requisição para: {url_alvo}")
        resposta = requests.get(url_alvo, headers=headers)
        
        if resposta.status_code != 200:
            return {"erro": f"Site bloqueou a requisição. Status: {resposta.status_code}"}

        soup = BeautifulSoup(resposta.text, 'html.parser')
        
        vagas_novas_salvas = 0
        vagas_antigas_renovadas = 0
        
        # 1. Encontramos o carrossel com os DOIS underlines corretos!
        slider = soup.find('div', class_='vagas__slider')
        
        if not slider:
             return {"erro": "A div 'vagas__slider' não foi encontrada. O site pode ter mudado a estrutura."}

        # 2. Buscamos todos os artigos que são cards de vagas
        lista_cards = slider.find_all('article', class_='vagas__card')
        print(f"O robô encontrou {len(lista_cards)} cards de vagas no HTML.")

        data_validade = datetime.datetime.now() + timedelta(days=30)

        for card in lista_cards:
            # Pulo Inteligente: Se o card tem a classe '--expired', a vaga já fechou. Ignoramos!
            classes_do_card = card.get('class', [])
            if '--expired' in classes_do_card:
                continue

            # Extrai o link
            tag_a = card.find('a', class_='vagas__card__link')
            link_parcial = tag_a.get('href') if tag_a else None
            
            if not link_parcial:
                continue 
                
            link_completo = link_parcial if link_parcial.startswith('http') else f"https://www.ciadeestagios.com.br{link_parcial}"

            # Extrai o Título
            tag_h2 = card.find('h2', class_='headline--xs')
            titulo = tag_h2.text.strip() if tag_h2 else "Programa de Estágio"

            # Extrai a Empresa do 'alt' da imagem da logo (Ex: 'Logo Programa de Estágio IFF 2026')
            tag_img = card.find('img', class_='vagas__card__brand__image')
            empresa_raw = tag_img.get('alt', 'Companhia de Estágios') if tag_img else "Companhia de Estágios"
            # Uma pequena limpeza para tirar a palavra "Logo " do começo, se existir
            empresa = empresa_raw.replace("Logo ", "")

            # --- PREVENÇÃO E RENOVAÇÃO DE DUPLICATAS ---
            vagas_existentes = db.collection('vagas').where('link', '==', link_completo).get()
            
            if len(vagas_existentes) > 0:
                doc_id = vagas_existentes[0].id
                db.collection('vagas').document(doc_id).update({
                    'data_expiracao': data_validade, 
                    'data_ultima_verificacao': str(datetime.date.today())
                })
                vagas_antigas_renovadas += 1
                continue 

            # Salvando a vaga inédita
            nova_vaga = {
                "titulo": titulo,
                "empresa": empresa,
                "link": link_completo,
                "data_coleta": str(datetime.date.today()),
                "data_ultima_verificacao": str(datetime.date.today()),
                "data_expiracao": data_validade,
                "descricao": "Vaga mapeada diretamente do portal da Companhia de Estágios.",
                "salario": "A combinar"
            }
            
            db.collection('vagas').add(nova_vaga)
            vagas_novas_salvas += 1

        return {
            "mensagem": "Operação finalizada com sucesso!", 
            "vagas_antigas_apagadas": vagas_apagadas,
            "vagas_novas_salvas": vagas_novas_salvas,
            "vagas_antigas_renovadas": vagas_antigas_renovadas
        }

    except Exception as e:
        return {"erro": f"Falha ao executar a operação: {str(e)}"}