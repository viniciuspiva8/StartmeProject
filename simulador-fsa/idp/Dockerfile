FROM python:3.13-slim

RUN useradd --create-home --uid 10001 fsa
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=fsa:fsa . .
USER fsa
EXPOSE 8102
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8102"]
