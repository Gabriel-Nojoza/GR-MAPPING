"""
Popula a empresa "GN Engenharia" com um cenário de demonstração
(obra de saneamento). Uso:

    python scripts/seed_demo_engenharia.py            # limpa o que já existe e recria
    python scripts/seed_demo_engenharia.py --manter   # só adiciona, sem limpar

Roda contra o banco configurado em DATABASE_URL (.env) — ou seja, o Supabase.
"""
from __future__ import annotations

import json
import sys
import uuid

from dotenv import load_dotenv
load_dotenv()

from app import db  # noqa: E402

EMPRESA_ID = "9b6f03c5b9c34ba5ba3d08c5e410ff22"  # GN Engenharia
LIMPAR = "--manter" not in sys.argv


def _rid() -> str:
    return uuid.uuid4().hex


def recurso(tipo: str, nome: str, dados: dict) -> str:
    rid = _rid()
    db.criar_recurso_eng(rid, EMPRESA_ID, tipo, nome, json.dumps(dados, ensure_ascii=False))
    return rid


def limpar() -> None:
    with db._conectar() as conn:
        conn.execute("DELETE FROM recursos_eng WHERE empresa_id = ?", (EMPRESA_ID,))
        conn.execute("DELETE FROM clientes WHERE empresa_id = ?", (EMPRESA_ID,))
    print("cenário anterior removido")


