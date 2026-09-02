"""
Persistência simples em SQLite — histórico de terrenos medidos e de jobs de
geração de projeto, pra alimentar o Painel com dados reais.

Um arquivo .db local é suficiente pra uma API de instância única (mesmo
raciocínio do job store em memória, ver app/jobs.py). Se um dia rodar com
mais de um worker, troque por um banco compartilhado antes de escalar.
"""
from __future__ import annotations

import os
import sqlite3
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import psycopg
    from psycopg_pool import ConnectionPool
    from psycopg.rows import dict_row
except ImportError:  # permite rodar a versÃ£o SQLite antes da primeira instalaÃ§Ã£o
    psycopg = None
    ConnectionPool = None
    dict_row = None

DB_PATH = Path(os.environ.get("MEDICAO_DB_PATH")
                or Path(__file__).resolve().parent.parent / "dados.db")
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
_POOL_POSTGRES = None


def _url_postgres() -> str:
    """Garante SSL para a conexÃ£o externa do Supabase sem registrar a senha."""
    if "sslmode=" in DATABASE_URL:
        return DATABASE_URL
    return f"{DATABASE_URL}{'&' if '?' in DATABASE_URL else '?'}sslmode=require"


class ConexaoPostgres:
    """Adaptador pequeno: mantÃ©m as consultas legadas SQLite compatÃ­veis com Postgres."""
    def __init__(self):
        if psycopg is None or ConnectionPool is None:
            raise RuntimeError("Driver PostgreSQL nÃ£o instalado. RefaÃ§a o build do container.")
        self.conn = None
        self._contexto = None

    @staticmethod
    def _pool():
        global _POOL_POSTGRES
        if _POOL_POSTGRES is None:
            _POOL_POSTGRES = ConnectionPool(
                conninfo=_url_postgres(),
                kwargs={"row_factory": dict_row},
                min_size=1,
                max_size=5,
                open=True,
            )
        return _POOL_POSTGRES

    def execute(self, sql: str, parametros=()):
        if self.conn is None:
            raise RuntimeError("Conexão com o banco não foi aberta.")
        sql = sql.replace("?", "%s").replace(" COLLATE NOCASE", "")
        return self.conn.execute(sql, parametros)

    def __enter__(self):
        self._contexto = self._pool().connection()
        self.conn = self._contexto.__enter__()
        return self

    def __exit__(self, *args):
        return self._contexto.__exit__(*args)

_STATUS_ROTULO = {
    "processando": "Vídeo em processamento",
    "pronto": "Vídeo gerado",
    "erro": "Falha ao gerar vídeo",
}


def _conectar() -> sqlite3.Connection | ConexaoPostgres:
    if DATABASE_URL:
        return ConexaoPostgres()
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _valor_coluna(linha, nome: str, indice: int = 0):
    """Lê uma coluna tanto de sqlite.Row quanto do dict retornado pelo Postgres."""
    try:
        return linha[nome]
    except (KeyError, IndexError):
        return linha[indice]


