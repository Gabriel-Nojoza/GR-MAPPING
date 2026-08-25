"""Vincula o acervo atual e os acessos iniciais à Imobiliária GN.

Execute uma única vez dentro do container da API:
    python -m app.migrar_imobiliaria_gn
"""
from __future__ import annotations

import uuid

from app import db


NOME_EMPRESA = "Imobiliária GN"
EMAILS_GN = (
    "gabriellnojoza@gmail.com",
    "ruangusmao@gmail.com",
)


def main() -> None:
    db.init_db()
    empresa = db.obter_empresa_por_nome(NOME_EMPRESA)
    if empresa is None:
        empresa_id = uuid.uuid4().hex
        db.criar_empresa(empresa_id, NOME_EMPRESA, None, "profissional")
    else:
        empresa_id = empresa["id"]

    vinculados = []
    for email in EMAILS_GN:
        if db.vincular_usuario_empresa(email, empresa_id):
            vinculados.append(email)

    db.migrar_registros_sem_empresa(empresa_id)
    print(f"{NOME_EMPRESA} configurada: {empresa_id}")
    print("Acessos vinculados: " + ", ".join(vinculados))
    print("Registros existentes associados à Imobiliária GN.")


if __name__ == "__main__":
    main()
