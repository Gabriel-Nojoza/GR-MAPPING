"""
Teste manual, com custo real: chama a API de verdade (não mockada) pra
confirmar que a conta tem acesso aos modelos de imagem e vídeo.

Rodar da raiz do projeto:
    .venv\\Scripts\\python.exe scripts\\teste_real_ia.py
"""
import io
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from dotenv import load_dotenv
load_dotenv(RAIZ / ".env")

from PIL import Image, ImageDraw

from app.ia_projeto import gerar_imagem_projeto, gerar_video_projeto, GeracaoError

SAIDA = Path(__file__).parent


def _foto_terreno_sintetica() -> bytes:
    """Desenha um 'terreno' simples visto de cima (retângulo verde com uma
    trilha de terra), só pra ter algo plausível pra IA editar."""
    img = Image.new("RGB", (1024, 768), (74, 124, 60))  # verde grama
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 1024, 768], outline=(50, 90, 40), width=8)
    d.polygon([(100, 700), (300, 200), (400, 200), (250, 700)], fill=(150, 120, 90))  # trilha de terra
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    return buf.getvalue()


def main():
    descricao = "casa térrea moderna com piscina e telhado plano"
    print(f"Descrição usada: {descricao}")

    print("\n[1/2] Gerando imagem do projeto (Nano Banana Pro)...")
    t0 = time.time()
    try:
        imagem_bytes, imagem_mime = gerar_imagem_projeto(
            _foto_terreno_sintetica(), "image/jpeg", descricao
        )
    except GeracaoError as e:
        print(f"ERRO na geração de imagem: {e}")
        return
    print(f"  ok em {time.time()-t0:.1f}s -> {len(imagem_bytes)} bytes, mime={imagem_mime}")

    caminho_imagem = SAIDA / "projeto_gerado.png"
    caminho_imagem.write_bytes(imagem_bytes)
    print(f"  salvo em {caminho_imagem}")

    print("\n[2/2] Gerando vídeo (Veo 3.1 Fast) — pode levar alguns minutos...")
    t0 = time.time()
    try:
        video_bytes, video_mime = gerar_video_projeto(imagem_bytes, imagem_mime, descricao)
    except GeracaoError as e:
        print(f"ERRO na geração de vídeo: {e}")
        return
    print(f"  ok em {time.time()-t0:.1f}s -> {len(video_bytes)} bytes, mime={video_mime}")

    caminho_video = SAIDA / "projeto_gerado.mp4"
    caminho_video.write_bytes(video_bytes)
    print(f"  salvo em {caminho_video}")

    print("\nTESTE REAL PASSOU DE PONTA A PONTA")


if __name__ == "__main__":
    main()
