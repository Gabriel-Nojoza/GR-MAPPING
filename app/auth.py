"""Validação dos usuários permitidos a entrar na interface."""
from __future__ import annotations

import hmac
import hashlib
import os
import secrets
import uuid

from app import db


_ITERACOES = 600_000


def _gerar_hash(senha: str) -> str:
    sal = secrets.token_bytes(16)
    derivada = hashlib.pbkdf2_hmac("sha256", senha.encode(), sal, _ITERACOES)
    return f"pbkdf2_sha256${_ITERACOES}${sal.hex()}${derivada.hex()}"


def _confere_hash(senha: str, armazenada: str) -> bool:
    try:
        algoritmo, iteracoes, sal_hex, hash_hex = armazenada.split("$", 3)
        if algoritmo != "pbkdf2_sha256":
            return False
        tentativa = hashlib.pbkdf2_hmac("sha256", senha.encode(), bytes.fromhex(sal_hex), int(iteracoes))
        return hmac.compare_digest(tentativa.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


def _usuarios_configurados() -> dict[str, str]:
    """Lê as contas do .env sem expor senhas ao front-end."""
    usuarios: dict[str, str] = {}
    for indice in ("1", "2"):
        email = os.getenv(f"LOGIN_USER_{indice}_EMAIL", "").strip().lower()
        senha = os.getenv(f"LOGIN_USER_{indice}_PASSWORD", "")
        if email and senha:
            usuarios[email] = senha
    return usuarios


def garantir_usuarios_iniciais() -> None:
    """Migra as contas existentes do .env para o banco apenas se ainda nÃ£o existirem."""
    for email, senha in _usuarios_configurados().items():
        db.criar_usuario_se_ausente(uuid.uuid4().hex, email, email.split("@", 1)[0], _gerar_hash(senha))


def credenciais_validas(email: str, senha: str) -> bool:
    usuario = db.obter_usuario_por_email(email.strip().lower())
    return bool(usuario and usuario["ativo"] and _confere_hash(senha, usuario["senha_hash"]))
