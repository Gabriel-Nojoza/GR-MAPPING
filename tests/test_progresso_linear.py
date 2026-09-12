"""
Prova de conceito do avanço de obras lineares: importa/desenha uma rota,
sobe duas capturas com GPS em pontos diferentes da rota, e confere que o
sistema detecta corretamente até onde chegou e quantos metros avançou.
"""
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import piexif
from PIL import Image
from fastapi.testclient import TestClient

from app import clima as clima_module
from app.main import app

client = TestClient(app)

LAT0, LON0 = -3.850000, -38.650000
LAT1 = LAT0 - 500 / 111320  # ~500 m ao sul, longitude constante — rota reta de teste


def _sem_rede(*args, **kwargs):
    """Evita depender da Open-Meteo de verdade durante o teste automatizado —
    o resto do cálculo (posição/avanço) não depende do clima pra funcionar."""
    return []


def _foto_com_gps(lat: float, lon: float) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (800, 600), (100, 120, 90)).save(buf, "JPEG")
    dados = buf.getvalue()

    def dms(v: float):
        v = abs(v)
        d = int(v)
        m = int((v - d) * 60)
        s = (v - d - m / 60) * 3600
        return [(d, 1), (m, 1), (int(s * 100), 100)]

    gps = {
        piexif.GPSIFD.GPSLatitudeRef: b"N" if lat >= 0 else b"S",
        piexif.GPSIFD.GPSLatitude: dms(lat),
        piexif.GPSIFD.GPSLongitudeRef: b"E" if lon >= 0 else b"W",
        piexif.GPSIFD.GPSLongitude: dms(lon),
    }
    buf2 = io.BytesIO()
    piexif.insert(piexif.dump({"GPS": gps}), dados, buf2)
    return buf2.getvalue()


def test_avanco_detectado_entre_duas_capturas(monkeypatch):
    monkeypatch.setattr(clima_module, "buscar_historico", _sem_rede)
    monkeypatch.setattr(clima_module, "buscar_previsao", _sem_rede)

    r = client.post("/eng/recursos/obra", json={"nome": "Rua Teste POC", "dados": {
        "localizacao_lat": str(LAT0), "localizacao_lon": str(LON0),
    }})
    assert r.status_code == 200, r.text
    obra_id = r.json()["id"]

    r = client.post("/eng/frentes", json={
        "obra_id": obra_id, "nome": "Trecho POC",
        "geojson": {"type": "LineString", "coordinates": [[LON0, LAT0], [LON0, LAT1]]},
        "extensao_prevista_m": 500.0,
    })
    assert r.status_code == 200, r.text
    frente_id = r.json()["id"]

    # captura 1 (manhã): equipe a ~100 m do início da rota
    r = client.post("/eng/voos", json={"obra_id": obra_id, "data": "2024-01-01", "turno": "Manhã"})
    voo1 = r.json()["id"]
    lat_100 = LAT0 + 0.2 * (LAT1 - LAT0)
    r = client.post(f"/eng/voos/{voo1}/fotos",
                    files={"fotos": ("foto1.jpg", _foto_com_gps(lat_100, LON0), "image/jpeg")})
    assert r.status_code == 200, r.text

    foto1 = client.get(f"/eng/voos/{voo1}").json()["fotos"][0]
    assert foto1["frente_id"] == frente_id
    assert abs(foto1["progressiva_m"] - 100.0) < 2
    print(f"  [ok] captura 1 (~100 m marcados) -> progressiva {foto1['progressiva_m']} m")

    # captura 2 (dia seguinte): equipe avançou até ~300 m
    r = client.post("/eng/voos", json={"obra_id": obra_id, "data": "2024-01-02", "turno": "Manhã"})
    voo2 = r.json()["id"]
    lat_300 = LAT0 + 0.6 * (LAT1 - LAT0)
    r = client.post(f"/eng/voos/{voo2}/fotos",
                    files={"fotos": ("foto2.jpg", _foto_com_gps(lat_300, LON0), "image/jpeg")})
    assert r.status_code == 200, r.text

    foto2 = client.get(f"/eng/voos/{voo2}").json()["fotos"][0]
    assert abs(foto2["progressiva_m"] - 300.0) < 2
    print(f"  [ok] captura 2 (~300 m marcados) -> progressiva {foto2['progressiva_m']} m")

    # o painel de avanço linear tem que enxergar os 300 m como o executado
    r = client.get(f"/eng/obras/{obra_id}/avanco-linear")
    assert r.status_code == 200, r.text
    d = r.json()
    assert abs(d["executado_m"] - 300.0) < 2
    assert d["extensao_total_m"] == 500.0
    assert len(d["trechos"]) == 1 and abs(d["trechos"][0]["executado_m"] - 300.0) < 2
    assert len(d["historico_diario"]) == 2
    avanco_dia2 = d["historico_diario"][1]["avanco_dia_m"]
    assert abs(avanco_dia2 - 200.0) < 3, f"esperava ~200 m de avanço entre as capturas, veio {avanco_dia2}"
    print(f"  [ok] avanço detectado entre as duas capturas: {avanco_dia2} m (esperado ~200 m)")


_KML_EXEMPLO = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Rota Exemplo</name>
  <Folder>
    <name>TRECHO DN300 - TESTE</name>
    <Placemark>
      <name>ALINHAMENTO</name>
      <LineString><coordinates>{lon0},{lat0},0 {lon1},{lat1},0</coordinates></LineString>
    </Placemark>
    <Folder>
      <name>ESTACAS</name>
      <Placemark>
        <name>E0</name>
        <ExtendedData><SchemaData>
          <SimpleData name="c1">E0</SimpleData>
          <SimpleData name="c2">0+00.00</SimpleData>
          <SimpleData name="c3">0</SimpleData>
          <SimpleData name="c4">0</SimpleData>
          <SimpleData name="c5">50.0</SimpleData>
          <SimpleData name="c6">48.5</SimpleData>
          <SimpleData name="c7">1.5</SimpleData>
        </SchemaData></ExtendedData>
        <Point><coordinates>{lon0},{lat0},50.0</coordinates></Point>
      </Placemark>
    </Folder>
  </Folder>
</Document>
</kml>""".format(lon0=LON0, lat0=LAT0, lon1=LON0, lat1=LAT1)


def test_importar_kmz_cria_trechos_com_extensao_esperada():
    r = client.post("/eng/recursos/obra", json={"nome": "Obra KMZ Teste", "dados": {}})
    obra_id = r.json()["id"]

    r = client.post(f"/eng/obras/{obra_id}/rota/kmz",
                    files={"arquivo": ("rota.kml", _KML_EXEMPLO.encode("utf-8"), "application/vnd.google-earth.kml+xml")})
    assert r.status_code == 200, r.text
    resultado = r.json()
    assert resultado["trechos_importados"] == 1
    assert abs(resultado["extensao_total_m"] - 500.0) < 2

    frentes = client.get("/eng/frentes", params={"obra_id": obra_id}).json()
    assert len(frentes) == 1
    trecho = frentes[0]
    assert trecho["nome"] == "TRECHO DN300 - TESTE"
    assert trecho["diametro_mm"] == 300.0
    assert len(trecho["estacas"]) == 1
    assert trecho["estacas"][0]["cota_tn"] == 50.0
    print(f"  [ok] KMZ importado: {resultado['trechos_importados']} trecho(s), "
          f"{resultado['extensao_total_m']} m")