def init_db() -> None:
    with _conectar() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS terrenos (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                nome_foto TEXT,
                area_m2 REAL NOT NULL,
                area_ha REAL NOT NULL,
                perimetro_m REAL NOT NULL,
                gsd_cm_por_px REAL NOT NULL,
                pontos_json TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                atualizado_em TEXT NOT NULL,
                status TEXT NOT NULL,
                descricao TEXT,
                erro TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                tipo TEXT NOT NULL,
                descricao TEXT NOT NULL,
                categoria TEXT NOT NULL,
                valor_centavos INTEGER NOT NULL,
                vencimento TEXT NOT NULL,
                status TEXT NOT NULL,
                pago_em TEXT,
                observacao TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS clientes (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
            nome TEXT NOT NULL,
            contato TEXT,
            email TEXT,
            whatsapp_cobranca_ativo INTEGER NOT NULL DEFAULT 0,
            dados_json TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS empresas (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                nome TEXT NOT NULL,
                cnpj TEXT,
                plano TEXT NOT NULL DEFAULT 'teste',
                status TEXT NOT NULL DEFAULT 'ativo',
                ramo TEXT NOT NULL DEFAULT 'imobiliaria'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                nome TEXT,
                senha_hash TEXT NOT NULL,
                ativo INTEGER NOT NULL DEFAULT 1,
                perfil TEXT NOT NULL DEFAULT 'imobiliaria',
                empresa_id TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS documentos (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                titulo TEXT NOT NULL,
                categoria TEXT NOT NULL,
                nome_arquivo TEXT NOT NULL,
                mime TEXT,
                tamanho_bytes INTEGER NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS imoveis (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                titulo TEXT NOT NULL,
                tipo TEXT NOT NULL,
                endereco TEXT,
                descricao TEXT,
                valor_aluguel_centavos INTEGER NOT NULL,
                taxa_condominio_centavos INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'disponivel',
                cliente_id TEXT,
                dia_vencimento INTEGER,
                foto_nome TEXT,
                foto_mime TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS cobrancas_aluguel (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                imovel_id TEXT NOT NULL,
                cliente_id TEXT NOT NULL,
                competencia TEXT NOT NULL,
                vencimento TEXT NOT NULL,
                valor_centavos INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pendente',
                pago_em TEXT,
                lembrete_enviado_em TEXT,
                FOREIGN KEY(imovel_id) REFERENCES imoveis(id),
                FOREIGN KEY(cliente_id) REFERENCES clientes(id),
                UNIQUE(imovel_id, competencia)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS cobranca_lembretes (
                id TEXT PRIMARY KEY,
                cobranca_id TEXT NOT NULL,
                tipo TEXT NOT NULL,
                enviado_em TEXT NOT NULL,
                UNIQUE(cobranca_id, tipo),
                FOREIGN KEY(cobranca_id) REFERENCES cobrancas_aluguel(id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS recursos_eng (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                empresa_id TEXT,
                tipo TEXT NOT NULL,
                nome TEXT NOT NULL,
                dados_json TEXT,
                foto_nome TEXT,
                foto_mime TEXT
            )
        """)
        # ---- monitoramento de produtividade por voo de drone (ramo engenharia) ----
        conn.execute("""
            CREATE TABLE IF NOT EXISTS eng_frentes (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                empresa_id TEXT,
                obra_id TEXT NOT NULL,
                nome TEXT NOT NULL,
                geojson TEXT,
                extensao_prevista_m REAL NOT NULL DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS eng_voos (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                empresa_id TEXT,
                obra_id TEXT NOT NULL,
                data TEXT NOT NULL,
                turno TEXT NOT NULL,
                observacao TEXT,
                operador_id TEXT,
                criado_por TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS eng_voo_fotos (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                voo_id TEXT NOT NULL,
                nome_arquivo TEXT NOT NULL,
                mime TEXT,
                gps_lat REAL,
                gps_lon REAL,
                altitude_m REAL,
                tirada_em TEXT,
                tem_qr INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS eng_deteccoes (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                voo_id TEXT NOT NULL,
                foto_id TEXT,
                maquina_id TEXT NOT NULL,
                frente_id TEXT,
                lat REAL,
                lon REAL,
                progressiva_m REAL,
                metodo TEXT NOT NULL DEFAULT 'manual',
                status_maquina TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS eng_consumo (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                empresa_id TEXT,
                obra_id TEXT NOT NULL,
                data TEXT NOT NULL,
                turno TEXT NOT NULL,
                maquina_id TEXT NOT NULL,
                horas REAL NOT NULL DEFAULT 0,
                custo_hora_centavos INTEGER NOT NULL DEFAULT 0,
                UNIQUE(obra_id, data, turno, maquina_id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS modelos_mensagem_leads (
                id TEXT PRIMARY KEY,
                criado_em TEXT NOT NULL,
                titulo TEXT NOT NULL,
                conteudo TEXT NOT NULL
            )
        """)
        # migração leve: adiciona a coluna "nome" se o banco já existia sem ela
        if DATABASE_URL:
            colunas = {r["column_name"] for r in conn.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = %s", ("terrenos",)
            )}
        else:
            colunas = {r["name"] for r in conn.execute("PRAGMA table_info(terrenos)")}
        if "nome" not in colunas:
            conn.execute("ALTER TABLE terrenos ADD COLUMN nome TEXT")
        if "pontos_json" not in colunas:
            conn.execute("ALTER TABLE terrenos ADD COLUMN pontos_json TEXT")

        if DATABASE_URL:
            colunas_clientes = {r["column_name"] for r in conn.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = %s", ("clientes",)
            )}
        else:
            colunas_clientes = {r["name"] for r in conn.execute("PRAGMA table_info(clientes)")}
        if "whatsapp_cobranca_ativo" not in colunas_clientes:
            conn.execute("ALTER TABLE clientes ADD COLUMN whatsapp_cobranca_ativo INTEGER NOT NULL DEFAULT 0")
        if "dados_json" not in colunas_clientes:
            conn.execute("ALTER TABLE clientes ADD COLUMN dados_json TEXT")

        # migração leve: ramo de atuação da empresa (imobiliaria, engenharia, ...)
        if DATABASE_URL:
            colunas_empresas = {r["column_name"] for r in conn.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = %s", ("empresas",)
            )}
        else:
            colunas_empresas = {r["name"] for r in conn.execute("PRAGMA table_info(empresas)")}
        if "ramo" not in colunas_empresas:
            conn.execute("ALTER TABLE empresas ADD COLUMN ramo TEXT NOT NULL DEFAULT 'imobiliaria'")

        # migração leve: operador do voo (quem pilotou o drone)
        if DATABASE_URL:
            colunas_voos = {r["column_name"] for r in conn.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = %s", ("eng_voos",)
            )}
        else:
            colunas_voos = {r["name"] for r in conn.execute("PRAGMA table_info(eng_voos)")}
        if colunas_voos and "operador_id" not in colunas_voos:
            conn.execute("ALTER TABLE eng_voos ADD COLUMN operador_id TEXT")
        if colunas_voos and "criado_por" not in colunas_voos:
            conn.execute("ALTER TABLE eng_voos ADD COLUMN criado_por TEXT")

        if DATABASE_URL:
            colunas_usuarios = {r["column_name"] for r in conn.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = %s", ("usuarios",)
            )}
        else:
            colunas_usuarios = {r["name"] for r in conn.execute("PRAGMA table_info(usuarios)")}
        if "perfil" not in colunas_usuarios:
            conn.execute("ALTER TABLE usuarios ADD COLUMN perfil TEXT NOT NULL DEFAULT 'imobiliaria'")
        if "empresa_id" not in colunas_usuarios:
            conn.execute("ALTER TABLE usuarios ADD COLUMN empresa_id TEXT")

        # Todas as informações operacionais pertencem a uma imobiliária.
        # As colunas são adicionadas sem apagar os registros já existentes.
        tabelas_com_empresa = (
            "terrenos", "jobs", "lancamentos_financeiros", "clientes",
            "documentos", "imoveis", "cobrancas_aluguel",
        )
        for tabela in tabelas_com_empresa:
            if DATABASE_URL:
                colunas_tabela = {r["column_name"] for r in conn.execute(
                    "SELECT column_name FROM information_schema.columns WHERE table_name = %s", (tabela,)
                )}
            else:
                colunas_tabela = {r["name"] for r in conn.execute(f"PRAGMA table_info({tabela})")}
            if "empresa_id" not in colunas_tabela:
                conn.execute(f"ALTER TABLE {tabela} ADD COLUMN empresa_id TEXT")

        # migração leve: agrupamento de jobs que fazem parte da mesma
        # "evolução da obra" (várias etapas geradas a partir de uma descrição)
        if DATABASE_URL:
            colunas_jobs = {r["column_name"] for r in conn.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = %s", ("jobs",)
            )}
        else:
            colunas_jobs = {r["name"] for r in conn.execute("PRAGMA table_info(jobs)")}
        if "grupo_id" not in colunas_jobs:
            conn.execute("ALTER TABLE jobs ADD COLUMN grupo_id TEXT")
        if "etapa" not in colunas_jobs:
            conn.execute("ALTER TABLE jobs ADD COLUMN etapa TEXT")


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat()


def salvar_terreno(id_: str, nome_foto: str | None, area_m2: float, area_ha: float,
                    perimetro_m: float, gsd_cm_por_px: float, nome: str | None = None,
                    pontos_json: str | None = None) -> None:
    with _conectar() as conn:
        conn.execute(
            "INSERT INTO terrenos (id, criado_em, nome_foto, area_m2, area_ha, "
            "perimetro_m, gsd_cm_por_px, nome, pontos_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (id_, _agora(), nome_foto, area_m2, area_ha, perimetro_m, gsd_cm_por_px, nome, pontos_json),
        )


def registrar_job(id_: str, descricao: str, grupo_id: str | None = None,
                   etapa: str | None = None) -> None:
    with _conectar() as conn:
        agora = _agora()
        conn.execute(
            "INSERT INTO jobs (id, criado_em, atualizado_em, status, descricao, erro, "
            "grupo_id, etapa) VALUES (?, ?, ?, 'processando', ?, NULL, ?, ?)",
            (id_, agora, agora, descricao, grupo_id, etapa),
        )


def listar_jobs_do_grupo(grupo_id: str) -> list[sqlite3.Row]:
    with _conectar() as conn:
        return conn.execute(
            "SELECT * FROM jobs WHERE grupo_id = ? ORDER BY criado_em ASC", (grupo_id,)
        ).fetchall()


def atualizar_status_job(id_: str, status: str, erro: str | None = None) -> None:
    with _conectar() as conn:
        conn.execute(
            "UPDATE jobs SET status = ?, erro = ?, atualizado_em = ? WHERE id = ?",
            (status, erro, _agora(), id_),
        )


def listar_terrenos(limite: int = 50) -> list[sqlite3.Row]:
    with _conectar() as conn:
        return conn.execute(
            "SELECT * FROM terrenos ORDER BY criado_em DESC LIMIT ?", (limite,)
        ).fetchall()


def listar_jobs(limite: int = 50) -> list[sqlite3.Row]:
    with _conectar() as conn:
        return conn.execute(
            "SELECT * FROM jobs ORDER BY criado_em DESC LIMIT ?", (limite,)
        ).fetchall()


def resumo() -> dict:
    with _conectar() as conn:
        totais_terrenos = conn.execute(
            "SELECT COUNT(*) AS total, COALESCE(SUM(area_m2), 0) AS area_total FROM terrenos"
        ).fetchone()
        total_terrenos = _valor_coluna(totais_terrenos, "total", 0)
        area_total_m2 = _valor_coluna(totais_terrenos, "area_total", 1)
        total_videos = _valor_coluna(conn.execute(
            "SELECT COUNT(*) AS total FROM jobs WHERE status = 'pronto'"
        ).fetchone(), "total")
        videos_processando = _valor_coluna(conn.execute(
            "SELECT COUNT(*) AS total FROM jobs WHERE status = 'processando'"
        ).fetchone(), "total")

        desde = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        terrenos_7dias = _valor_coluna(conn.execute(
            "SELECT COUNT(*) AS total FROM terrenos WHERE criado_em >= ?", (desde,)
        ).fetchone(), "total")

        por_dia = conn.execute(
            "SELECT substr(criado_em, 1, 10) AS dia, COUNT(*) AS n "
            "FROM terrenos WHERE criado_em >= ? GROUP BY dia",
            (desde,),
        ).fetchall()

        total_clientes = _valor_coluna(
            conn.execute("SELECT COUNT(*) AS total FROM clientes").fetchone(), "total"
        )
        mes_atual = datetime.now(timezone.utc).strftime("%Y-%m")
        financeiro = conn.execute(
            "SELECT tipo, status, COALESCE(SUM(valor_centavos), 0) AS total "
            "FROM lancamentos_financeiros WHERE substr(vencimento, 1, 7) = ? GROUP BY tipo, status",
            (mes_atual,),
        ).fetchall()

    valores = {(linha["tipo"], linha["status"]): linha["total"] / 100 for linha in financeiro}

    return {
        "total_terrenos": total_terrenos,
        "area_total_m2": area_total_m2,
        "total_videos": total_videos,
        "videos_processando": videos_processando,
        "terrenos_7dias": terrenos_7dias,
        "medicoes_por_dia": {r["dia"]: r["n"] for r in por_dia},
        "total_clientes": total_clientes,
        "receitas_pagas_mes": valores.get(("receita", "pago"), 0),
        "despesas_pagas_mes": valores.get(("despesa", "pago"), 0),
        "a_receber_mes": valores.get(("receita", "pendente"), 0),
        "a_pagar_mes": valores.get(("despesa", "pendente"), 0),
    }


def atividades_recentes(limite: int = 8) -> list[dict]:
    """Junta terrenos medidos + jobs de vídeo numa única linha do tempo."""
    itens: list[dict] = []

    for t in listar_terrenos(limite):
        detalhe = (f"{t['area_ha']:.2f} ha" if t["area_ha"] >= 1
                    else f"{t['area_m2']:.0f} m²")
        itens.append({
            "tipo": "terreno",
            "criado_em": t["criado_em"],
            "titulo": t["nome"] or "Terreno medido",
            "detalhe": detalhe,
        })

    for j in listar_jobs(limite):
        itens.append({
            "tipo": "video",
            "criado_em": j["atualizado_em"],
            "titulo": _STATUS_ROTULO[j["status"]],
            "detalhe": j["descricao"] or "",
        })

    itens.sort(key=lambda i: i["criado_em"], reverse=True)
    return itens[:limite]


def renomear_terreno(id_: str, nome: str | None) -> bool:
    """Atualiza o nome do terreno. Devolve False se o id não existir."""
    with _conectar() as conn:
        cur = conn.execute("UPDATE terrenos SET nome = ? WHERE id = ?", (nome, id_))
        return cur.rowcount > 0


def salvar_pontos_terreno(id_: str, pontos_json: str) -> bool:
    with _conectar() as conn:
        cur = conn.execute("UPDATE terrenos SET pontos_json = ? WHERE id = ?", (pontos_json, id_))
        return cur.rowcount > 0


def excluir_terreno(id_: str) -> bool:
    """Remove o terreno. Devolve False se o id não existir."""
    with _conectar() as conn:
        cur = conn.execute("DELETE FROM terrenos WHERE id = ?", (id_,))
        return cur.rowcount > 0


def criar_lancamento(id_: str, tipo: str, descricao: str, categoria: str,
                     valor_centavos: int, vencimento: str, observacao: str | None) -> None:
    with _conectar() as conn:
        conn.execute(
            "INSERT INTO lancamentos_financeiros "
            "(id, criado_em, tipo, descricao, categoria, valor_centavos, vencimento, status, pago_em, observacao) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', NULL, ?)",
            (id_, _agora(), tipo, descricao, categoria, valor_centavos, vencimento, observacao),
        )


def listar_lancamentos(mes: str | None = None) -> list[sqlite3.Row]:
    consulta = "SELECT * FROM lancamentos_financeiros"
    parametros: tuple = ()
    if mes:
        consulta += " WHERE substr(vencimento, 1, 7) = ?"
        parametros = (mes,)
    consulta += " ORDER BY vencimento ASC, criado_em DESC"
    with _conectar() as conn:
        return conn.execute(consulta, parametros).fetchall()


def atualizar_status_lancamento(id_: str, status: str, pago_em: str | None) -> bool:
    with _conectar() as conn:
        cur = conn.execute(
            "UPDATE lancamentos_financeiros SET status = ?, pago_em = ? WHERE id = ?",
            (status, pago_em, id_),
        )
        return cur.rowcount > 0


def excluir_lancamento(id_: str) -> bool:
    with _conectar() as conn:
        cur = conn.execute("DELETE FROM lancamentos_financeiros WHERE id = ?", (id_,))
        return cur.rowcount > 0


def criar_cliente(id_: str, nome: str, contato: str | None, email: str | None,
                  whatsapp_cobranca_ativo: bool = False, dados_json: str | None = None,
                  empresa_id: str | None = None) -> None:
    with _conectar() as conn:
        conn.execute(
            "INSERT INTO clientes (id, criado_em, nome, contato, email, whatsapp_cobranca_ativo, dados_json, empresa_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (id_, _agora(), nome, contato, email, int(whatsapp_cobranca_ativo), dados_json, empresa_id),
        )


def listar_clientes(busca: str | None = None, empresa_id: str | None = None) -> list[sqlite3.Row]:
    consulta, parametros = "SELECT * FROM clientes", []
    filtros = []
    if empresa_id:
        filtros.append("empresa_id = ?")
        parametros.append(empresa_id)
    if busca:
        termo = f"%{busca.strip()}%"
        filtros.append("(nome LIKE ? OR contato LIKE ? OR email LIKE ?)")
        parametros.extend([termo, termo, termo])
    if filtros:
        consulta += " WHERE " + " AND ".join(filtros)
    consulta += " ORDER BY nome COLLATE NOCASE ASC"
    with _conectar() as conn:
        return conn.execute(consulta, tuple(parametros)).fetchall()


def excluir_cliente(id_: str) -> bool:
    with _conectar() as conn:
        cur = conn.execute("DELETE FROM clientes WHERE id = ?", (id_,))
        return cur.rowcount > 0


def atualizar_whatsapp_cobranca_cliente(id_: str, ativo: bool) -> bool:
    with _conectar() as conn:
        cur = conn.execute("UPDATE clientes SET whatsapp_cobranca_ativo = ? WHERE id = ?", (int(ativo), id_))
        return cur.rowcount > 0


# ----------------------------------------------------------------------
# modelos de mensagem para prospecção de leads
# ----------------------------------------------------------------------
def listar_modelos_mensagem_leads() -> list[sqlite3.Row]:
    with _conectar() as conn:
        return conn.execute(
            "SELECT * FROM modelos_mensagem_leads ORDER BY criado_em ASC"
        ).fetchall()


def criar_modelo_mensagem_lead(id_: str, titulo: str, conteudo: str) -> None:
    with _conectar() as conn:
        conn.execute(
            "INSERT INTO modelos_mensagem_leads (id, criado_em, titulo, conteudo) VALUES (?, ?, ?, ?)",
            (id_, _agora(), titulo, conteudo),
        )


def excluir_modelo_mensagem_lead(id_: str) -> bool:
    with _conectar() as conn:
        cur = conn.execute("DELETE FROM modelos_mensagem_leads WHERE id = ?", (id_,))
        return cur.rowcount > 0


# ----------------------------------------------------------------------
# usuÃ¡rios de acesso
# ----------------------------------------------------------------------
def obter_usuario_por_email(email: str) -> sqlite3.Row | None:
    with _conectar() as conn:
        return conn.execute("SELECT * FROM usuarios WHERE email = ?", (email.lower(),)).fetchone()


def criar_usuario_se_ausente(id_: str, email: str, nome: str | None, senha_hash: str) -> None:
    with _conectar() as conn:
        if DATABASE_URL:
            conn.execute(
                "INSERT INTO usuarios (id, criado_em, email, nome, senha_hash, ativo) VALUES (?, ?, ?, ?, ?, 1) "
                "ON CONFLICT (email) DO NOTHING",
                (id_, _agora(), email.lower(), nome, senha_hash),
            )
        else:
            conn.execute(
                "INSERT OR IGNORE INTO usuarios (id, criado_em, email, nome, senha_hash, ativo) VALUES (?, ?, ?, ?, ?, 1)",
                (id_, _agora(), email.lower(), nome, senha_hash),
            )


def criar_ou_atualizar_usuario(
    id_: str,
    email: str,
    nome: str | None,
    senha_hash: str,
    perfil: str,
    empresa_id: str | None = None,
) -> None:
    """Cria uma conta ou redefine sua senha e permissões sem expô-las."""
    with _conectar() as conn:
        if DATABASE_URL:
            conn.execute(
                """
                INSERT INTO usuarios (id, criado_em, email, nome, senha_hash, ativo, perfil, empresa_id)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?)
                ON CONFLICT (email) DO UPDATE SET
                    nome = EXCLUDED.nome,
                    senha_hash = EXCLUDED.senha_hash,
                    ativo = 1,
                    perfil = EXCLUDED.perfil,
                    empresa_id = EXCLUDED.empresa_id
                """,
                (id_, _agora(), email.lower(), nome, senha_hash, perfil, empresa_id),
            )
        else:
            existente = conn.execute(
                "SELECT id FROM usuarios WHERE email = ?", (email.lower(),)
            ).fetchone()
            if existente:
                conn.execute(
                    """
                    UPDATE usuarios
                    SET nome = ?, senha_hash = ?, ativo = 1, perfil = ?, empresa_id = ?
                    WHERE email = ?
                    """,
                    (nome, senha_hash, perfil, empresa_id, email.lower()),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO usuarios (id, criado_em, email, nome, senha_hash, ativo, perfil, empresa_id)
                    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
                    """,
                    (id_, _agora(), email.lower(), nome, senha_hash, perfil, empresa_id),
                )


# ----------------------------------------------------------------------
# administração master / imobiliárias
# ----------------------------------------------------------------------
def listar_empresas() -> list[sqlite3.Row]:
    with _conectar() as conn:
        return conn.execute(
            "SELECT e.*, COUNT(u.id) AS total_usuarios "
            "FROM empresas e LEFT JOIN usuarios u ON u.empresa_id = e.id "
            "GROUP BY e.id, e.criado_em, e.nome, e.cnpj, e.plano, e.status, e.ramo "
            "ORDER BY e.criado_em DESC"
        ).fetchall()


def criar_empresa(id_: str, nome: str, cnpj: str | None, plano: str, status: str = "ativo",
                  ramo: str = "imobiliaria") -> None:
    with _conectar() as conn:
        conn.execute(
            "INSERT INTO empresas (id, criado_em, nome, cnpj, plano, status, ramo) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (id_, _agora(), nome, cnpj, plano, status, ramo),
        )


def criar_empresa_com_acesso(
    empresa_id: str,
    nome_empresa: str,
    cnpj: str | None,
    plano: str,
    usuario_id: str,
    nome_usuario: str,
    email_usuario: str,
    senha_hash: str,
    ramo: str = "imobiliaria",
) -> None:
    """Cria empresa e acesso inicial na mesma operação."""
    with _conectar() as conn:
        conn.execute(
            "INSERT INTO empresas (id, criado_em, nome, cnpj, plano, status, ramo) VALUES (?, ?, ?, ?, ?, 'ativo', ?)",
            (empresa_id, _agora(), nome_empresa, cnpj, plano, ramo),
        )
        conn.execute(
            "INSERT INTO usuarios (id, criado_em, email, nome, senha_hash, ativo, perfil, empresa_id) "
            "VALUES (?, ?, ?, ?, ?, 1, 'imobiliaria', ?)",
            (usuario_id, _agora(), email_usuario.lower(), nome_usuario, senha_hash, empresa_id),
        )


def obter_empresa(id_: str) -> sqlite3.Row | None:
    with _conectar() as conn:
        return conn.execute("SELECT * FROM empresas WHERE id = ?", (id_,)).fetchone()


def obter_empresa_por_nome(nome: str) -> sqlite3.Row | None:
    with _conectar() as conn:
        return conn.execute("SELECT * FROM empresas WHERE nome = ?", (nome,)).fetchone()


def listar_usuarios() -> list[sqlite3.Row]:
    with _conectar() as conn:
        return conn.execute(
            "SELECT u.id, u.criado_em, u.nome, u.email, u.ativo, u.perfil, u.empresa_id, "
            "e.nome AS empresa_nome FROM usuarios u "
            "LEFT JOIN empresas e ON e.id = u.empresa_id "
            "ORDER BY u.criado_em DESC"
        ).fetchall()


def obter_usuario(id_: str) -> sqlite3.Row | None:
    with _conectar() as conn:
        return conn.execute("SELECT * FROM usuarios WHERE id = ?", (id_,)).fetchone()


def atualizar_usuario_empresa(
    id_: str,
    nome: str,
    email: str,
    empresa_id: str,
    senha_hash: str | None = None,
) -> bool:
    with _conectar() as conn:
        if senha_hash:
            cur = conn.execute(
                "UPDATE usuarios SET nome = ?, email = ?, empresa_id = ?, senha_hash = ? WHERE id = ?",
                (nome, email.lower(), empresa_id, senha_hash, id_),
            )
        else:
            cur = conn.execute(
                "UPDATE usuarios SET nome = ?, email = ?, empresa_id = ? WHERE id = ?",
                (nome, email.lower(), empresa_id, id_),
            )
        return cur.rowcount > 0


def desativar_usuario(id_: str) -> bool:
    with _conectar() as conn:
        cur = conn.execute("UPDATE usuarios SET ativo = 0 WHERE id = ?", (id_,))
        return cur.rowcount > 0


def migrar_registros_sem_empresa(empresa_id: str) -> None:
    """Associa o acervo legado a uma imobiliária, sem apagar nenhum dado."""
    tabelas = (
        "terrenos", "jobs", "lancamentos_financeiros", "clientes",
        "documentos", "imoveis", "cobrancas_aluguel",
    )
    with _conectar() as conn:
        for tabela in tabelas:
            conn.execute(
                f"UPDATE {tabela} SET empresa_id = ? WHERE empresa_id IS NULL",
                (empresa_id,),
            )


def vincular_usuario_empresa(email: str, empresa_id: str, perfil: str = "imobiliaria") -> bool:
    with _conectar() as conn:
        cur = conn.execute(
            "UPDATE usuarios SET empresa_id = ?, perfil = ?, ativo = 1 WHERE email = ?",
            (empresa_id, perfil, email.lower()),
        )
        return cur.rowcount > 0


def criar_documento(id_: str, titulo: str, categoria: str, nome_arquivo: str,
                    mime: str | None, tamanho_bytes: int) -> None:
    with _conectar() as conn:
        conn.execute("INSERT INTO documentos (id, criado_em, titulo, categoria, nome_arquivo, mime, tamanho_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)",
                     (id_, _agora(), titulo, categoria, nome_arquivo, mime, tamanho_bytes))


def listar_documentos(busca: str | None = None) -> list[sqlite3.Row]:
    consulta, parametros = "SELECT * FROM documentos", ()
    if busca:
        termo = f"%{busca.strip()}%"
        consulta += " WHERE titulo LIKE ? OR categoria LIKE ? OR nome_arquivo LIKE ?"
        parametros = (termo, termo, termo)
    consulta += " ORDER BY criado_em DESC"
    with _conectar() as conn:
        return conn.execute(consulta, parametros).fetchall()


def excluir_documento(id_: str) -> bool:
    with _conectar() as conn:
        cur = conn.execute("DELETE FROM documentos WHERE id = ?", (id_,))
        return cur.rowcount > 0


# ----------------------------------------------------------------------
# imÃ³veis e aluguÃ©is
# ----------------------------------------------------------------------
def criar_imovel(id_: str, titulo: str, tipo: str, endereco: str | None,
                 descricao: str | None, valor_aluguel_centavos: int,
                 taxa_condominio_centavos: int, cliente_id: str | None,
                 dia_vencimento: int | None, foto_nome: str | None,
                 foto_mime: str | None) -> None:
    status = "alugado" if cliente_id else "disponivel"
    with _conectar() as conn:
        conn.execute(
            "INSERT INTO imoveis (id, criado_em, titulo, tipo, endereco, descricao, "
            "valor_aluguel_centavos, taxa_condominio_centavos, status, cliente_id, dia_vencimento, foto_nome, foto_mime) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (id_, _agora(), titulo, tipo, endereco, descricao, valor_aluguel_centavos,
             taxa_condominio_centavos, status, cliente_id, dia_vencimento, foto_nome, foto_mime),
        )


def listar_imoveis(busca: str | None = None) -> list[sqlite3.Row]:
    consulta = """
        SELECT i.*, c.nome AS cliente_nome, c.contato AS cliente_contato
        FROM imoveis i LEFT JOIN clientes c ON c.id = i.cliente_id
    """
    parametros: tuple = ()
    consulta += " WHERE i.status <> 'arquivado'"
    if busca:
        termo = f"%{busca.strip()}%"
        consulta += " AND (i.titulo LIKE ? OR i.endereco LIKE ? OR c.nome LIKE ?)"
        parametros = (termo, termo, termo)
    consulta += " ORDER BY CASE i.status WHEN 'alugado' THEN 0 ELSE 1 END, i.criado_em DESC"
    with _conectar() as conn:
        return conn.execute(consulta, parametros).fetchall()


def obter_imovel(id_: str) -> sqlite3.Row | None:
    with _conectar() as conn:
        return conn.execute("SELECT * FROM imoveis WHERE id = ?", (id_,)).fetchone()


def excluir_imovel(id_: str) -> bool:
    with _conectar() as conn:
        # Mantém as cobranças e seus vínculos para não perder o histórico financeiro.
        cur = conn.execute("UPDATE imoveis SET status = 'arquivado' WHERE id = ? AND status <> 'arquivado'", (id_,))
        return cur.rowcount > 0


def atualizar_foto_imovel(id_: str, nome: str, mime: str | None) -> None:
    with _conectar() as conn:
        conn.execute("UPDATE imoveis SET foto_nome = ?, foto_mime = ? WHERE id = ?", (nome, mime, id_))


def criar_cobranca(id_: str, imovel_id: str, cliente_id: str, competencia: str,
                   vencimento: str, valor_centavos: int) -> None:
    with _conectar() as conn:
        conn.execute(
            "INSERT INTO cobrancas_aluguel (id, criado_em, imovel_id, cliente_id, competencia, vencimento, valor_centavos, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente')",
            (id_, _agora(), imovel_id, cliente_id, competencia, vencimento, valor_centavos),
        )


def garantir_cobrancas_do_mes(competencia: str) -> None:
    """Cria uma cobrança mensal por imóvel alugado, respeitando seu dia de vencimento."""
    ano, mes = (int(parte) for parte in competencia.split("-", 1))
    ultimo_dia = monthrange(ano, mes)[1]
    with _conectar() as conn:
        alugados = conn.execute(
            "SELECT id, cliente_id, dia_vencimento, valor_aluguel_centavos, taxa_condominio_centavos "
            "FROM imoveis WHERE status = 'alugado' AND cliente_id IS NOT NULL"
        ).fetchall()
        for imovel in alugados:
            dia = min(max(int(imovel["dia_vencimento"] or 1), 1), ultimo_dia)
            valores = (
                os.urandom(16).hex(), _agora(), imovel["id"], imovel["cliente_id"], competencia,
                f"{competencia}-{dia:02d}",
                int(imovel["valor_aluguel_centavos"]) + int(imovel["taxa_condominio_centavos"] or 0),
            )
            if DATABASE_URL:
                conn.execute(
                    "INSERT INTO cobrancas_aluguel (id, criado_em, imovel_id, cliente_id, competencia, vencimento, valor_centavos, status) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente') ON CONFLICT (imovel_id, competencia) DO NOTHING",
                    valores,
                )
            else:
                conn.execute(
                    "INSERT OR IGNORE INTO cobrancas_aluguel (id, criado_em, imovel_id, cliente_id, competencia, vencimento, valor_centavos, status) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente')",
                    valores,
                )


def listar_cobrancas(mes: str | None = None) -> list[sqlite3.Row]:
    consulta = """
        SELECT co.*, i.titulo AS imovel_titulo, c.nome AS cliente_nome, c.contato AS cliente_contato,
               c.whatsapp_cobranca_ativo AS cliente_whatsapp_cobranca_ativo
        FROM cobrancas_aluguel co
        JOIN imoveis i ON i.id = co.imovel_id
        JOIN clientes c ON c.id = co.cliente_id
    """
    parametros: tuple = ()
    if mes:
        consulta += " WHERE co.competencia = ?"
        parametros = (mes,)
    consulta += " ORDER BY co.vencimento ASC, co.criado_em DESC"
    with _conectar() as conn:
        return conn.execute(consulta, parametros).fetchall()


def obter_cobranca(id_: str) -> sqlite3.Row | None:
    with _conectar() as conn:
        return conn.execute("SELECT * FROM cobrancas_aluguel WHERE id = ?", (id_,)).fetchone()


def atualizar_status_cobranca(id_: str, status: str) -> bool:
    with _conectar() as conn:
        pago_em = _agora() if status == "pago" else None
        cur = conn.execute("UPDATE cobrancas_aluguel SET status = ?, pago_em = ? WHERE id = ?", (status, pago_em, id_))
        return cur.rowcount > 0


def registrar_lembrete_cobranca(id_: str) -> bool:
    with _conectar() as conn:
        cur = conn.execute("UPDATE cobrancas_aluguel SET lembrete_enviado_em = ? WHERE id = ?", (_agora(), id_))
        return cur.rowcount > 0


def lembrete_automatico_ja_enviado(cobranca_id: str, tipo: str) -> bool:
    with _conectar() as conn:
        return conn.execute("SELECT 1 FROM cobranca_lembretes WHERE cobranca_id = ? AND tipo = ?", (cobranca_id, tipo)).fetchone() is not None


def registrar_lembrete_automatico(cobranca_id: str, tipo: str) -> None:
    with _conectar() as conn:
        if DATABASE_URL:
            conn.execute("INSERT INTO cobranca_lembretes (id, cobranca_id, tipo, enviado_em) VALUES (?, ?, ?, ?) ON CONFLICT (cobranca_id, tipo) DO NOTHING", (os.urandom(16).hex(), cobranca_id, tipo, _agora()))
        else:
            conn.execute("INSERT OR IGNORE INTO cobranca_lembretes (id, cobranca_id, tipo, enviado_em) VALUES (?, ?, ?, ?)", (os.urandom(16).hex(), cobranca_id, tipo, _agora()))


# ----------------------------------------------------------------------
# recursos do ramo engenharia (obras, equipamentos, materiais, medições, monitoramento)
#
# Uma única tabela guarda todos os módulos. As colunas comuns ficam
# explícitas; o que é específico de cada tipo vai em dados_json. Assim um
# módulo novo não precisa de migração de schema.
# ----------------------------------------------------------------------
def criar_recurso_eng(id_: str, empresa_id: str | None, tipo: str, nome: str,
                      dados_json: str | None) -> None:
    with _conectar() as conn:
        conn.execute(
            "INSERT INTO recursos_eng (id, criado_em, empresa_id, tipo, nome, dados_json) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (id_, _agora(), empresa_id, tipo, nome, dados_json),
        )


def listar_recursos_eng(empresa_id: str | None, tipo: str,
                        busca: str | None = None) -> list[sqlite3.Row]:
    consulta = "SELECT * FROM recursos_eng WHERE tipo = ?"
    parametros: list = [tipo]
    if empresa_id:
        consulta += " AND empresa_id = ?"
        parametros.append(empresa_id)
    if busca:
        consulta += " AND nome LIKE ?"
        parametros.append(f"%{busca.strip()}%")
    consulta += " ORDER BY criado_em DESC"
    with _conectar() as conn:
        return conn.execute(consulta, tuple(parametros)).fetchall()


def obter_recurso_eng(id_: str) -> sqlite3.Row | None:
    with _conectar() as conn:
        return conn.execute("SELECT * FROM recursos_eng WHERE id = ?", (id_,)).fetchone()


def atualizar_foto_recurso_eng(id_: str, nome: str, mime: str | None) -> None:
    with _conectar() as conn:
        conn.execute("UPDATE recursos_eng SET foto_nome = ?, foto_mime = ? WHERE id = ?", (nome, mime, id_))


def excluir_recurso_eng(id_: str) -> bool:
    with _conectar() as conn:
        cur = conn.execute("DELETE FROM recursos_eng WHERE id = ?", (id_,))
        return cur.rowcount > 0


# ----------------------------------------------------------------------
# monitoramento de produtividade por voo de drone
# ----------------------------------------------------------------------
def criar_frente(id_: str, empresa_id: str | None, obra_id: str, nome: str,
                 geojson: str | None, extensao_prevista_m: float) -> None:
    with _conectar() as conn:
        conn.execute(
            "INSERT INTO eng_frentes (id, criado_em, empresa_id, obra_id, nome, geojson, extensao_prevista_m) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (id_, _agora(), empresa_id, obra_id, nome, geojson, extensao_prevista_m),
        )


def listar_frentes(obra_id: str) -> list[sqlite3.Row]:
    with _conectar() as conn:
        return conn.execute(
            "SELECT * FROM eng_frentes WHERE obra_id = ? ORDER BY criado_em ASC", (obra_id,)
        ).fetchall()


def obter_frente(id_: str) -> sqlite3.Row | None:
    with _conectar() as conn:
        return conn.execute("SELECT * FROM eng_frentes WHERE id = ?", (id_,)).fetchone()


def atualizar_frente(id_: str, nome: str, geojson: str | None, extensao_prevista_m: float) -> bool:
    with _conectar() as conn:
        cur = conn.execute(
            "UPDATE eng_frentes SET nome = ?, geojson = ?, extensao_prevista_m = ? WHERE id = ?",
            (nome, geojson, extensao_prevista_m, id_),
        )
        return cur.rowcount > 0


def excluir_frente(id_: str) -> bool:
    with _conectar() as conn:
        cur = conn.execute("DELETE FROM eng_frentes WHERE id = ?", (id_,))
        return cur.rowcount > 0


def criar_voo(id_: str, empresa_id: str | None, obra_id: str, data: str,
              turno: str, observacao: str | None, operador_id: str | None = None,
              criado_por: str | None = None) -> None:
    with _conectar() as conn:
        conn.execute(
            "INSERT INTO eng_voos (id, criado_em, empresa_id, obra_id, data, turno, observacao, operador_id, criado_por) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (id_, _agora(), empresa_id, obra_id, data, turno, observacao, operador_id, criado_por),
        )


def listar_voos(empresa_id: str | None, obra_id: str | None = None) -> list[sqlite3.Row]:
    consulta = "SELECT * FROM eng_voos"
    filtros, parametros = [], []
    if empresa_id:
        filtros.append("empresa_id = ?"); parametros.append(empresa_id)
    if obra_id:
        filtros.append("obra_id = ?"); parametros.append(obra_id)
    if filtros:
        consulta += " WHERE " + " AND ".join(filtros)
    consulta += " ORDER BY data DESC, criado_em DESC"
    with _conectar() as conn:
        return conn.execute(consulta, tuple(parametros)).fetchall()


def obter_voo(id_: str) -> sqlite3.Row | None:
    with _conectar() as conn:
        return conn.execute("SELECT * FROM eng_voos WHERE id = ?", (id_,)).fetchone()


def excluir_voo(id_: str) -> bool:
    with _conectar() as conn:
        conn.execute("DELETE FROM eng_deteccoes WHERE voo_id = ?", (id_,))
        conn.execute("DELETE FROM eng_voo_fotos WHERE voo_id = ?", (id_,))
        cur = conn.execute("DELETE FROM eng_voos WHERE id = ?", (id_,))
        return cur.rowcount > 0


def adicionar_foto_voo(id_: str, voo_id: str, nome_arquivo: str, mime: str | None,
                       gps_lat: float | None, gps_lon: float | None,
                       altitude_m: float | None, tirada_em: str | None) -> None:
    with _conectar() as conn:
        conn.execute(
            "INSERT INTO eng_voo_fotos (id, criado_em, voo_id, nome_arquivo, mime, gps_lat, gps_lon, altitude_m, tirada_em) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (id_, _agora(), voo_id, nome_arquivo, mime, gps_lat, gps_lon, altitude_m, tirada_em),
        )


def listar_fotos_voo(voo_id: str) -> list[sqlite3.Row]:
    with _conectar() as conn:
        return conn.execute(
            "SELECT * FROM eng_voo_fotos WHERE voo_id = ? ORDER BY tirada_em ASC, criado_em ASC", (voo_id,)
        ).fetchall()


def obter_foto_voo(id_: str) -> sqlite3.Row | None:
    with _conectar() as conn:
        return conn.execute("SELECT * FROM eng_voo_fotos WHERE id = ?", (id_,)).fetchone()


def marcar_foto_qr(id_: str) -> None:
    with _conectar() as conn:
        conn.execute("UPDATE eng_voo_fotos SET tem_qr = 1 WHERE id = ?", (id_,))


def criar_deteccao(id_: str, voo_id: str, foto_id: str | None, maquina_id: str,
                   frente_id: str | None, lat: float | None, lon: float | None,
                   progressiva_m: float | None, metodo: str, status_maquina: str | None) -> None:
    with _conectar() as conn:
        conn.execute(
            "INSERT INTO eng_deteccoes (id, criado_em, voo_id, foto_id, maquina_id, frente_id, lat, lon, progressiva_m, metodo, status_maquina) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (id_, _agora(), voo_id, foto_id, maquina_id, frente_id, lat, lon, progressiva_m, metodo, status_maquina),
        )


def listar_deteccoes(voo_id: str) -> list[sqlite3.Row]:
    with _conectar() as conn:
        return conn.execute(
            "SELECT * FROM eng_deteccoes WHERE voo_id = ? ORDER BY criado_em ASC", (voo_id,)
        ).fetchall()


def obter_deteccao(id_: str) -> sqlite3.Row | None:
    with _conectar() as conn:
        return conn.execute("SELECT * FROM eng_deteccoes WHERE id = ?", (id_,)).fetchone()


def atualizar_deteccao(id_: str, maquina_id: str, lat: float | None, lon: float | None,
                       progressiva_m: float | None, status_maquina: str | None) -> bool:
    with _conectar() as conn:
        cur = conn.execute(
            "UPDATE eng_deteccoes SET maquina_id = ?, lat = ?, lon = ?, progressiva_m = ?, status_maquina = ? WHERE id = ?",
            (maquina_id, lat, lon, progressiva_m, status_maquina, id_),
        )
        return cur.rowcount > 0


def excluir_deteccao(id_: str) -> bool:
    with _conectar() as conn:
        cur = conn.execute("DELETE FROM eng_deteccoes WHERE id = ?", (id_,))
        return cur.rowcount > 0


def salvar_consumo(id_: str, empresa_id: str | None, obra_id: str, data: str, turno: str,
                   maquina_id: str, horas: float, custo_hora_centavos: int) -> None:
    with _conectar() as conn:
        if DATABASE_URL:
            conn.execute(
                "INSERT INTO eng_consumo (id, criado_em, empresa_id, obra_id, data, turno, maquina_id, horas, custo_hora_centavos) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT (obra_id, data, turno, maquina_id) DO UPDATE SET horas = EXCLUDED.horas, custo_hora_centavos = EXCLUDED.custo_hora_centavos",
                (id_, _agora(), empresa_id, obra_id, data, turno, maquina_id, horas, custo_hora_centavos),
            )
        else:
            conn.execute(
                "INSERT INTO eng_consumo (id, criado_em, empresa_id, obra_id, data, turno, maquina_id, horas, custo_hora_centavos) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT (obra_id, data, turno, maquina_id) DO UPDATE SET horas = excluded.horas, custo_hora_centavos = excluded.custo_hora_centavos",
                (id_, _agora(), empresa_id, obra_id, data, turno, maquina_id, horas, custo_hora_centavos),
            )


def listar_consumo(obra_id: str, data: str | None = None, turno: str | None = None) -> list[sqlite3.Row]:
    consulta = "SELECT * FROM eng_consumo WHERE obra_id = ?"
    parametros: list = [obra_id]
    if data:
        consulta += " AND data = ?"; parametros.append(data)
    if turno:
        consulta += " AND turno = ?"; parametros.append(turno)
    with _conectar() as conn:
        return conn.execute(consulta, tuple(parametros)).fetchall()
