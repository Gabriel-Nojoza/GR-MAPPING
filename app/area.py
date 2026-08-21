"""
Passo 3 — Área do terreno a partir do polígono.

O usuário marca os cantos do terreno na foto (uma lista de pontos em
PIXEL). Com o GSD (metros por pixel) do Passo 2, convertemos cada ponto
pra metros e calculamos a área real.

    ponto_em_metros = ponto_em_pixel * gsd

A área usa a lib shapely, que além de calcular também detecta polígono
inválido (linhas que se cruzam), coisa comum quando o usuário marca os
pontos fora de ordem.
"""
from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import Polygon


@dataclass
class AreaResult:
    area_m2: float             # área real em metros quadrados
    perimeter_m: float         # perímetro em metros
    n_pontos: int              # quantos cantos foram marcados

    @property
    def area_ha(self) -> float:
        """Área em hectares (1 ha = 10.000 m²)."""
        return self.area_m2 / 10_000

    def resumo(self) -> str:
        if self.area_m2 >= 10_000:
            return f"{self.area_m2:,.0f} m² ({self.area_ha:.2f} ha)"
        return f"{self.area_m2:,.1f} m²"


def area_do_poligono(pontos_px: list[tuple[float, float]],
                     gsd_m_per_px: float) -> AreaResult:
    """
    pontos_px    : lista de (x, y) em pixels, os cantos do terreno na foto
    gsd_m_per_px : metros por pixel (vindo do compute_gsd do Passo 2)
    """
    if len(pontos_px) < 3:
        raise ValueError("preciso de pelo menos 3 pontos pra formar um terreno")
    if gsd_m_per_px <= 0:
        raise ValueError("GSD inválido (precisa ser maior que zero)")

    # converte cada canto de pixel pra metro
    pontos_m = [(x * gsd_m_per_px, y * gsd_m_per_px) for x, y in pontos_px]

    poligono = Polygon(pontos_m)

    if not poligono.is_valid:
        raise ValueError(
            "o polígono é inválido — provavelmente as linhas se cruzam. "
            "Marque os cantos em ordem, seguindo a borda do terreno."
        )
    if poligono.area <= 0:
        raise ValueError("área deu zero — confira os pontos marcados")

    return AreaResult(
        area_m2=poligono.area,
        perimeter_m=poligono.length,
        n_pontos=len(pontos_px),
    )