def main() -> None:
    db.init_db()
    if db.obter_empresa(EMPRESA_ID) is None:
        raise SystemExit("Empresa GN Engenharia não encontrada. Confirme o EMPRESA_ID.")

    if LIMPAR:
        limpar()

    # -- clientes ---------------------------------------------------------
    for nome, cidade, contrato in [
        ("CAGECE - Cia. de Água e Esgoto do Ceará", "Fortaleza/CE", "gerado"),
        ("Prefeitura Municipal de Fortaleza", "Fortaleza/CE", "gerado"),
        ("Construtora Marquise S/A", "Fortaleza/CE", "a_gerar"),
    ]:
        db.criar_cliente(_rid(), nome, None, None, False,
                         json.dumps({"endereco": cidade, "contrato": contrato}, ensure_ascii=False),
                         EMPRESA_ID)

    # -- obras ----------------------------------------------------------
    adutora = recurso("obra", "Adutora Setor Norte - DN300", {
        "cliente": "CAGECE", "localizacao": "Caucaia/CE", "status": "Em andamento",
        "data_inicio": "2026-05-05", "previsao_termino": "2026-11-30",
        "valor_contrato": "2850000", "preco_medicao": "650", "contrato": "Gerado",
        "observacoes": "Tubulação PVC DEFOFO DN300, extensão prevista 1.800 m.",
    })
    rede = recurso("obra", "Rede Coletora Bairro Planalto", {
        "cliente": "Prefeitura de Fortaleza", "localizacao": "Fortaleza/CE", "status": "Em andamento",
        "data_inicio": "2026-06-16", "previsao_termino": "2026-10-15",
        "valor_contrato": "1420000", "preco_medicao": "320", "contrato": "Gerado",
        "observacoes": "Rede coletora de esgoto DN200, 2.400 m previstos.",
    })
    eee = recurso("obra", "Estação Elevatória EEE-04", {
        "cliente": "CAGECE", "localizacao": "Maracanaú/CE", "status": "Planejamento",
        "data_inicio": "2026-09-15", "previsao_termino": "2027-02-28",
        "valor_contrato": "980000", "preco_medicao": "", "contrato": "A gerar ao fechar",
    })

    # -- equipamentos -------------------------------------------------
    for nome, tipo_eq, obra, status, qtd, horas, custo_h in [
        ("Escavadeira Hidráulica CAT 320", "Escavadeira", adutora, "Em campo", "1", "320", "210"),
        ("Caminhão Basculante MB 2726", "Caminhão", adutora, "Em campo", "3", "260", "120"),
        ("Motobomba p/ rebaixamento", "Outro", adutora, "Manutenção", "2", "140", "60"),
        ("Retroescavadeira JCB 3CX", "Retroescavadeira", rede, "Em campo", "2", "180", "145"),
        ("Rolo Compactador CS44", "Rolo compactador", rede, "Disponível", "1", "90", "130"),
    ]:
        recurso("equipamento", nome, {
            "tipo_equip": tipo_eq, "obra": obra, "status": status,
            "quantidade": qtd, "horas_utilizadas": horas, "custo_hora": custo_h,
        })

    # -- materiais ---------------------------------------------------
    for nome, cat, obra, un, prev, cons, custo_u in [
        ("Tubo PVC DEFOFO DN300 (6m)", "Tubulação", adutora, "m", "1800", "1180", "92.5"),
        ("Conexão TÊ 300mm", "Conexão", adutora, "un", "60", "38", "340"),
        ("Anel de borracha DN300", "Outro", adutora, "un", "400", "250", "22"),
        ("Tubo PVC DEFOFO DN200 (6m)", "Tubulação", rede, "m", "2400", "1570", "61"),
        ("Curva 90° DN200", "Conexão", rede, "un", "120", "82", "180"),
        ("Brita nº 1 (lastro)", "Outro", rede, "m³", "350", "210", "95"),
    ]:
        recurso("material", nome, {
            "categoria": cat, "obra": obra, "unidade": un,
            "quantidade_prevista": prev, "quantidade_consumida": cons, "custo_unitario": custo_u,
        })

    # -- apontamentos de campo (medições por voo) -------------------
    apontamentos = [
        (adutora, "EST 0+000 a 0+500", "2026-07-10", "Dia inteiro", "14", "3", "500", "Eng. Carlos Lima"),
        (adutora, "EST 0+500 a 0+780", "2026-07-24", "Manhã", "12", "3", "280", "Eng. Carlos Lima"),
        (adutora, "EST 0+780 a 0+980", "2026-08-07", "Tarde", "13", "2", "200", "Eng. Carlos Lima"),
        (adutora, "EST 0+980 a 1+180", "2026-08-21", "Dia inteiro", "15", "3", "200", "Eng. Carlos Lima"),
        (rede, "Rua A - trecho 1", "2026-07-18", "Dia inteiro", "10", "2", "320", "Eng. Marina Souza"),
        (rede, "Rua A - trecho 2", "2026-07-31", "Manhã", "9", "2", "300", "Eng. Marina Souza"),
        (rede, "Rua B", "2026-08-12", "Dia inteiro", "11", "2", "540", "Eng. Marina Souza"),
        (rede, "Rua C - trecho 1", "2026-08-26", "Tarde", "8", "1", "230", "Eng. Marina Souza"),
        (rede, "Rua C - trecho 2", "2026-09-02", "Manhã", "9", "2", "180", "Eng. Marina Souza"),
    ]
    for obra, trecho, data, turno, colab, maq, metros, resp in apontamentos:
        recurso("medicao", f"Voo {data} {turno.lower()} — {trecho}", {
            "obra": obra, "trecho": trecho, "data": data, "turno": turno,
            "colaboradores": colab, "maquinas_campo": maq, "quantidade": metros, "responsavel": resp,
        })

    # -- lançamentos de custo (mão de obra e outros) ---------------
    lancamentos = [
        (adutora, "Mão de obra", "EST 0+000 a 0+500", "2026-07-31", "43000", "Equipe de assentamento - Julho"),
        (adutora, "Mão de obra", "EST 0+500 a 0+980", "2026-08-31", "44000", "Equipe de assentamento - Agosto"),
        (adutora, "Locação", "", "2026-08-10", "8500", "Locação de bomba submersa"),
        (adutora, "Combustível", "", "2026-08-30", "15600", "Combustível da frota - Agosto"),
        (rede, "Mão de obra", "Rua A", "2026-07-31", "29000", "Equipe rede coletora - Julho"),
        (rede, "Mão de obra", "Rua B", "2026-08-31", "30000", "Equipe rede coletora - Agosto"),
        (rede, "Serviços terceirizados", "", "2026-08-12", "9800", "Topografia terceirizada"),
    ]
    for obra, cat, trecho, data, valor, desc in lancamentos:
        recurso("custo", desc, {
            "categoria": cat, "obra": obra, "trecho": trecho, "data": data, "valor": valor,
        })

    # -- monitoramento (voos / mapeamento) ------------------------
    voos = [
        (adutora, "2026-07-12", "Voo", "12.4", "Voo semanal - Trecho Norte S1"),
        (adutora, "2026-07-30", "Ortomosaico", "34.0", "Ortomosaico Adutora - Julho"),
        (adutora, "2026-08-21", "Voo", "9.8", "Voo semanal - avanço EST 1+000"),
        (rede, "2026-08-06", "Inspeção", "3.2", "Inspeção de vala aberta Rua B"),
        (eee, "2026-09-02", "Mapeamento", "1.8", "Mapeamento do terreno EEE-04"),
    ]
    for obra, data, tipo_reg, area, nome in voos:
        recurso("monitoramento", nome, {
            "obra": obra, "data": data, "tipo_registro": tipo_reg, "area_ha": area,
        })

    print("Cenário de demonstração criado para GN Engenharia:")
    with db._conectar() as conn:
        for r in conn.execute(
            "SELECT tipo, COUNT(*) AS c FROM recursos_eng WHERE empresa_id = ? GROUP BY tipo", (EMPRESA_ID,)
        ):
            print(f"  {dict(r)['tipo']:14} {dict(r)['c']}")
        cli = conn.execute("SELECT COUNT(*) AS c FROM clientes WHERE empresa_id = ?", (EMPRESA_ID,)).fetchone()
        print(f"  {'clientes':14} {dict(cli)['c']}")


if __name__ == "__main__":
    main()
