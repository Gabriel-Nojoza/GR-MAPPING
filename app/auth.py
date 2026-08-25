"""Validação dos usuários permitidos a entrar na interface."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import secrets
import uuid

import jwt
from fastapi import Header, HTTPException

from app import db


_ITERACOES = 600_000


def _gerar_hash(senha: str) -> str:
    sal = secrets.token_bytes(16)
    derivada = hashlib.pbkdf2_hmac(
        "sha256",
        senha.encode(),
        sal,
        _ITERACOES,
    )
    return f"pbkdf2_sha256${_ITERACOES}${sal.hex()}${derivada.hex()}"


def _confere_hash(senha: str, armazenada: str) -> bool:
    try:
        algoritmo, iteracoes, sal_hex, hash_hex = armazenada.split("$", 3)

        if algoritmo != "pbkdf2_sha256":
            return False

        tentativa = hashlib.pbkdf2_hmac(
            "sha256",
            senha.encode(),
            bytes.fromhex(sal_hex),
            int(iteracoes),
        )
        return hmac.compare_digest(tentativa.hex(), hash_hex)

    except (ValueError, TypeError):
        return False


def _usuarios_configurados() -> dict[str, str]:
    usuarios: dict[str, str] = {}

    for indice in ("1", "2"):
        email = os.getenv(f"LOGIN_USER_{indice}_EMAIL", "").strip().lower()
        senha = os.getenv(f"LOGIN_USER_{indice}_PASSWORD", "")

        if email and senha:
            usuarios[email] = senha

    return usuarios


def garantir_usuarios_iniciais() -> None:
    for email, senha in _usuarios_configurados().items():
        db.criar_usuario_se_ausente(
            uuid.uuid4().hex,
            email,
            email.split("@", 1)[0],
            _gerar_hash(senha),
        )


def credenciais_validas(email: str, senha: str) -> bool:
    usuario = db.obter_usuario_por_email(email.strip().lower())

    return bool(
        usuario
        and usuario["ativo"]
        and _confere_hash(senha, usuario["senha_hash"])
    )


def autenticar(email: str, senha: str) -> dict | None:
    usuario = db.obter_usuario_por_email(email.strip().lower())

    if not usuario:
        return None

    if not usuario["ativo"]:
        return None

    if not _confere_hash(senha, usuario["senha_hash"]):
        return None

    empresa = db.obter_empresa(usuario["empresa_id"]) if usuario["empresa_id"] else None

    return {
        "id": usuario["id"],
        "nome": usuario["nome"],
        "email": usuario["email"],
        "perfil": usuario["perfil"],
        "empresa_id": usuario["empresa_id"],
        "empresa_nome": empresa["nome"] if empresa else None,
    }


def _chave_jwt() -> str:
    chave = os.getenv("JWT_SECRET", "").strip()

    if not chave:
        raise RuntimeError("JWT_SECRET não configurado no servidor.")

    return chave


def gerar_token(usuario: dict) -> str:
    agora = datetime.now(timezone.utc)

    dados = {
        "sub": usuario["id"],
        "email": usuario["email"],
        "perfil": usuario["perfil"],
        "empresa_id": usuario["empresa_id"],
        "iat": agora,
        "exp": agora + timedelta(hours=12),
    }

    return jwt.encode(dados, _chave_jwt(), algorithm="HS256")


def exigir_superadmin(
    authorization: str | None = Header(default=None),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Acesso não autenticado.",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        dados = jwt.decode(
            token,
            _chave_jwt(),
            algorithms=["HS256"],
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Sessão inválida ou expirada.",
        )

    if dados.get("perfil") != "superadmin":
        raise HTTPException(
            status_code=403,
            detail="Acesso restrito ao administrador master.",
        )

    return dados
