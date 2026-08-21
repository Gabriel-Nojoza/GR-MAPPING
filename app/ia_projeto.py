"""
Passo 5 — Geração do projeto por IA a partir da foto do terreno.

Fluxo em duas etapas (uma foto de terreno vazio não vira sobrevoo de uma
casa pronta só de animar — é preciso primeiro "construir" a casa na foto):

  1) Nano Banana Pro (Gemini, modelo de imagem) edita a foto aérea do
     terreno pra mostrar como ficaria com a construção descrita.
  2) Veo 3.1 anima essa imagem editada num vídeo de sobrevoo/tour.

Precisa da env var GEMINI_API_KEY (crie uma em
https://aistudio.google.com/apikey).
"""
from __future__ import annotations

import os
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

from google import genai
from google.genai import types

IMAGE_MODEL = "gemini-2.5-flash-image"
VIDEO_MODEL = "veo-3.1-fast-generate-preview"
VIDEO_DURATION_S = 8  # limite máximo aceito pelo veo-3.1-fast-generate-preview (min 4, max 8)
POLL_INTERVAL_S = 10

_INSTRUCAO_CAMERA_FRONTAL = (
    "INSTRUÇÃO PRIORITÁRIA DE CÂMERA: gere a casa vista de frente, a partir da rua, "
    "em perspectiva levemente elevada e inclinada. Não use visão vertical de cima, "
    "planta baixa, maquete ou corte aberto. Preserve o formato e a posição do lote, "
    "mas mude a câmera da foto aérea original para mostrar claramente a fachada principal."
)

_PROMPT_IMAGEM = (
    "Edite esta foto aérea de um terreno para mostrar como ele ficaria "
    "depois de construído: {descricao}. Mantenha o mesmo ângulo de câmera, "
    "a mesma perspectiva aérea e a mesma iluminação da foto original, e "
    "encaixe a construção de forma realista dentro dos limites do terreno "
    "mostrado na imagem."
)

_PROMPT_IMAGEM_COM_REFERENCIA = (
    "A primeira imagem é a foto aérea de um terreno. A segunda imagem é uma "
    "referência de estilo arquitetônico. Edite a primeira imagem para "
    "mostrar como o terreno ficaria construído: {descricao}. Use a segunda "
    "imagem SÓ como referência de estilo — cores, materiais, formas da "
    "fachada e acabamento parecidos com ela — mas adapte a construção ao "
    "formato, às dimensões e aos limites reais do terreno mostrado na "
    "primeira imagem. IMPORTANTE: não copie o ângulo de câmera nem a "
    "perspectiva da segunda imagem (que pode estar de frente ou em ângulo "
    "elevado) — a construção final tem que aparecer vista de cima, no "
    "mesmo ângulo aéreo reto da primeira foto, nunca inclinada ou de "
    "frente como na foto de referência. Mantenha o mesmo ângulo de câmera, "
    "a mesma perspectiva aérea e "
    "a mesma iluminação da foto original do terreno."
)

_PROMPT_VIDEO = (
    "Sobrevoo aéreo suave de drone sobre a propriedade mostrada na imagem, "
    "câmera circulando lentamente e revelando o projeto: {descricao}. "
    "Movimento de câmera cinematográfico, estável, iluminação natural "
    "realista, sem cortes bruscos."
)

# Etapas da "evolução da obra": cada uma reaproveita a mesma descrição da
# casa (pra manter a aparência consistente entre os vídeos) e acrescenta o
# estágio de construção que a imagem/vídeo daquela etapa deve mostrar.
ETAPAS_EVOLUCAO = [
    (
        "fundacao",
        "Fundação",
        "Mostre apenas a fundação e o contrapiso da obra recém concluídos, "
        "terreno ao redor ainda com terra exposta e entulho, nenhuma parede "
        "ou estrutura construída ainda.",
    ),
    (
        "estrutura",
        "Estrutura",
        "Mostre a estrutura em concreto armado já erguida — pilares, vigas "
        "e lajes visíveis e crus — sem alvenaria, sem telhado, sem "
        "esquadrias, obra ainda em fase bruta.",
    ),
    (
        "alvenaria",
        "Alvenaria e telhado",
        "Mostre as paredes já fechadas em alvenaria e o telhado já "
        "instalado, mas sem pintura, sem esquadrias de vidro colocadas e "
        "sem acabamento externo — reboco ainda cru e aparente.",
    ),
    (
        "acabamento",
        "Acabamento final",
        "Mostre o projeto pronto, com acabamento final completo: pintura, "
        "esquadrias, revestimentos e paisagismo já concluídos.",
    ),
]


