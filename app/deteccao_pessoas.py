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
_CAMINHO_MODELO = os.getenv("YOLO_MODELO", "yolov8s.pt")
_CONF_MIN = 0.20
_IMGSZ = 1024
# em foto aérea a pessoa fica com ~20 px — rodar o YOLO na imagem inteira
# reduzida "some" com ela. Quebrar em pedaços com sobreposição e rodar em
# cada um recupera bastante (técnica SAHI).
_TILE_LADO = 1100
_TILE_OVERLAP = 0.25

# faixas de matiz em HSV (H: 0-179 no OpenCV) por cor de capacete cadastrada
# em Trabalhadores. Vermelho aparece nas duas pontas da roda de cores.
_FAIXAS_HSV: dict[str, list[tuple[tuple[int, int, int], tuple[int, int, int]]]] = {
    "Amarelo": [((22, 110, 110), (34, 255, 255))],
    "Laranja": [((8, 120, 120), (21, 255, 255))],
    "Verde": [((38, 70, 60), (85, 255, 255))],
    "Azul": [((92, 70, 55), (128, 255, 255))],
    "Vermelho": [((0, 130, 110), (6, 255, 255)), ((174, 130, 110), (179, 255, 255))],
    "Branco": [((0, 0, 165), (179, 55, 255))],
}
_FRACAO_MIN_COR = 0.18  # a cor precisa cobrir ao menos 18% da região do capacete


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


def _tiles(larg: int, alt: int):
    """Gera janelas (x1,y1,x2,y2) cobrindo a imagem, com sobreposição."""
    if max(larg, alt) <= _TILE_LADO:
        yield (0, 0, larg, alt)
        return
    passo = int(_TILE_LADO * (1 - _TILE_OVERLAP))
    for y in range(0, alt, passo):
        for x in range(0, larg, passo):
            x2 = min(x + _TILE_LADO, larg)
            y2 = min(y + _TILE_LADO, alt)
            yield (max(0, x2 - _TILE_LADO), max(0, y2 - _TILE_LADO), x2, y2)


def _dedup(caixas: list[tuple[int, int, int, int]], dist_min: int = 40):
    """Remove caixas cujo centro está muito perto de outra já aceita."""
    aceitas: list[tuple[int, int, int, int]] = []
    for b in caixas:
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        if any(abs(cx - (a[0] + a[2]) / 2) < dist_min and abs(cy - (a[1] + a[3]) / 2) < dist_min for a in aceitas):
            continue
        aceitas.append(b)
    return aceitas


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

    alt_img, larg_img = imagem.shape[:2]
    caixas: list[tuple[int, int, int, int]] = []
    for (tx1, ty1, tx2, ty2) in _tiles(larg_img, alt_img):
        recorte = imagem[ty1:ty2, tx1:tx2]
        try:
            res = modelo.predict(recorte, imgsz=_IMGSZ, conf=_CONF_MIN, classes=[0], verbose=False)[0]
        except Exception:
            continue
        for box in res.boxes:
            bx1, by1, bx2, by2 = (int(v) for v in box.xyxy[0].tolist())
            caixas.append((tx1 + bx1, ty1 + by1, tx1 + bx2, ty1 + by2))

    hsv = cv2.cvtColor(imagem, cv2.COLOR_BGR2HSV)
    contagem: dict[str, int] = {}
    for x1, y1, x2, y2 in _dedup(caixas):
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(larg_img, x2), min(alt_img, y2)
        if x2 <= x1 or y2 <= y1:
            continue
        # região do capacete: topo ~22% da caixa e faixa central
        alt = y2 - y1
        larg = x2 - x1
        fim_cabeca = y1 + max(1, int(alt * 0.22))
        cx1 = x1 + int(larg * 0.20)
        cx2 = x2 - int(larg * 0.20)
        if cx2 <= cx1:
            cx1, cx2 = x1, x2
        cor = _cor_do_capacete(hsv[y1:fim_cabeca, cx1:cx2])
        chave = cor or "Sem capacete"
        contagem[chave] = contagem.get(chave, 0) + 1
    return contagem
