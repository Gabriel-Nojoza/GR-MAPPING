"""
Passo 1 — Leitura de metadados de fotos de drone.

O objetivo deste módulo é abrir a foto e extrair os dados que o cálculo
de área precisa:

  - altura de voo (RelativeAltitude, do XMP da DJI) -> alimenta o GSD
  - dados da câmera (foco e largura da imagem) -> alimenta o GSD
  - inclinação do gimbal -> confirma se a foto foi tirada reta pra baixo
  - GPS -> só pra registro/histórico

A DJI grava duas camadas de metadado no JPEG:
  * EXIF  -> foco, dimensões, fabricante/modelo (padrão de qualquer câmera)
  * XMP   -> altitude relativa, gimbal, GPS decimal (específico da DJI,
             no namespace "drone-dji")
"""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from pathlib import Path

from PIL import Image, ExifTags, ImageOps, UnidentifiedImageError


# ----------------------------------------------------------------------
# Estrutura de saída
# ----------------------------------------------------------------------
@dataclass
class PhotoMetadata:
    # câmera (do EXIF)
    focal_length_mm: float | None          # foco real, em mm
    focal_length_35mm: float | None        # foco equivalente a 35mm
    image_width_px: int | None
    image_height_px: int | None
    make: str | None
    model: str | None
    # voo / drone (do XMP da DJI)
    relative_altitude_m: float | None      # altura acima do ponto de decolagem
    absolute_altitude_m: float | None
    gimbal_pitch_deg: float | None         # ~ -90 = nadir (reto pra baixo)
    gps_lat: float | None
    gps_lon: float | None

    def is_nadir(self, tol_deg: float = 5.0) -> bool:
        """True se a câmera estava apontada (quase) reta pra baixo."""
        if self.gimbal_pitch_deg is None:
            return False
        return abs(self.gimbal_pitch_deg + 90.0) <= tol_deg

    def missing_for_gsd(self) -> list[str]:
        """Lista o que falta pra conseguir calcular o GSD."""
        faltando = []
        if self.relative_altitude_m is None:
            faltando.append("relative_altitude_m")
        if self.image_width_px is None:
            faltando.append("image_width_px")
        if self.focal_length_35mm is None and self.focal_length_mm is None:
            faltando.append("focal_length (mm ou 35mm)")
        return faltando

    def as_dict(self) -> dict:
        return asdict(self)


# ----------------------------------------------------------------------
# EXIF
# ----------------------------------------------------------------------
def _read_exif(img: Image.Image) -> dict:
    """Extrai os campos EXIF relevantes de câmera como floats/ints simples."""
    out: dict = {}
    exif = img.getexif()
    if not exif:
        return out

    # topo do EXIF: Make, Model
    top = {ExifTags.TAGS.get(k, k): v for k, v in exif.items()}
    out["make"] = _clean_str(top.get("Make"))
    out["model"] = _clean_str(top.get("Model"))

    # IFD "Exif": foco, dimensões
    try:
        sub = exif.get_ifd(ExifTags.IFD.Exif)
    except Exception:
        sub = {}
    sub = {ExifTags.TAGS.get(k, k): v for k, v in sub.items()}

    # alguns firmwares da DJI gravam 0 em vez de omitir o campo — trata como ausente
    out["focal_length_mm"] = _to_float(sub.get("FocalLength")) or None
    out["focal_length_35mm"] = _to_float(sub.get("FocalLengthIn35mmFilm")) or None

    # usa as dimensões reais do objeto Image (já normalizadas pela orientação
    # EXIF em read_photo_metadata) em vez do PixelXDimension/YDimension, que
    # nem sempre bate com o que o usuário vê e clica no front depois de uma
    # foto em retrato ser auto-rotacionada pelo navegador.
    out["image_width_px"] = img.width
    out["image_height_px"] = img.height
    return out


# ----------------------------------------------------------------------
# XMP (DJI)
# ----------------------------------------------------------------------
def _extract_xmp(path: Path, img: Image.Image) -> str | None:
    """Pega o pacote XMP do JPEG (onde a DJI grava a altitude e o gimbal)."""
    # PIL às vezes já expõe o XMP
    xmp = img.info.get("xmp")
    if isinstance(xmp, bytes):
        xmp = xmp.decode("utf-8", errors="ignore")
    if isinstance(xmp, str) and "drone-dji" in xmp:
        return xmp

    # fallback: varre os bytes crus atrás do pacote XMP
    raw = path.read_bytes()
    start = raw.find(b"<x:xmpmeta")
    end = raw.find(b"</x:xmpmeta>")
    if start != -1 and end != -1:
        return raw[start:end + len(b"</x:xmpmeta>")].decode("utf-8", errors="ignore")
    return None