def descricao_da_etapa(descricao_base: str, sufixo_etapa: str) -> str:
    """Junta a descrição da casa com o estágio de construção da etapa."""
    return f"{descricao_base.strip()}. {sufixo_etapa}"


class GeracaoError(RuntimeError):
    """Erro ao gerar a imagem/vídeo do projeto (chave ausente, IA recusou, etc.)."""


@dataclass
class ProjetoGerado:
    imagem_bytes: bytes
    imagem_mime: str
    video_bytes: bytes
    video_mime: str


def _client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise GeracaoError(
            "GEMINI_API_KEY não configurada no servidor. Crie uma chave em "
            "https://aistudio.google.com/apikey e defina a variável de ambiente."
        )
    return genai.Client(api_key=api_key)


def gerar_imagem_projeto(
    foto_bytes: bytes,
    foto_mime: str,
    descricao: str,
    referencia_bytes: bytes | None = None,
    referencia_mime: str | None = None,
) -> tuple[bytes, str]:
    """
    Etapa A: edita a foto do terreno pra mostrar o projeto construído.

    Se `referencia_bytes` for informado, manda uma segunda imagem (ex: foto
    de uma casa pronta) pra IA usar como referência de estilo/fachada, em
    vez de inventar a aparência da construção sozinha.
    """
    client = _client()

    if referencia_bytes and referencia_mime:
        prompt = _PROMPT_IMAGEM_COM_REFERENCIA.format(descricao=descricao) + "\n\n" + _INSTRUCAO_CAMERA_FRONTAL
        contents = [
            types.Part.from_bytes(data=foto_bytes, mime_type=foto_mime),
            types.Part.from_bytes(data=referencia_bytes, mime_type=referencia_mime),
            prompt,
        ]
    else:
        prompt = _PROMPT_IMAGEM.format(descricao=descricao) + "\n\n" + _INSTRUCAO_CAMERA_FRONTAL
        contents = [
            types.Part.from_bytes(data=foto_bytes, mime_type=foto_mime),
            prompt,
        ]

    resposta = client.models.generate_content(
        model=IMAGE_MODEL,
        contents=contents,
    )

    candidatos = resposta.candidates or []
    partes = candidatos[0].content.parts if candidatos and candidatos[0].content else []
    for parte in partes:
        if parte.inline_data is not None:
            return parte.inline_data.data, parte.inline_data.mime_type

    raise GeracaoError(
        "a IA não devolveu uma imagem — tente descrever o projeto de outro jeito."
    )


def gerar_video_projeto(
    imagem_bytes: bytes, imagem_mime: str, descricao: str
) -> tuple[bytes, str, types.Video]:
    """
    Etapa B: anima a imagem do projeto construído num vídeo de sobrevoo.

    Devolve também o objeto `Video` da API (não só os bytes) — é ele que
    precisa ser reaproveitado depois em `estender_video_projeto` pra
    conseguir estender esse mesmo vídeo.
    """
    client = _client()
    prompt = (
        _PROMPT_VIDEO.format(descricao=descricao)
        + "\n\nComece pela fachada frontal da casa. Mantenha a mesma casa, posição, "
        "proporções e materiais durante todo o vídeo. Não volte para uma visão vertical de cima "
        "e não invente ou altere a arquitetura."
    )
    imagem = types.Image(image_bytes=imagem_bytes, mime_type=imagem_mime)

    operacao = client.models.generate_videos(
        model=VIDEO_MODEL,
        prompt=prompt,
        image=imagem,
        config=types.GenerateVideosConfig(
            number_of_videos=1,
            duration_seconds=VIDEO_DURATION_S,
        ),
    )

    video, video_bytes, video_mime = _aguardar_e_baixar_video(client, operacao)
    return video_bytes, video_mime, video


