"""
Matemática geográfica compartilhada: distância entre pontos GPS e projeção
de um ponto sobre uma linha (traçado de obra) para achar a distância
acumulada ("progressiva", em metros, a partir do início da linha).

Usado tanto pelo rastreamento de máquinas via QR code (app/main.py) quanto
pela importação de rotas KMZ e pelo cálculo de avanço de obras lineares
(app/kmz.py, app/progresso_linear.py).
"""
from __future__ import annotations

import json
import math

_R_TERRA = 6_371_000.0  # metros


def dist_m(lat1, lon1, lat2, lon2) -> float:
    """Distância aproximada entre dois pontos GPS, em metros (haversine)."""
    if None in (lat1, lon1, lat2, lon2):
        return 0.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * _R_TERRA * math.asin(min(1.0, math.sqrt(a)))


def linha_da_frente(geojson) -> list[tuple[float, float]]:
    """Extrai a lista de (lon, lat) de um GeoJSON LineString (ou Feature com LineString)."""
    if not geojson:
        return []
    try:
        geo = json.loads(geojson) if isinstance(geojson, str) else geojson
        if geo.get("type") == "Feature":
            geo = geo.get("geometry", {})
        if geo.get("type") == "LineString":
            return [(float(c[0]), float(c[1])) for c in geo.get("coordinates", [])]
    except (TypeError, ValueError, KeyError):
        pass
    return []


def progressiva_e_distancia(
    coords: list[tuple[float, float]], lat: float | None, lon: float | None
) -> tuple[float, float] | None:
    """
    Projeta o ponto (lat, lon) sobre a linha `coords` (lista de (lon, lat)).

    Retorna (progressiva_m, distancia_perpendicular_m): a distância acumulada
    do início da linha até a projeção, e a distância perpendicular do ponto
    até a linha (usada para decidir se o ponto realmente pertence a essa
    linha). None se não der pra calcular (linha vazia/curta ou sem GPS).
    """
    if not coords or lat is None or lon is None or len(coords) < 2:
        return None
    melhor_dist = float("inf")
    acumulado = 0.0
    progressiva = 0.0
    for (lon1, lat1), (lon2, lat2) in zip(coords, coords[1:]):
        seg_m = dist_m(lat1, lon1, lat2, lon2)
        # projeta o ponto no segmento usando um plano local em metros
        ax, ay = 0.0, 0.0
        bx = dist_m(lat1, lon1, lat1, lon2) * (1 if lon2 >= lon1 else -1)
        by = dist_m(lat1, lon1, lat2, lon1) * (1 if lat2 >= lat1 else -1)
        px = dist_m(lat1, lon1, lat1, lon) * (1 if lon >= lon1 else -1)
        py = dist_m(lat1, lon1, lat, lon1) * (1 if lat >= lat1 else -1)
        seg2 = bx * bx + by * by
        t = 0.0 if seg2 == 0 else max(0.0, min(1.0, ((px - ax) * bx + (py - ay) * by) / seg2))
        cx, cy = ax + t * bx, ay + t * by
        d = math.hypot(px - cx, py - cy)
        if d < melhor_dist:
            melhor_dist = d
            progressiva = acumulado + t * seg_m
        acumulado += seg_m
    return round(progressiva, 1), round(melhor_dist, 1)


def progressiva(coords: list[tuple[float, float]], lat: float | None, lon: float | None) -> float | None:
    """Só a posição (em metros do início) do ponto projetado sobre a linha — sem a distância."""
    r = progressiva_e_distancia(coords, lat, lon)
    return r[0] if r else None


def comprimento_linha(coords: list[tuple[float, float]]) -> float:
    """Soma das distâncias entre pontos consecutivos — extensão real do traçado, em metros."""
    total = 0.0
    for (lon1, lat1), (lon2, lat2) in zip(coords, coords[1:]):
        total += dist_m(lat1, lon1, lat2, lon2)
    return total


def escolher_frente(frentes: list, lat: float | None, lon: float | None,
                     tolerancia_m: float = 150.0) -> tuple[str, float] | None:
    """
    Entre os trechos (frentes) de uma obra, acha o mais próximo do ponto e
    devolve (frente_id, progressiva_m). None se não houver frente com linha,
    sem GPS, ou se a mais próxima ainda estiver a mais de `tolerancia_m`.

    Necessário porque uma obra pode ter vários trechos (ex.: um KMZ com
    tronco + ramais) — não dá pra assumir que só existe um.
    """
    if lat is None or lon is None:
        return None
    melhor: tuple[str, float, float] | None = None  # (frente_id, progressiva_m, distancia_m)
    for f in frentes:
        coords = linha_da_frente(f["geojson"])
        r = progressiva_e_distancia(coords, lat, lon)
        if r is None:
            continue
        prog, dist = r
        if melhor is None or dist < melhor[2]:
            melhor = (f["id"], prog, dist)
    if melhor is None or melhor[2] > tolerancia_m:
        return None
    return melhor[0], melhor[1]