def _xmp_value(xmp: str, key: str) -> str | None:
    """
    Lê um campo do XMP. A DJI usa duas formas:
      forma atributo:  drone-dji:RelativeAltitude="+52.30"
      forma elemento:  <drone-dji:RelativeAltitude>+52.30</drone-dji:RelativeAltitude>
    """
    # forma atributo
    m = re.search(rf'{re.escape(key)}\s*=\s*"([^"]+)"', xmp)
    if m:
        return m.group(1).strip()
    # forma elemento (com prefixo de namespace qualquer)
    m = re.search(rf"<[\w-]+:{re.escape(key)}>([^<]+)</", xmp)
    if m:
        return m.group(1).strip()
    return None


def _parse_dji_xmp(xmp: str) -> dict:
    return {
        "relative_altitude_m": _to_float(_xmp_value(xmp, "RelativeAltitude")),
        "absolute_altitude_m": _to_float(_xmp_value(xmp, "AbsoluteAltitude")),
        "gimbal_pitch_deg": _to_float(_xmp_value(xmp, "GimbalPitchDegree")),
        "gps_lat": _to_float(_xmp_value(xmp, "GpsLatitude"))
                   or _to_float(_xmp_value(xmp, "Latitude")),
        "gps_lon": _to_float(_xmp_value(xmp, "GpsLongitude"))
                   or _to_float(_xmp_value(xmp, "Longitude")),
    }


# ----------------------------------------------------------------------
# API pública do módulo
# ----------------------------------------------------------------------
def read_photo_metadata(path: str | Path) -> PhotoMetadata:
    """Abre a foto e devolve os metadados prontos pro cálculo de GSD."""
    path = Path(path)
    try:
        with Image.open(path) as img:
            # gira/espelha os pixels conforme a tag de orientação EXIF, pra
            # bater com o jeito que o navegador exibe a foto no front. Sem
            # isso, uma foto tirada em retrato mede a área errada (o usuário
            # marca pontos na imagem já rotacionada, mas o GSD usava as
            # dimensões cruas, sem rotação).
            img = ImageOps.exif_transpose(img)
            exif = _read_exif(img)
            xmp_raw = _extract_xmp(path, img)
    except UnidentifiedImageError as e:
        raise ValueError("o arquivo enviado não é uma imagem válida (JPEG)") from e
    except OSError as e:
        raise ValueError("não consegui ler o arquivo — a foto pode estar corrompida ou incompleta") from e

    dji = _parse_dji_xmp(xmp_raw) if xmp_raw else {}

    return PhotoMetadata(
        focal_length_mm=exif.get("focal_length_mm"),
        focal_length_35mm=exif.get("focal_length_35mm"),
        image_width_px=exif.get("image_width_px"),
        image_height_px=exif.get("image_height_px"),
        make=exif.get("make"),
        model=exif.get("model"),
        relative_altitude_m=dji.get("relative_altitude_m"),
        absolute_altitude_m=dji.get("absolute_altitude_m"),
        gimbal_pitch_deg=dji.get("gimbal_pitch_deg"),
        gps_lat=dji.get("gps_lat"),
        gps_lon=dji.get("gps_lon"),
    )


def dados_foto_voo(path: str | Path) -> dict:
    """
    Extrai o essencial pra posicionar uma foto de voo no mapa:
    GPS, altitude de voo e horário em que a foto foi tirada.
    Tolerante a fotos sem metadado (devolve None nos campos que faltam).
    """
    path = Path(path)
    try:
        md = read_photo_metadata(path)
    except ValueError:
        return {"gps_lat": None, "gps_lon": None, "altitude_m": None, "tirada_em": None}

    tirada_em = None
    try:
        with Image.open(path) as img:
            exif = img.getexif()
            sub = exif.get_ifd(ExifTags.IFD.Exif) if exif else {}
            bruto = sub.get(ExifTags.Base.DateTimeOriginal) or sub.get(36867)
            if isinstance(bruto, str) and ":" in bruto:
                # formato EXIF: "2026:08:31 14:32:10" -> ISO
                data, _, hora = bruto.partition(" ")
                tirada_em = f"{data.replace(':', '-')}T{hora}" if hora else None
    except (OSError, UnidentifiedImageError, ValueError):
        pass

    return {
        "gps_lat": md.gps_lat,
        "gps_lon": md.gps_lon,
        "altitude_m": md.relative_altitude_m,
        "tirada_em": tirada_em,
    }


# ----------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------
def _to_float(v) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _to_int(v) -> int | None:
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _clean_str(v) -> str | None:
    if v is None:
        return None
    return str(v).strip("\x00 ").strip() or None