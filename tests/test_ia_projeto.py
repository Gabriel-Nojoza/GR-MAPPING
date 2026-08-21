"""Teste do Passo 5 — geração de projeto por IA (mockado, sem chamar API real)."""
import os
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.ia_projeto as ia_projeto
from app.ia_projeto import (
    gerar_imagem_projeto,
    gerar_video_projeto,
    gerar_projeto,
    GeracaoError,
)


class FakeModels:
    """Substitui client.models: devolve bytes fixos em vez de chamar a API de verdade."""

    def __init__(self):
        self.ultimo_prompt_imagem = None
        self.ultimo_prompt_video = None

    def generate_content(self, model, contents):
        self.ultimo_prompt_imagem = contents[-1]
        parte = SimpleNamespace(inline_data=SimpleNamespace(data=b"imagem-fake", mime_type="image/png"))
        return SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[parte]))])

    def generate_videos(self, model, prompt, image, config):
        self.ultimo_prompt_video = prompt
        video = SimpleNamespace(video_bytes=b"video-fake", mime_type="video/mp4", uri=None)
        resposta = SimpleNamespace(generated_videos=[SimpleNamespace(video=video)])
        return SimpleNamespace(done=True, error=None, response=resposta)  # já "done" -> sem precisar de poll


class FakeClient:
    def __init__(self):
        self.models = FakeModels()
        self.operations = SimpleNamespace(get=lambda op: op)


def _com_client_fake(func):
    """Troca ia_projeto._client por uma versão fake durante o teste."""
    fake = FakeClient()
    original = ia_projeto._client
    ia_projeto._client = lambda: fake
    try:
        func(fake)
    finally:
        ia_projeto._client = original


def test_gerar_imagem_projeto():
    def _teste(fake):
        dados, mime = gerar_imagem_projeto(b"foto-original", "image/jpeg", "casa térrea com piscina")
        assert dados == b"imagem-fake"
        assert mime == "image/png"
        assert "casa térrea com piscina" in fake.models.ultimo_prompt_imagem
    _com_client_fake(_teste)
    print("  [ok] gerar_imagem_projeto devolve a imagem editada")


def test_gerar_video_projeto():
    def _teste(fake):
        dados, mime = gerar_video_projeto(b"imagem-editada", "image/png", "casa térrea com piscina")
        assert dados == b"video-fake"
        assert mime == "video/mp4"
        assert "casa térrea com piscina" in fake.models.ultimo_prompt_video
    _com_client_fake(_teste)
    print("  [ok] gerar_video_projeto devolve o vídeo gerado")


def test_pipeline_completo():
    def _teste(fake):
        resultado = gerar_projeto(b"foto-original", "image/jpeg", "sobrado moderno")
        assert resultado.imagem_bytes == b"imagem-fake"
        assert resultado.video_bytes == b"video-fake"
    _com_client_fake(_teste)
    print("  [ok] pipeline completo (imagem -> vídeo)")


def test_sem_api_key_da_erro_claro():
    tinha = os.environ.pop("GEMINI_API_KEY", None)
    try:
        gerar_imagem_projeto(b"foto", "image/jpeg", "casa")
        assert False, "deveria ter dado erro sem GEMINI_API_KEY"
    except GeracaoError as e:
        assert "GEMINI_API_KEY" in str(e)
        print("  [ok] erro claro quando falta GEMINI_API_KEY")
    finally:
        if tinha is not None:
            os.environ["GEMINI_API_KEY"] = tinha


if __name__ == "__main__":
    print("Passo 5 — geração de projeto por IA")
    test_gerar_imagem_projeto()
    test_gerar_video_projeto()
    test_pipeline_completo()
    test_sem_api_key_da_erro_claro()
    print("\nTODOS OS TESTES PASSARAM ✓")
