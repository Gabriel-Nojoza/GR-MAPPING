"""Isola os testes num banco SQLite temporário — nunca escreve no dados.db
usado pelo servidor de desenvolvimento (que alimenta o Painel real)."""
import os
import tempfile

_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["MEDICAO_DB_PATH"] = _tmp_db.name
