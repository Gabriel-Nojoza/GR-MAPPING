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
from datetime import datetime, timedelta, timezone
from pathlib import Path

DB_PATH = Path(os.environ.get("MEDICAO_DB_PATH")
                or Path(__file__).resolve().parent.parent / "dados.db")

_STATUS_ROTULO = {
    "processando": "Vídeo em processamento",
    "pronto": "Vídeo gerado",
    "erro": "Falha ao gerar vídeo",
}


def _conectar() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


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
                email TEXT
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
        # migração leve: adiciona a coluna "nome" se o banco já existia sem ela
        colunas = {r["name"] for r in conn.execute("PRAGMA table_info(terrenos)")}
        if "nome" not in colunas:
            conn.execute("ALTER TABLE terrenos ADD COLUMN nome TEXT")
        if "pontos_json" not in colunas:
            conn.execute("ALTER TABLE terrenos ADD COLUMN pontos_json TEXT")

        # migração leve: agrupamento de jobs que fazem parte da mesma
        # "evolução da obra" (várias etapas geradas a partir de uma descrição)
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
        total_terrenos, area_total_m2 = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(area_m2), 0) FROM terrenos"
        ).fetchone()
        total_videos = conn.execute(
            "SELECT COUNT(*) FROM jobs WHERE status = 'pronto'"
        ).fetchone()[0]
        videos_processando = conn.execute(
            "SELECT COUNT(*) FROM jobs WHERE status = 'processando'"
        ).fetchone()[0]

        desde = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        terrenos_7dias = conn.execute(
            "SELECT COUNT(*) FROM terrenos WHERE criado_em >= ?", (desde,)
        ).fetchone()[0]

        por_dia = conn.execute(
            "SELECT substr(criado_em, 1, 10) AS dia, COUNT(*) AS n "
            "FROM terrenos WHERE criado_em >= ? GROUP BY dia",
            (desde,),
        ).fetchall()

        total_clientes = conn.execute("SELECT COUNT(*) FROM clientes").fetchone()[0]
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


def criar_cliente(id_: str, nome: str, contato: str | None, email: str | None) -> None:
    with _conectar() as conn:
        conn.execute("INSERT INTO clientes (id, criado_em, nome, contato, email) VALUES (?, ?, ?, ?, ?)",
                     (id_, _agora(), nome, contato, email))


def listar_clientes(busca: str | None = None) -> list[sqlite3.Row]:
    consulta, parametros = "SELECT * FROM clientes", ()
    if busca:
        termo = f"%{busca.strip()}%"
        consulta += " WHERE nome LIKE ? OR contato LIKE ? OR email LIKE ?"
        parametros = (termo, termo, termo)
    consulta += " ORDER BY nome COLLATE NOCASE ASC"
    with _conectar() as conn:
        return conn.execute(consulta, parametros).fetchall()


def excluir_cliente(id_: str) -> bool:
    with _conectar() as conn:
        cur = conn.execute("DELETE FROM clientes WHERE id = ?", (id_,))
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
