# 1. Definimos a imagem base. Vamos usar uma versão oficial e leve do Python 3.13.
# O "slim" significa que ela vem sem arquivos desnecessários, poupando a memória da nossa B1ms.
FROM python:3.13-slim

# 2. Definimos a pasta de trabalho dentro do contêiner onde nossos arquivos ficarão.
WORKDIR /app

# 3. Copiamos o arquivo de dependências do seu computador para dentro do contêiner.
COPY requirements.txt .

# 4. Instalamos as bibliotecas (FastAPI, Uvicorn, Pydantic) sem guardar o cache, 
# para manter o contêiner o mais leve possível.
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copiamos todo o resto do seu código (como o main.py) para dentro do contêiner.
COPY . .

# 6. Avisamos que a nossa API vai se comunicar através da porta 8000.
EXPOSE 8000

# 7. O comando final que o servidor vai executar quando for ligado.
# Em produção (na nuvem), tiramos o "--reload" porque ele consome recursos extras.
# O "--host 0.0.0.0" garante que a API aceite conexões de fora da máquina virtual.
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]