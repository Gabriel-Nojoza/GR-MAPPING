"""
Contagem ESTIMADA de pessoas em obra, pela cor do capacete, a partir das
fotos do voo do drone.

Roda sobre a mesma foto aérea que já é usada pra ler o QR das máquinas
(app/qr.py). Como o drone fotografa de cima (nadir), só dá pra ver o topo
do capacete — não tem como reconhecer rosto nem identificar a pessoa. Por
isso isso NÃO substitui o ponto eletrônico: serve só como conferência
cruzada ("bateram ponto 12, o drone viu ~9 fisicamente na obra"), não como
registro oficial de presença.

Como funciona: procura, na imagem, manchas de cor parecidas com cada cor
de capacete cadastrada em Trabalhadores, filtra por tamanho e por formato
(bem redondo = provável capacete; comprido = provável cano/ferragem) e
conta quantas sobraram por cor.

IMPORTANTE — isso precisa de calibração com fotos reais: os intervalos de
matiz (HSV) abaixo são um ponto de partida, não um valor validado em campo.
A cor "Branco" em especial tende a dar falso positivo (saco de cimento,
tubo PVC, caminhão branco, concreto claro no sol também são "brancos").
"""
from __future__ import annotations

from pathlib import Path

try:
    import cv2
    import numpy as np
except ImportError:  # ambiente sem opencv-contrib-python-headless instalado
    cv2 = None
    np = None

# faixas de matiz em HSV (H: 0-179 no OpenCV) por cor de capacete.
# Vermelho aparece nas duas pontas da roda de cores, por isso tem 2 faixas.
_FAIXAS_HSV: dict[str, list[tuple[tuple[int, int, int], tuple[int, int, int]]]] = {
    "Amarelo": [((20, 90, 90), (35, 255, 255))],
    "Laranja": [((8, 100, 100), (20, 255, 255))],
    "Verde": [((36, 60, 60), (85, 255, 255))],
    "Azul": [((90, 60, 60), (130, 255, 255))],
    "Vermelho": [((0, 100, 90), (7, 255, 255)), ((173, 100, 90), (179, 255, 255))],
    "Branco": [((0, 0, 190), (179, 40, 255))],
}

AREA_MIN_PX = 120        # blob menor que isso é ruído/reflexo
AREA_MAX_PX = 25000      # blob maior que isso não é um capacete isolado (é chão claro, laje etc.)
CIRCULARIDADE_MIN = 0.45  # 1.0 = círculo perfeito; filtra objetos compridos (cano, ferragem, meio-fio)


def disponivel() -> bool:
    return cv2 is not None


def _circularidade(contorno) -> float:
    area = cv2.contourArea(contorno)
    perimetro = cv2.arcLength(contorno, True)
    if perimetro == 0:
        return 0.0
    return float(4 * 3.141592653589793 * area / (perimetro ** 2))


def contar_capacetes(caminho: str | Path) -> dict[str, int]:
    """
    Conta, por cor de capacete, quantos blobs plausíveis aparecem na foto.
    Devolve {} se o leitor não está disponível, a imagem não abre, ou não
    achou nada plausível em nenhuma cor.
    """
    if cv2 is None:
        return {}
    imagem = cv2.imread(str(caminho))
    if imagem is None:
        return {}

    hsv = cv2.cvtColor(imagem, cv2.COLOR_BGR2HSV)
    nucleo = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    contagem: dict[str, int] = {}

    for cor, faixas in _FAIXAS_HSV.items():
        mascara = None
        for baixo, alto in faixas:
            parcial = cv2.inRange(hsv, np.array(baixo), np.array(alto))
            mascara = parcial if mascara is None else cv2.bitwise_or(mascara, parcial)

        # abre: remove pontinhos de ruído / fecha: une pedaços do mesmo capacete
        mascara = cv2.morphologyEx(mascara, cv2.MORPH_OPEN, nucleo, iterations=2)
        mascara = cv2.morphologyEx(mascara, cv2.MORPH_CLOSE, nucleo, iterations=2)

        contornos, _ = cv2.findContours(mascara, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        n = 0
        for c in contornos:
            area = cv2.contourArea(c)
            if area < AREA_MIN_PX or area > AREA_MAX_PX:
                continue
            if _circularidade(c) < CIRCULARIDADE_MIN:
                continue
            n += 1
        if n:
            contagem[cor] = n

    return contagem
