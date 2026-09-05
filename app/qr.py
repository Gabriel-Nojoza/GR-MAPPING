"""
Leitura de QR codes nas fotos de voo do drone.

Cada máquina leva uma etiqueta com o QR gerado pelo sistema, no formato
``GRM:<id_da_maquina>``. Ao subir as fotos de um voo, este módulo tenta
achar e decodificar esses QRs pra posicionar a máquina automaticamente.

Usa o detector WeChat do OpenCV (bem melhor que o padrão pra QR pequeno /
com pouca luz, como foto aérea). É best-effort: sem OpenCV ou sem leitura,
a marcação pode ser feita na mão pelo mapa.
"""
from __future__ import annotations

from pathlib import Path

try:
    import cv2  # type: ignore
    import numpy as np  # type: ignore
except ImportError:
    cv2 = None
    np = None

PREFIXO = "GRM:"
_WECHAT = None

# tamanhos-alvo (lado maior, em px) tentados em ordem. Fotos de drone reais
# já vêm enormes (4000px+) — upscale por MULTIPLICADOR fixo (ex.: x3) nelas
# explode pra imagens gigantescas (12000px+) e o WeChatQRCode passa minutos
# rodando à toa quando não acha QR nenhum (o caso mais comum: a maioria das
# fotos de um voo não está centrada numa máquina). Redimensionar pra um
# tamanho-alvo ABSOLUTO mantém o custo previsível não importa a resolução
# de origem (encolhe foto grande, aumenta foto pequena).
_ALVOS_LADO_MAIOR = (1600, 2800, 4200)


def disponivel() -> bool:
    return cv2 is not None


def _wechat():
    global _WECHAT
    if _WECHAT is None and cv2 is not None and hasattr(cv2, "wechat_qrcode"):
        try:
            _WECHAT = cv2.wechat_qrcode.WeChatQRCode()
        except cv2.error:
            _WECHAT = False
    return _WECHAT or None


def _redimensionar_para_lado_maior(imagem, alvo_lado_maior: int):
    """Reescala pra que o lado maior fique perto de `alvo_lado_maior`px (encolhe OU aumenta)."""
    h, w = imagem.shape[:2]
    atual = max(h, w)
    if atual == 0:
        return imagem, 1.0
    escala = alvo_lado_maior / atual
    if abs(escala - 1.0) < 0.02:
        return imagem, 1.0
    interp = cv2.INTER_CUBIC if escala > 1.0 else cv2.INTER_AREA
    return cv2.resize(imagem, None, fx=escala, fy=escala, interpolation=interp), escala


def ler_qrs(caminho: str | Path) -> list[dict]:
    """
    QRs encontrados: [{"texto", "cx", "cy", "largura_px", "altura_px"}].
    cx/cy é o centro do QR em pixels da imagem.
    """
    if cv2 is None or np is None:
        return []
    imagem = cv2.imread(str(caminho))
    if imagem is None:
        return []
    h, w = imagem.shape[:2]
    achados: list[dict] = []

    wq = _wechat()
    if wq is not None:
        for alvo in _ALVOS_LADO_MAIOR:
            img, escala = _redimensionar_para_lado_maior(imagem, alvo)
            try:
                textos, pontos = wq.detectAndDecode(img)
            except cv2.error:
                textos, pontos = [], []
            for i, texto in enumerate(textos):
                if not texto:
                    continue
                cx = cy = None
                if pontos is not None and i < len(pontos):
                    quad = np.array(pontos[i]).reshape(-1, 2) / escala
                    cx, cy = float(quad[:, 0].mean()), float(quad[:, 1].mean())
                achados.append({"texto": texto.strip(), "cx": cx, "cy": cy, "largura_px": w, "altura_px": h})
            if achados:
                break

    if not achados:  # fallback pro detector padrão
        det = cv2.QRCodeDetector()
        try:
            ok, textos, pontos, _ = det.detectAndDecodeMulti(imagem)
        except cv2.error:
            ok, textos, pontos = False, [], None
        if ok and pontos is not None:
            for texto, quad in zip(textos, pontos):
                if texto:
                    xs, ys = [p[0] for p in quad], [p[1] for p in quad]
                    achados.append({"texto": texto.strip(), "cx": float(sum(xs) / len(xs)),
                                    "cy": float(sum(ys) / len(ys)), "largura_px": w, "altura_px": h})

    # remove duplicados pelo texto
    vistos, unicos = set(), []
    for a in achados:
        if a["texto"] not in vistos:
            vistos.add(a["texto"])
            unicos.append(a)
    return unicos


def id_maquina(texto: str) -> str | None:
    texto = (texto or "").strip()
    if texto.startswith(PREFIXO):
        return texto[len(PREFIXO):].strip() or None
    return None
