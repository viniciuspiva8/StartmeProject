"""Teste de conexao com o Firestore (real ou emulador).

Grava, le e apaga um documento temporario na colecao `_smoke_test` e confere que a colecao
de vagas e acessivel. Nao altera nenhuma vaga. Nunca imprime credenciais.

    cd coletor
    python scripts/testar_firestore.py

Destino:
  * FIRESTORE_EMULATOR_HOST definido  -> emulador (nada vai para o Firebase real)
  * senao                             -> Firestore REAL, usando GOOGLE_APPLICATION_CREDENTIALS
                                         (padrao ./credenciais.json)

Codigo de saida: 0 = tudo certo, 1 = falhou (a mensagem diz onde).
"""
import os
import sys
import time
import uuid
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))


def carregar_env(caminho: Path) -> None:
    """Le o .env sem dependencia extra. Variavel ja definida no ambiente tem prioridade."""
    if not caminho.exists():
        return
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        if valor.strip():
            os.environ.setdefault(chave.strip(), valor.strip())


def main() -> int:
    carregar_env(RAIZ / ".env")
    os.chdir(RAIZ)  # o caminho padrao da credencial e relativo a pasta do coletor

    import main as app  # noqa: E402 - depois do .env, pois o modulo le variaveis na importacao

    emulador = os.getenv("FIRESTORE_EMULATOR_HOST")
    if not emulador and not os.path.exists(app.CRED_PATH):
        print(f"FALHOU: sem emulador e sem credencial em '{app.CRED_PATH}'.")
        print("  Baixe a chave da conta de servico no console do Firebase e salve como credenciais.json.")
        return 1

    try:
        db = app.get_db()
    except Exception as erro:  # credencial invalida, JSON corrompido etc.
        print(f"FALHOU ao criar o cliente do Firestore: {type(erro).__name__}")
        return 1

    destino = f"EMULADOR em {emulador}" if emulador else "Firestore REAL"
    print(f"Destino: {destino} | projeto: {getattr(db, 'project', '?')}")

    ref = db.collection("_smoke_test").document(uuid.uuid4().hex)
    try:
        inicio = time.perf_counter()
        ref.set({"escrito_em": time.time(), "origem": "scripts/testar_firestore.py"})
        escrita = time.perf_counter() - inicio

        inicio = time.perf_counter()
        snap = ref.get()
        leitura = time.perf_counter() - inicio
        if not snap.exists:
            print("FALHOU: o documento gravado nao foi encontrado na leitura.")
            return 1

        ref.delete()
        if ref.get().exists:
            print("FALHOU: o documento temporario nao foi apagado.")
            return 1

        # a colecao de vagas precisa ser consultavel (so uma leitura, sem alterar nada)
        amostra = list(db.collection(app.COLECAO).limit(1).stream())
    except Exception as erro:
        # A mensagem de excecao do Google pode ser longa; so o tipo e a primeira linha.
        primeira = str(erro).splitlines()[0][:160] if str(erro) else ""
        print(f"FALHOU: {type(erro).__name__}: {primeira}")
        print("  Causas comuns: Firestore nao ativado no projeto, conta de servico sem o papel")
        print("  'Cloud Datastore User', projeto errado na chave ou sem acesso a rede.")
        return 1

    print(f"OK: escrita {escrita * 1000:.0f} ms | leitura {leitura * 1000:.0f} ms | apagou o documento de teste")
    print(f"OK: colecao '{app.COLECAO}' acessivel ({'com' if amostra else 'sem'} vagas por enquanto)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