def gerar_video_local(imagem_bytes: bytes, imagem_mime: str) -> tuple[bytes, str]:
    """Cria um vídeo de apresentação local, sem consumir créditos do Veo."""
    extensao = ".png" if imagem_mime == "image/png" else ".jpg"
    with tempfile.TemporaryDirectory(prefix="gr-mapping-video-") as diretorio:
        entrada = Path(diretorio) / f"projeto{extensao}"
        saida = Path(diretorio) / "projeto.mp4"
        entrada.write_bytes(imagem_bytes)

        filtro = (
            "scale=1280:720:force_original_aspect_ratio=increase,"
            "crop=1280:720,"
            "zoompan=z='min(zoom+0.0007,1.14)':d=192:s=1280x720:fps=24"
        )
        comando = [
            "ffmpeg", "-y", "-loop", "1", "-i", str(entrada), "-vf", filtro,
            "-t", str(VIDEO_DURATION_S), "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", str(saida),
        ]
        try:
            resultado = subprocess.run(comando, capture_output=True, text=True, timeout=90)
        except FileNotFoundError as erro:
            raise GeracaoError("FFmpeg não está instalado no servidor.") from erro
        except subprocess.TimeoutExpired as erro:
            raise GeracaoError("o vídeo local demorou mais que o esperado para ser criado.") from erro

        if resultado.returncode != 0 or not saida.exists():
            detalhe = resultado.stderr.strip().splitlines()[-1] if resultado.stderr else "erro desconhecido"
            raise GeracaoError(f"não consegui montar o vídeo local: {detalhe}")
        return saida.read_bytes(), "video/mp4"


EXTENSAO_INCREMENTO_S = 7
EXTENSAO_DURACAO_MAXIMA_S = 148


def estender_video_projeto(
    video_anterior: types.Video, descricao: str
) -> tuple[bytes, str, types.Video]:
    """
    Estende um vídeo já gerado em +7s, usando o recurso nativo de extensão
    do Veo 3.1 — o próprio Google junta o vídeo antigo com o pedaço novo
    num arquivo só. Só funciona com vídeos gerados por essa mesma API (por
    isso precisa do objeto `Video` da geração anterior, não só os bytes).
    """
    client = _client()
    prompt = (
        _PROMPT_VIDEO.format(descricao=descricao)
        + "\n\nContinue mostrando a fachada frontal e preserve rigorosamente a mesma casa, "
        "posição, proporções e materiais. Não volte para uma visão vertical de cima e não altere a arquitetura."
    )

    operacao = client.models.generate_videos(
        model=VIDEO_MODEL,
        video=video_anterior,
        prompt=prompt,
        config=types.GenerateVideosConfig(
            number_of_videos=1,
            resolution="720p",
        ),
    )

    video, video_bytes, video_mime = _aguardar_e_baixar_video(client, operacao, acao="estender")
    return video_bytes, video_mime, video


def _aguardar_e_baixar_video(client: genai.Client, operacao, acao: str = "gerar"):
    """Espera a operação de vídeo terminar e baixa o resultado."""
    while not operacao.done:
        time.sleep(POLL_INTERVAL_S)
        operacao = client.operations.get(operacao)

    if operacao.error:
        raise GeracaoError(f"falha ao {acao} o vídeo: {operacao.error}")

    resultado = operacao.response
    gerados = resultado.generated_videos if resultado else None
    if not gerados:
        raise GeracaoError(
            f"a IA não devolveu vídeo ao tentar {acao} — tente descrever o projeto de outro jeito."
        )

    video = gerados[0].video
    if video.video_bytes is None and video.uri:
        client.files.download(file=video)

    if video.video_bytes is None:
        raise GeracaoError(f"não consegui baixar o vídeo ao tentar {acao}.")

    return video, video.video_bytes, video.mime_type or "video/mp4"


def gerar_projeto(foto_bytes: bytes, foto_mime: str, descricao: str) -> ProjetoGerado:
    """Roda o pipeline completo: foto do terreno -> imagem editada -> vídeo."""
    imagem_bytes, imagem_mime = gerar_imagem_projeto(foto_bytes, foto_mime, descricao)
    video_bytes, video_mime = gerar_video_local(imagem_bytes, imagem_mime)
    return ProjetoGerado(
        imagem_bytes=imagem_bytes,
        imagem_mime=imagem_mime,
        video_bytes=video_bytes,
        video_mime=video_mime,
    )
