"""Interface de qualquer fonte acadêmica. Os provedores recebem CPF já normalizado (11 dígitos)."""

from abc import ABC, abstractmethod

from integracao.contrato import Vinculo


class AcademicoIndisponivel(Exception):
    """A fonte acadêmica não respondeu (rede, timeout, erro do servidor)."""


class ProvedorAcademico(ABC):
    nome: str = "base"

    @abstractmethod
    def vinculo(self, cpf_digitos: str) -> Vinculo | None:
        """Vínculo do aluno, ou None quando ele não existe na fonte. Erros de rede: AcademicoIndisponivel."""

    def saude(self) -> dict:
        return {"provedor": self.nome, "ok": True}
