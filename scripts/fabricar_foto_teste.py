"""
Gera uma foto JPEG de teste com GPS gravado no EXIF (padrão de celular, não
DJI), pra testar manualmente o avanço de obras lineares sem precisar ir a
campo com o drone. Usa a mesma técnica de tests/test_progresso_linear.py.

Uso:
    python scripts/fabricar_foto_teste.py <latitude> <longitude> [caminho_saida.jpg]

Exemplo (ponto a ~100m do início de uma rota que vai de -3.850000 até
-3.854492, mesma longitude):
    python scripts/fabricar_foto_teste.py -3.8508984 -38.650000 foto_100m.jpg
"""
from __future__ import annotations

import sys

import piexif
from PIL import Image


def _dms(valor: float) -> list[tuple[int, int]]:
    valor = abs(valor)
    graus = int(valor)
    minutos = int((valor - graus) * 60)
    segundos = (valor - graus - minutos / 60) * 3600
    return [(graus, 1), (minutos, 1), (int(segundos * 100), 100)]


def fabricar_foto(caminho: str, lat: float, lon: float) -> None:
    Image.new("RGB", (800, 600), (100, 120, 90)).save(caminho, "JPEG")
    gps_ifd = {
        piexif.GPSIFD.GPSLatitudeRef: b"N" if lat >= 0 else b"S",
        piexif.GPSIFD.GPSLatitude: _dms(lat),
        piexif.GPSIFD.GPSLongitudeRef: b"E" if lon >= 0 else b"W",
        piexif.GPSIFD.GPSLongitude: _dms(lon),
    }
    piexif.insert(piexif.dump({"GPS": gps_ifd}), caminho)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    lat_arg, lon_arg = float(sys.argv[1]), float(sys.argv[2])
    saida = sys.argv[3] if len(sys.argv) > 3 else "foto_teste.jpg"
    fabricar_foto(saida, lat_arg, lon_arg)
    print(f"foto criada: {saida}  (GPS {lat_arg}, {lon_arg})")
