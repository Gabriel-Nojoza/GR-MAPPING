"""
Passo 2 — Cálculo do GSD (Ground Sample Distance).

GSD = quantos metros no chão cada pixel da foto representa.
É a "régua" que transforma pixels em metros. Com ele, a área de um
polígono desenhado na foto (em pixels²) vira área real (em m²).

Fórmula:
    GSD (m/px) = (largura_sensor_mm * altura_voo_m)
                 -------------------------------------
                 (foco_mm * largura_imagem_px)

Como nem toda foto traz a largura do sensor de forma confiável, usamos
por padrão o "equivalente a 35mm": um sensor full-frame tem 36mm de
largura, e o EXIF traz o foco já convertido pra essa referência
(FocalLengthIn35mmFilm). Assim a conta funciona pra qualquer câmera:

    GSD (m/px) = (36 * altura_voo_m) / (foco_35mm * largura_imagem_px)
"""
from __future__ import annotations

from dataclasses import dataclass

from app.metadata import PhotoMetadata

# largura do sensor (mm) de modelos conhecidos, pro método preciso
SENSOR_WIDTH_MM = {
    "DJI Mini 3": 9.65,        # sensor 1/1.3"
    "DJI Mini 3 Pro": 9.65,
    "DJI Mini 4 Pro": 9.65,
    "DJI Mini 4K": 6.17,       # sensor 1/2.3"
    "DJI Mini 2 SE": 6.17,
    "FC7303": 6.17,            # nome interno que alguns Mini gravam
}

FULL_FRAME_WIDTH_MM = 36.0     # referência do "equivalente a 35mm"


@dataclass
class GsdResult:
    gsd_m_per_px: float        # metros por pixel
    method: str                # como foi calculado
    ground_width_m: float      # largura coberta no chão (m)
    ground_height_m: float     # altura coberta no chão (m)

    @property
    def gsd_cm_per_px(self) -> float:
        return self.gsd_m_per_px * 100

    @property
    def ground_area_m2(self) -> float:
        """Área total que a foto cobre no chão (m²)."""
        return self.ground_width_m * self.ground_height_m


def compute_gsd(md: PhotoMetadata) -> GsdResult:
    """Calcula o GSD a partir do metadado lido no Passo 1."""
    faltando = md.missing_for_gsd()
    if faltando:
        raise ValueError(f"faltam dados pro GSD: {', '.join(faltando)}")

    altura = md.relative_altitude_m
    largura_px = md.image_width_px
    altura_px = md.image_height_px

    # Método 1 (preciso): foco real + largura do sensor do modelo
    sensor_w = SENSOR_WIDTH_MM.get(md.model)
    if sensor_w and md.focal_length_mm:
        gsd = (sensor_w * altura) / (md.focal_length_mm * largura_px)
        method = f"sensor real ({md.model}, {sensor_w}mm)"
    # Método 2 (universal): equivalente a 35mm
    elif md.focal_length_35mm:
        gsd = (FULL_FRAME_WIDTH_MM * altura) / (md.focal_length_35mm * largura_px)
        method = "equivalente 35mm"
    else:
        raise ValueError("sem foco suficiente pra calcular o GSD")

    return GsdResult(
        gsd_m_per_px=gsd,
        method=method,
        ground_width_m=gsd * largura_px,
        ground_height_m=gsd * altura_px,
    )