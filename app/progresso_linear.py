"""
Cálculo do avanço de obras lineares: quantos metros já foram executados (a
partir da posição GPS de cada captura, projetada na rota importada por
KMZ), produtividade diária, impacto da chuva e previsão de conclusão.

Mantido separado de app/main.py (que só expõe o endpoint) pra não inflar
ainda mais aquele arquivo.
"""
from __future__ import annotations

import json
import uuid
from datetime import date, timedelta

from app import clima, db

CHUVA_LIMIAR_MM = 5.0  # a partir disso já conta como "dia de chuva" (afeta produtividade)
HORIZONTE_PREVISAO_DIAS = 16  # quantos dias de previsão real a Open-Meteo dá
TETO_SIMULACAO_DIAS = 3650  # trava de segurança pra não simular pra sempre se a produtividade ficar zerada
FRACAO_CHUVOSA_PADRAO = 0.2  # usado só se a obra ainda não tem nenhum dia de chuva registrado no histórico


def _obra_lat_lon(obra_id: str) -> tuple[float, float] | None:
    obra = db.obter_recurso_eng(obra_id)
    if obra is None:
        return None
    try:
        dados = json.loads(obra["dados_json"]) if obra["dados_json"] else {}
    except (TypeError, ValueError):
        dados = {}
    try:
        lat = float(dados.get("localizacao_lat"))
        lon = float(dados.get("localizacao_lon"))
    except (TypeError, ValueError):
        return None
    return lat, lon


def _trechos_da_obra(obra_id: str) -> list[dict]:
    return [dict(f) for f in db.listar_frentes(obra_id)]


def _executado_por_trecho(obra_id: str) -> dict[str, float]:
    return {r["frente_id"]: (r["max_m"] or 0.0) for r in db.progressiva_maxima_por_frente(obra_id)}


def _historico_bruto(obra_id: str) -> tuple[list[str], dict[str, float]]:
    """Máximo corrente (monotônico) por dia, somado entre todos os trechos.
    Retorna (datas ordenadas, {data: executado_total_no_dia})."""
    linhas = db.progressiva_por_dia(obra_id)
    por_frente: dict[str, dict[str, float]] = {}
    for r in linhas:
        por_frente.setdefault(r["frente_id"], {})[r["data"]] = r["max_m"] or 0.0

    todas_datas = sorted({r["data"] for r in linhas})
    corrente = {fid: 0.0 for fid in por_frente}
    total_por_dia: dict[str, float] = {}
    for d in todas_datas:
        for fid, valores in por_frente.items():
            if d in valores:
                corrente[fid] = max(corrente[fid], valores[d])
        total_por_dia[d] = sum(corrente.values())
    return todas_datas, total_por_dia


def _garantir_clima_cacheado(obra_id: str, lat: float, lon: float, datas: list[str]) -> None:
    if not datas:
        return
    existentes = {r["data"] for r in db.listar_clima_diario(obra_id, min(datas), max(datas))}
    faltando = [d for d in datas if d not in existentes]
    if not faltando:
        return
    encontrados = clima.buscar_historico(lat, lon, min(faltando), max(faltando))
    for dia in encontrados:
        if dia["chuva_mm"] is None and dia["umidade_pct"] is None:
            continue
        db.salvar_clima_diario(uuid.uuid4().hex, obra_id, dia["data"], dia["chuva_mm"], dia["umidade_pct"], "open-meteo")


def _produtividade_media(historico: list[dict]) -> dict:
    dias_chuva = [h["avanco_dia_m"] for h in historico if h.get("chuva_mm") is not None and h["chuva_mm"] >= CHUVA_LIMIAR_MM]
    dias_seco = [h["avanco_dia_m"] for h in historico if h.get("chuva_mm") is not None and h["chuva_mm"] < CHUVA_LIMIAR_MM]
    todos = [h["avanco_dia_m"] for h in historico]
    media = lambda xs: round(sum(xs) / len(xs), 2) if xs else None
    return {
        "media_geral_m_dia": media(todos),
        "media_dia_chuvoso_m_dia": media(dias_chuva),
        "media_dia_seco_m_dia": media(dias_seco),
        "dias_com_historico": len(todos),
        "dias_de_chuva": len(dias_chuva),
    }


