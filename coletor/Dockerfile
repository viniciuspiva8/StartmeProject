FROM python:3.13-slim

# Nao roda como root.
RUN useradd --create-home --uid 10001 startme
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# .dockerignore mantem credenciais.json e .env fora da imagem.
# A credencial e montada em tempo de execucao:
#   docker run --env-file .env -v $(pwd)/credenciais.json:/app/credenciais.json:ro ...
COPY --chown=startme:startme . .

USER startme
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/health')"

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
