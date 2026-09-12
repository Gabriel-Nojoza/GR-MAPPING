"""
Clima (chuva/umidade) por obra, via Open-Meteo — gratuito, sem chave de API.

Só biblioteca padrão (urllib) — não há requests/httpx no projeto e não vale a
pena adicionar uma dependência nova só por isso.

Falha de rede não pode derrubar o painel: todo erro aqui é engolido e vira
lista vazia — quem chama trata "sem dado de clima" normalmente.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

BASE_HISTORICO = "https://archive-api.open-meteo.com/v1/archive"
BASE_PREVISAO = "https://api.open-meteo.com/v1/forecast"


def _buscar(url: str, timeout: float = 8.0) -> dict | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read())
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return None


def buscar_historico(lat: float, lon: float, data_inicio: str, data_fim: str) -> list[dict]:
    """Chuva (mm) e umidade (%) por dia, para datas passadas — imutável, dá pra cachear pra sempre."""
    url = (f"{BASE_HISTORICO}?latitude={lat}&longitude={lon}&start_date={data_inicio}"
           f"&end_date={data_fim}&daily=precipitation_sum,relative_humidity_2m_mean&timezone=auto")
    resp = _buscar(url)
    dias = (resp or {}).get("daily") or {}
    datas = dias.get("time") or []
    chuvas = dias.get("precipitation_sum") or []
    umidades = dias.get("relative_humidity_2m_mean") or []
    saida = []
    for i, dt in enumerate(datas):
        saida.append({
            "data": dt,
            "chuva_mm": chuvas[i] if i < len(chuvas) else None,
            "umidade_pct": umidades[i] if i < len(umidades) else None,
        })
    return saida


def buscar_previsao(lat: float, lon: float, dias: int = 16) -> list[dict]:
    """Chuva prevista (mm) por dia, próximos `dias` dias (a previsão da Open-Meteo só
    tem umidade por hora, não como total diário — por isso só chuva aqui)."""
    url = f"{BASE_PREVISAO}?latitude={lat}&longitude={lon}&daily=precipitation_sum&forecast_days={dias}&timezone=auto"
    resp = _buscar(url)
    d = (resp or {}).get("daily") or {}
    datas = d.get("time") or []
    chuvas = d.get("precipitation_sum") or []
    return [{"data": dt, "chuva_mm": chuvas[i] if i < len(chuvas) else None} for i, dt in enumerate(datas)]