def _prever_conclusao(restante_m: float, produtividade: dict, lat: float | None, lon: float | None) -> dict | None:
    if restante_m <= 0:
        return {"dias_restantes": 0, "data_prevista": date.today().isoformat(), "metros_restantes": 0.0}

    media_seca = produtividade["media_dia_seco_m_dia"]
    media_chuva = produtividade["media_dia_chuvoso_m_dia"]
    media_geral = produtividade["media_geral_m_dia"]
    if not media_geral:  # nenhum histórico de produtividade ainda — não dá pra prever
        return None
    media_seca = media_seca if media_seca else media_geral
    media_chuva = media_chuva if media_chuva else media_geral

    total_dias_hist = produtividade["dias_com_historico"] or 0
    fracao_chuvosa = (produtividade["dias_de_chuva"] / total_dias_hist) if total_dias_hist else FRACAO_CHUVOSA_PADRAO
    media_ponderada = fracao_chuvosa * media_chuva + (1 - fracao_chuvosa) * media_seca

    previsao_chuva: dict[str, float | None] = {}
    if lat is not None and lon is not None:
        for d in clima.buscar_previsao(lat, lon, HORIZONTE_PREVISAO_DIAS):
            previsao_chuva[d["data"]] = d["chuva_mm"]

    dia_atual = date.today()
    dias_simulados = 0
    while restante_m > 0 and dias_simulados < TETO_SIMULACAO_DIAS:
        dia_atual += timedelta(days=1)
        chave = dia_atual.isoformat()
        if chave in previsao_chuva and previsao_chuva[chave] is not None:
            produtividade_dia = media_chuva if previsao_chuva[chave] >= CHUVA_LIMIAR_MM else media_seca
        else:
            produtividade_dia = media_ponderada
        if produtividade_dia <= 0:
            return None  # produtividade histórica zerada — não dá pra estimar quando termina
        restante_m -= produtividade_dia
        dias_simulados += 1

    return {
        "dias_restantes": dias_simulados,
        "data_prevista": dia_atual.isoformat(),
        "metros_restantes": round(max(0.0, restante_m), 1),
    }


def calcular_avanco_linear(obra_id: str) -> dict:
    trechos_db = _trechos_da_obra(obra_id)
    executado_por_frente = _executado_por_trecho(obra_id)

    extensao_total_m = 0.0
    executado_total_m = 0.0
    trechos = []
    for f in trechos_db:
        ext = f.get("extensao_prevista_m") or 0.0
        exec_m = executado_por_frente.get(f["id"], 0.0)
        exec_m = max(0.0, min(exec_m, ext)) if ext else max(0.0, exec_m)
        extensao_total_m += ext
        executado_total_m += exec_m
        trechos.append({
            "id": f["id"],
            "nome": f["nome"],
            "diametro_mm": f.get("diametro_mm"),
            "material": f.get("material"),
            "extensao_m": round(ext, 1),
            "executado_m": round(exec_m, 1),
            "percentual": round(100 * exec_m / ext, 1) if ext else None,
        })

    datas, total_por_dia = _historico_bruto(obra_id)

    coordenada = _obra_lat_lon(obra_id)
    if coordenada and datas:
        _garantir_clima_cacheado(obra_id, coordenada[0], coordenada[1], datas)
    clima_por_data = {}
    if datas:
        clima_por_data = {r["data"]: r for r in db.listar_clima_diario(obra_id, min(datas), max(datas))}

    historico = []
    anterior = 0.0
    for d in datas:
        total_hoje = total_por_dia[d]
        avanco_dia = max(0.0, total_hoje - anterior)
        c = clima_por_data.get(d)
        chuva_mm = c["chuva_mm"] if c else None
        historico.append({
            "data": d,
            "executado_m": round(total_hoje, 1),
            "avanco_dia_m": round(avanco_dia, 1),
            "chuva_mm": chuva_mm,
            "umidade_pct": c["umidade_pct"] if c else None,
            "choveu": chuva_mm is not None and chuva_mm >= CHUVA_LIMIAR_MM,
        })
        anterior = total_hoje

    produtividade = _produtividade_media(historico)
    restante_m = max(0.0, extensao_total_m - executado_total_m)
    lat, lon = coordenada if coordenada else (None, None)
    previsao = _prever_conclusao(restante_m, produtividade, lat, lon)

    return {
        "extensao_total_m": round(extensao_total_m, 1),
        "executado_m": round(executado_total_m, 1),
        "percentual": round(100 * executado_total_m / extensao_total_m, 1) if extensao_total_m else None,
        "trechos": trechos,
        "historico_diario": historico,
        "produtividade": produtividade,
        "previsao": previsao,
        "clima_disponivel": coordenada is not None,
    }
