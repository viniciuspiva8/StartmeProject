"""Diagnóstico de adoção: `python -m integracao.cli doctor [--cpf CPF]`.

Mostra se a configuração fecha, qual modo e provedor estão ativos e, com --cpf, se a fonte acadêmica
responde para aquele aluno. Nunca imprime CPF, nome ou segredos: só o que a tela do aluno mostraria.
"""

import argparse
import os
import sys
import time

from integracao import cpf as cpf_mod
from integracao.autenticacao import construir as construir_autenticador
from integracao.config import Config
from integracao.provedores import construir as construir_provedor
from integracao.provedores.base import AcademicoIndisponivel


def _linha(ok: bool, texto: str) -> str:
    return f"[{'ok' if ok else 'falhou'}] {texto}"


def doctor(env, cpf_bruto: str | None) -> int:
    falhas = 0
    try:
        config = Config.do_ambiente(env)
    except ValueError as erro:
        print(_linha(False, f"configuração inválida: {erro}"))
        return 1
    print(_linha(True, f"configuração carregada (AUTH_MODE={config.auth_mode}, ACADEMICO_PROVIDER={config.provedor})"))
    print(_linha(config.sessao_ativa, "sessão ativa" if config.sessao_ativa else "sessão desativada: falta SESSAO_SEGREDO ou CPF_PEPPER"))
    try:
        provedor = construir_provedor(config)
        construir_autenticador(config)
        print(_linha(True, f"provedor acadêmico '{provedor.nome}' e autenticação montados"))
    except (ValueError, NotImplementedError) as erro:
        print(_linha(False, f"provedor ou autenticação: {erro}"))
        return 1

    if cpf_bruto:
        try:
            d = cpf_mod.normalizar(cpf_bruto)
        except cpf_mod.CpfInvalido:
            print(_linha(False, "o CPF informado não tem dígitos verificadores válidos"))
            return 1
        inicio = time.perf_counter()
        try:
            vinculo = provedor.vinculo(d)
        except AcademicoIndisponivel:
            print(_linha(False, "a fonte acadêmica não respondeu (veja o log do servidor)"))
            return 1
        ms = (time.perf_counter() - inicio) * 1000
        print(_linha(True, f"fonte acadêmica respondeu em {ms:.0f} ms"))
        if vinculo is None:
            print(_linha(False, "aluno sem vínculo nesta fonte"))
            falhas += 1
        else:
            print(_linha(vinculo.ativo, f"vínculo {'ativo' if vinculo.ativo else 'inativo'}: "
                                       f"curso '{vinculo.curso}', semestre {vinculo.semestre}"))
            falhas += 0 if vinculo.ativo else 1
    else:
        print("     (sem --cpf: não consulta nenhum aluno)")
    return 1 if falhas else 0


def main(argv=None, env=None) -> int:
    parser = argparse.ArgumentParser(prog="integracao.cli", description="Ferramentas da integração acadêmica.")
    sub = parser.add_subparsers(dest="comando", required=True)
    diag = sub.add_parser("doctor", help="verifica a configuração e, opcionalmente, um aluno")
    diag.add_argument("--cpf", help="CPF de um aluno de teste (não é guardado nem impresso)")
    args = parser.parse_args(argv)
    return doctor(env if env is not None else os.environ, args.cpf)


if __name__ == "__main__":
    sys.exit(main())
