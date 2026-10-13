"""Integração acadêmica do StartMe (ADR-002): autenticação, vínculo e dados do aluno.

Nada daqui guarda CPF em claro. O CPF entra, vira um hash (HMAC com pepper) e só o hash
chega ao banco e ao token de sessão.
"""
