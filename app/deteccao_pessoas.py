"""
Detecção de pessoas em obra (e cor do capacete) nas fotos de voo, com YOLO.

Substitui a contagem por mancha de cor (app/pessoas.py), que confundia QR
branco / céu / veículo claro com pessoa. Aqui um modelo de verdade acha as
PESSOAS na foto; a cor do capacete é lida só na região da cabeça de cada
pessoa encontrada.

Modelo: yolov8n (COCO), classe 'person'. É um ponto de partida — foto
aérea reta a 40 m tem pessoas com ~20 px e o modelo padrão foi treinado
com fotos no nível do chão, então a precisão real só melhora com fine-tune
nas fotos da própria obra. Sem GPU, roda ~3-6 s por foto.

Como o drone fotografa de cima, só se vê o topo do capacete — não dá pra
identificar quem é a pessoa. A contagem é sempre uma ESTIMATIVA pra
conferir com o ponto eletrônico, nunca registro oficial de presença.
"""
from __future__ import annotations

import os
from pathlib import Path

try:
    import cv2
    import numpy as np
    from ultralytics import YOLO
except Exception:  # ambiente sem as libs de visão
    cv2 = None
    np = None
    YOLO = None

_MODELO = None
_CAMINHO_MODELO = os.getenv("YOLO_MODELO", "yolov8n.pt")
_CONF_MIN = 0.25
_IMGSZ = 960

# faixas de matiz em HSV (H: 0-179 no OpenCV) por cor de capacete cadastrada
# em Trabalhadores. Vermelho aparece nas duas pontas da roda de cores.
_FAIXAS_HSV: dict[str, list[tuple[tuple[int, int, int], tuple[int, int, int]]]] = {
    "Amarelo": [((20, 90, 90), (35, 255, 255))],
    "Laranja": [((8, 100, 100), (20, 255, 255))],
    "Verde": [((36, 60, 60), (85, 255, 255))],
    "Azul": [((90, 60, 60), (130, 255, 255))],
    "Vermelho": [((0, 100, 90), (7, 255, 255)), ((173, 100, 90), (179, 255, 255))],
    "Branco": [((0, 0, 190), (179, 45, 255))],
}
_FRACAO_MIN_COR = 0.15  # a cor precisa cobrir ao menos 15% da cabeça pra valer


def disponivel() -> bool:
    return YOLO is not None


def _modelo():
    global _MODELO
    if _MODELO is None and YOLO is not None:
        _MODELO = YOLO(_CAMINHO_MODELO)
    return _MODELO


def _cor_do_capacete(cabeca_hsv) -> str | None:
    total = cabeca_hsv.shape[0] * cabeca_hsv.shape[1]
    if total == 0:
        return None
    melhor, melhor_frac = None, 0.0
    for cor, faixas in _FAIXAS_HSV.items():
        mascara = None
        for baixo, alto in faixas:
            m = cv2.inRange(cabeca_hsv, np.array(baixo), np.array(alto))
            mascara = m if mascara is None else cv2.bitwise_or(mascara, m)
        frac = float((mascara > 0).sum()) / total
        if frac > melhor_frac:
            melhor, melhor_frac = cor, frac
    return melhor if melhor_frac >= _FRACAO_MIN_COR else None


def contar_pessoas(caminho: str | Path) -> dict[str, int]:
    """
    Conta as pessoas na foto e agrupa por cor de capacete.
    Ex.: {"Amarelo": 3, "Branco": 1, "Sem capacete": 2}. Total = soma.
    Devolve {} se o modelo não está disponível ou a imagem não abre.
    """
    modelo = _modelo()
    if modelo is None:
        return {}
    imagem = cv2.imread(str(caminho))
    if imagem is None:
        return {}

    try:
        resultado = modelo.predict(imagem, imgsz=_IMGSZ, conf=_CONF_MIN, classes=[0], verbose=False)[0]
    except Exception:
        return {}

    hsv = cv2.cvtColor(imagem, cv2.COLOR_BGR2HSV)
    alt_img, larg_img = imagem.shape[:2]
    contagem: dict[str, int] = {}
    for box in resultado.boxes:
        x1, y1, x2, y2 = (int(v) for v in box.xyxy[0].tolist())
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(larg_img, x2), min(alt_img, y2)
        if x2 <= x1 or y2 <= y1:
            continue
        # região da cabeça = 35% de cima da caixa da pessoa
        fim_cabeca = y1 + max(1, int((y2 - y1) * 0.35))
        cor = _cor_do_capacete(hsv[y1:fim_cabeca, x1:x2])
        chave = cor or "Sem capacete"
        contagem[chave] = contagem.get(chave, 0) + 1
    return contagem
