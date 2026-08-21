"""Teste do Passo 4 — a API completa, ponta a ponta."""
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import piexif
from PIL import Image
from fastapi.testclient import TestClient

import app.main as main_module
from app.ia_projeto import GeracaoError
from app.main import app

client = TestClient(app)

DJI_XMP = ('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF '
           'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
           '<rdf:Description rdf:about="" '
           'xmlns:drone-dji="http://www.dji.com/drone-dji/1.0/" '
           'drone-dji:RelativeAltitude="+100.00" '
           'drone-dji:GimbalPitchDegree="-90.00"/></rdf:RDF></x:xmpmeta>')


def _foto_drone_bytes() -> bytes:
    """Gera uma foto de drone de teste (4000x3000, foco 24mm, 100m)."""
    buf = io.BytesIO()
    img = Image.new("RGB", (4000, 3000), (120, 130, 110))
    img.save(buf, "JPEG", xmp=DJI_XMP.encode("utf-8"))
    exif = {"Exif": {piexif.ExifIFD.FocalLengthIn35mmFilm: 24,
                     piexif.ExifIFD.PixelXDimension: 4000,
                     piexif.ExifIFD.PixelYDimension: 3000}}
    dados = buf.getvalue()
    buf2 = io.BytesIO()
    piexif.insert(piexif.dump(exif), dados, buf2)
    return buf2.getvalue()


def test_saude():
    assert client.get("/saude").json() == {"status": "ok"}
    print("  [ok] /saude")


def test_analisar():
    r = client.post("/analisar",
                    files={"foto": ("voo.jpg", _foto_drone_bytes(), "image/jpeg")})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["gsd_cm_por_px"] == 3.75
    assert d["altura_voo_m"] == 100.0
    print(f"  [ok] /analisar -> {d['gsd_cm_por_px']} cm/px, "
          f"cobre {d['cobertura_hectares']} ha")


def test_medir():
    # polígono cobrindo a foto inteira: 4000x3000 px @ 3.75cm = 1.6875 ha
    pontos = json.dumps([[0, 0], [4000, 0], [4000, 3000], [0, 3000]])
    r = client.post("/medir",
                    files={"foto": ("voo.jpg", _foto_drone_bytes(), "image/jpeg")},
                    data={"pontos": pontos})
    assert r.status_code == 200, r.text
    d = r.json()
    assert abs(d["area_hectares"] - 1.6875) < 1e-3
    print(f"  [ok] /medir -> {d['resumo']}  (perímetro {d['perimetro_m']} m)")


def test_analisar_arquivo_invalido():
    r = client.post("/analisar",
                    files={"foto": ("nao_e_foto.jpg", b"lixo, nao e um jpeg", "image/jpeg")})
    assert r.status_code == 422, r.text
    print("  [ok] /analisar rejeita arquivo inválido com erro 422 (não 500)")


def test_gerar_projeto_sucesso():
    # troca a chamada real à IA por uma fake, só pra testar o fluxo da API
    original_imagem = main_module.gerar_imagem_projeto
    original_video = main_module.gerar_video_projeto
    main_module.gerar_imagem_projeto = lambda foto_bytes, foto_mime, descricao: (b"imagem-fake", "image/png")
    main_module.gerar_video_projeto = lambda imagem_bytes, imagem_mime, descricao: (b"video-fake", "video/mp4")
    try:
        r = client.post("/gerar-projeto",
                        files={"foto": ("terreno.jpg", _foto_drone_bytes(), "image/jpeg")},
                        data={"descricao": "casa térrea com piscina"})
        assert r.status_code == 200, r.text
        job_id = r.json()["job_id"]

        s = client.get(f"/gerar-projeto/{job_id}")
        assert s.status_code == 200, s.text
        assert s.json()["status"] == "pronto", s.json()

        v = client.get(f"/gerar-projeto/{job_id}/video")
        assert v.status_code == 200
        assert v.content == b"video-fake"

        i = client.get(f"/gerar-projeto/{job_id}/imagem")
        assert i.status_code == 200
        assert i.content == b"imagem-fake"
        print("  [ok] /gerar-projeto -> job processa e devolve imagem + vídeo")
    finally:
        main_module.gerar_imagem_projeto = original_imagem
        main_module.gerar_video_projeto = original_video


def test_gerar_projeto_propaga_erro_da_ia():
    original_imagem = main_module.gerar_imagem_projeto

    def _falha(foto_bytes, foto_mime, descricao):
        raise GeracaoError("GEMINI_API_KEY não configurada")

    main_module.gerar_imagem_projeto = _falha
    try:
        r = client.post("/gerar-projeto",
                        files={"foto": ("terreno.jpg", _foto_drone_bytes(), "image/jpeg")},
                        data={"descricao": "casa térrea"})
        job_id = r.json()["job_id"]

        s = client.get(f"/gerar-projeto/{job_id}")
        assert s.json()["status"] == "erro"
        assert "GEMINI_API_KEY" in s.json()["erro"]
        print("  [ok] /gerar-projeto propaga erro da IA pro status do job (não derruba a API)")
    finally:
        main_module.gerar_imagem_projeto = original_imagem


def test_gerar_projeto_sem_descricao():
    r = client.post("/gerar-projeto",
                    files={"foto": ("terreno.jpg", _foto_drone_bytes(), "image/jpeg")},
                    data={"descricao": "  "})
    assert r.status_code == 400
    print("  [ok] /gerar-projeto exige uma descrição do projeto")


def test_gerar_projeto_job_inexistente():
    r = client.get("/gerar-projeto/id-que-nao-existe")
    assert r.status_code == 404
    print("  [ok] /gerar-projeto/{job_id} devolve 404 pra job inexistente")


def test_medir_poligono_ruim():
    pontos = json.dumps([[0, 0], [100, 100], [100, 0], [0, 100]])  # se cruza
    r = client.post("/medir",
                    files={"foto": ("voo.jpg", _foto_drone_bytes(), "image/jpeg")},
                    data={"pontos": pontos})
    assert r.status_code == 400
    print("  [ok] /medir rejeita polígono inválido com erro 400")


if __name__ == "__main__":
    print("Passo 4 — API completa")
    test_saude()
    test_analisar()
    test_analisar_arquivo_invalido()
    test_medir()
    test_medir_poligono_ruim()
    test_gerar_projeto_sucesso()
    test_gerar_projeto_propaga_erro_da_ia()
    test_gerar_projeto_sem_descricao()
    test_gerar_projeto_job_inexistente()
    print("\nTODOS OS TESTES PASSARAM \u2713")