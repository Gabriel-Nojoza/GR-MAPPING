"""
Teste do Passo 1.

Como ainda não temos uma foto real do drone, sintetizamos um JPEG com
o mesmo formato de EXIF + XMP que a DJI grava, e conferimos se o módulo
extrai os campos certos.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import piexif
from PIL import Image

from app.metadata import read_photo_metadata, _parse_dji_xmp

# XMP no mesmo formato que a DJI escreve (namespace drone-dji)
DJI_XMP = """<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:drone-dji="http://www.dji.com/drone-dji/1.0/"
    drone-dji:AbsoluteAltitude="+549.20"
    drone-dji:RelativeAltitude="+100.30"
    drone-dji:GimbalPitchDegree="-90.00"
    drone-dji:GpsLatitude="-3.73211100"
    drone-dji:GpsLongitude="-38.52667800"/>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"""


def _make_fake_drone_photo(path: Path):
    """Cria um JPEG 4000x3000 com EXIF de câmera + XMP da DJI."""
    img = Image.new("RGB", (4000, 3000), (120, 130, 110))
    img.save(path, "JPEG", xmp=DJI_XMP.encode("utf-8"))

    exif = {
        "0th": {
            piexif.ImageIFD.Make: b"DJI",
            piexif.ImageIFD.Model: b"DJI Mini 4K",
        },
        "Exif": {
            piexif.ExifIFD.FocalLength: (450, 100),          # 4.50 mm
            piexif.ExifIFD.FocalLengthIn35mmFilm: 24,        # 24 mm equiv
            piexif.ExifIFD.PixelXDimension: 4000,
            piexif.ExifIFD.PixelYDimension: 3000,
        },
    }
    piexif.insert(piexif.dump(exif), str(path))


def test_parser_xmp_isolado():
    d = _parse_dji_xmp(DJI_XMP)
    assert d["relative_altitude_m"] == 100.30
    assert d["gimbal_pitch_deg"] == -90.00
    assert d["gps_lat"] == -3.732111
    assert d["gps_lon"] == -38.526678
    print("  [ok] parser de XMP isolado")


def _make_fake_rotated_photo(path: Path):
    """JPEG gravado com o buffer de pixels 'deitado' (4000x3000) mas com
    Orientation=6 (gira 90° ao exibir) — simula uma foto tirada em retrato,
    que é como o navegador vai mostrar pro usuário marcar os pontos."""
    img = Image.new("RGB", (4000, 3000), (120, 130, 110))
    img.save(path, "JPEG")
    exif = {"0th": {piexif.ImageIFD.Orientation: 6},
            "Exif": {piexif.ExifIFD.FocalLengthIn35mmFilm: 24,
                     piexif.ExifIFD.PixelXDimension: 4000,
                     piexif.ExifIFD.PixelYDimension: 3000}}
    piexif.insert(piexif.dump(exif), str(path))


def test_orientacao_retrato_troca_dimensoes(tmp: Path):
    photo = tmp / "retrato.jpg"
    _make_fake_rotated_photo(photo)

    md = read_photo_metadata(photo)

    # depois de aplicar a rotação da orientação EXIF, o que era 4000x3000
    # no buffer cru vira 3000x4000 — do jeito que o usuário vê na tela
    assert md.image_width_px == 3000
    assert md.image_height_px == 4000
    print("  [ok] orientação EXIF em retrato troca largura/altura corretamente")


def test_arquivo_invalido_da_erro_claro(tmp: Path):
    arquivo = tmp / "nao_e_foto.jpg"
    arquivo.write_bytes(b"isso aqui nao e um jpeg")

    try:
        read_photo_metadata(arquivo)
        assert False, "deveria ter rejeitado arquivo inválido"
    except ValueError as e:
        assert "imagem" in str(e)
        print("  [ok] arquivo inválido dá erro claro (não quebra com traceback)")


def test_leitura_completa(tmp: Path):
    photo = tmp / "voo_teste.jpg"
    _make_fake_drone_photo(photo)

    md = read_photo_metadata(photo)

    assert md.model == "DJI Mini 4K"
    assert md.image_width_px == 4000
    assert md.image_height_px == 3000
    assert md.focal_length_mm == 4.5
    assert md.focal_length_35mm == 24.0
    assert md.relative_altitude_m == 100.30
    assert md.is_nadir() is True           # gimbal em -90
    assert md.missing_for_gsd() == []      # tem tudo pro GSD
    print("  [ok] leitura completa (EXIF + XMP)")
    return md


if __name__ == "__main__":
    import tempfile

    print("Passo 1 — leitura de metadados")
    test_parser_xmp_isolado()
    with tempfile.TemporaryDirectory() as d:
        md = test_leitura_completa(Path(d))
        test_orientacao_retrato_troca_dimensoes(Path(d))
        test_arquivo_invalido_da_erro_claro(Path(d))

    print("\nMetadado lido da foto de teste:")
    for k, v in md.as_dict().items():
        print(f"  {k:22} = {v}")
    print(f"\n  nadir? {md.is_nadir()}   | falta pro GSD: {md.missing_for_gsd() or 'nada'}")
    print("\nTODOS OS TESTES PASSARAM ✓")