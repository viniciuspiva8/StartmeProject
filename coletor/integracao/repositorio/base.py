"""Interface de persistência do StartMe (Firestore em produção, memória nos testes).

As rotas nunca importam o Firestore direto. Todas as chaves são o hash pseudônimo do CPF,
e a auditoria nunca recebe CPF, nome ou e-mail.
"""

from abc import ABC, abstractmethod


class Repositorio(ABC):
    @abstractmethod
    def consentimento_ler(self, chave: str) -> dict | None: ...

    @abstractmethod
    def consentimento_gravar(self, chave: str, dados: dict) -> None: ...

    @abstractmethod
    def dados_apagar(self, chave: str, *, incluir_consentimento: bool) -> None:
        """Apaga currículo e marcações do aluno; o consentimento só sai com `incluir_consentimento`."""

    @abstractmethod
    def curriculo_ler(self, chave: str) -> dict | None: ...

    @abstractmethod
    def curriculo_gravar(self, chave: str, dados: dict) -> None: ...

    @abstractmethod
    def marcacoes_ler(self, chave: str) -> dict | None: ...

    @abstractmethod
    def marcacoes_gravar(self, chave: str, dados: dict) -> None: ...

    @abstractmethod
    def admin_ler(self, email: str) -> dict | None: ...

    @abstractmethod
    def admin_gravar(self, email: str, dados: dict) -> None: ...

    @abstractmethod
    def sistema_ler(self, chave: str) -> dict | None: ...

    @abstractmethod
    def sistema_gravar(self, chave: str, dados: dict) -> None: ...

    @abstractmethod
    def estatisticas(self, mes: str) -> dict:
        """vagas, cota_usadas, ultima_coleta, consentimentos_ativos, consentimentos_total."""

    @abstractmethod
    def auditoria_registrar(self, evento: dict) -> None: ...

    @abstractmethod
    def auditoria_listar(self, limite: int) -> list[dict]: ...
