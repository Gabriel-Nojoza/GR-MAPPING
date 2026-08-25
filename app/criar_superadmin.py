"""Cria ou redefine uma conta superadmin de forma interativa na VPS.

Uso dentro do container da API:
    python -m app.criar_superadmin
"""
from __future__ import annotations

from getpass import getpass
import uuid

from app import db
from app.auth import _gerar_hash


def main() -> None:
    print("Criar ou atualizar administrador master")
    email = input("E-mail do administrador: ").strip().lower()
    nome = input("Nome: ").strip()
    senha = getpass("Senha: ")
    confirmar = getpass("Confirme a senha: ")

    if not email or "@" not in email:
        raise SystemExit("Informe um e-mail válido.")
    if len(senha) < 8:
        raise SystemExit("A senha precisa ter pelo menos 8 caracteres.")
    if senha != confirmar:
        raise SystemExit("As senhas não são iguais.")

    db.init_db()
    db.criar_ou_atualizar_usuario(
        id_=uuid.uuid4().hex,
        email=email,
        nome=nome or email.split("@", 1)[0],
        senha_hash=_gerar_hash(senha),
        perfil="superadmin",
    )
    print(f"Administrador {email} salvo com sucesso.")


if __name__ == "__main__":
    main()
