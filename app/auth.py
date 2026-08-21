"""Validação dos usuários permitidos a entrar na interface."""
from __future__ import annotations

import hmac
import os


def _usuarios_configurados() -> dict[str, str]:
    """Lê as contas do .env sem expor senhas ao front-end."""
    usuarios: dict[str, str] = {}
    for indice in ("1", "2"):
        email = os.getenv(f"LOGIN_USER_{indice}_EMAIL", "").strip().lower()
        senha = os.getenv(f"LOGIN_USER_{indice}_PASSWORD", "")
        if email and senha:
            usuarios[email] = senha
    return usuarios


def credenciais_validas(email: str, senha: str) -> bool:
    senha_configurada = _usuarios_configurados().get(email.strip().lower())
    return senha_configurada is not None and hmac.compare_digest(senha_configurada, senha)
