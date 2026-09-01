"""
Leitura de QR codes nas fotos de voo do drone.

Cada máquina leva uma etiqueta com o QR gerado pelo sistema, no formato
``GRM:<id_da_maquina>``. Ao subir as fotos de um voo, este módulo tenta
achar e decodificar esses QRs pra posicionar a máquina automaticamente.

É best-effort: se o OpenCV não estiver instalado, ou o QR não decodificar
(pequeno demais, borrado, reflexo), a marcação continua podendo ser feita
na mão pelo mapa.
"""
from __future__ import annotations

from pathlib import Path

try:
    import cv2  # type: ignore
    import numpy as np  # type: ignore
except ImportError:  # sem OpenCV -> leitura automática desligada
    cv2 = None
    np = None

PREFIXO = "GRM:"


def disponivel() -> bool:
    return cv2 is not None


def ler_qrs(caminho: str | Path) -> list[dict]:
    """
    Devolve a lista de QRs encontrados: [{"texto": str, "cx": float, "cy": float,
    "largura_px": int, "altura_px": int}]. cx/cy é o centro do QR em pixels.
    """
    if cv2 is None or np is None:
        return []
    imagem = cv2.imread(str(caminho))
    if imagem is None:
        return []

    h, w = imagem.shape[:2]
    detector = cv2.QRCodeDetector()
    achados: list[dict] = []

    try:
        ok, textos, pontos, _ = detector.detectAndDecodeMulti(imagem)
    except cv2.error:
        ok, textos, pontos = False, [], None

    if ok and pontos is not None:
        for texto, quad in zip(textos, pontos):
            if not texto:
                continue
            xs = [p[0] for p in quad]
            ys = [p[1] for p in quad]
            achados.append({
                "texto": texto.strip(),
                "cx": float(sum(xs) / len(xs)),
                "cy": float(sum(ys) / len(ys)),
                "largura_px": w,
                "altura_px": h,
            })

    if not achados:
        # tenta com realce (fotos aéreas costumam ter contraste baixo)
        cinza = cv2.cvtColor(imagem, cv2.COLOR_BGR2GRAY)
        cinza = cv2.equalizeHist(cinza)
        texto, quad, _ = detector.detectAndDecode(cinza)
        if texto and quad is not None:
            quad = quad.reshape(-1, 2)
            achados.append({
                "texto": texto.strip(),
                "cx": float(quad[:, 0].mean()),
                "cy": float(quad[:, 1].mean()),
                "largura_px": w,
                "altura_px": h,
            })

    return achados


def id_maquina(texto: str) -> str | None:
    """Extrai o id da máquina de um QR ``GRM:<id>``. Devolve None se não bater."""
    texto = (texto or "").strip()
    if texto.startswith(PREFIXO):
        alvo = texto[len(PREFIXO):].strip()
        return alvo or None
    return None
