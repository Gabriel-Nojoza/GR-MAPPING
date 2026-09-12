"""Isola os testes num banco SQLite temporário — nunca escreve no dados.db
usado pelo servidor de desenvolvimento (que alimenta o Painel real), nem no
banco de produção.

IMPORTANTE: precisa limpar DATABASE_URL ANTES de qualquer import de app.main
ou app.db. Se a máquina tiver um .env com DATABASE_URL (Supabase de produção),
`load_dotenv()` (chamado dentro de app/main.py) só define uma variável de
ambiente se ela ainda não existir — então, se a gente não "reservar" a chave
aqui primeiro (mesmo que vazia), o .env preenche DATABASE_URL de verdade e
os testes acabam lendo/gravando no banco de produção (aconteceu uma vez:
rodar os testes localmente criou registros de teste no Supabase real)."""
import os
import tempfile

os.environ["DATABASE_URL"] = ""
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["MEDICAO_DB_PATH"] = _tmp_db.name
