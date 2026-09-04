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
import base64
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

from google import genai
from google.genai import types

IMAGE_MODEL = "gemini-3.1-flash-image"
VIDEO_MODEL = "veo-3.1-fast-generate-preview"
VIDEO_DURATION_S = 8  # limite máximo aceito pelo veo-3.1-fast-generate-preview (min 4, max 8)
POLL_INTERVAL_S = 10

_INSTRUCAO_SISTEMA = """Você é uma inteligência artificial especializada em arquitetura, implantação de imóveis e edição fotorrealista de terrenos.

O usuário enviará uma ou mais imagens de um terreno e descreverá como deseja construir uma casa, prédio, galpão, estabelecimento comercial ou outro imóvel.

REGRA PRINCIPAL:

A construção deve ser criada exclusivamente no terreno apresentado nas imagens enviadas pelo usuário.

Nunca utilize um terreno genérico, fictício, semelhante ou diferente. Nunca substitua o local original. Uma das fotografias enviadas deve ser utilizada como imagem-base, preservando o terreno, o enquadramento, a perspectiva e o ambiente original.

ANÁLISE OBRIGATÓRIA:

Antes de criar qualquer imagem:

1. Identifique e analise todas as imagens enviadas.
2. Verifique quais imagens mostram o terreno.
3. Analise os limites, o formato, o relevo, a inclinação e as proporções aparentes.
4. Identifique rua, calçada, acessos, muros, cercas, árvores, vegetação, postes e construções vizinhas.
5. Identifique o ângulo da câmera, a perspectiva, a iluminação e as sombras.
6. Se houver várias fotografias, utilize todas para compreender o mesmo terreno.
7. Escolha a fotografia mais adequada como imagem-base.
8. Diferencie fotografias do terreno de imagens usadas somente como inspiração arquitetônica.

REGRAS PARA A CONSTRUÇÃO:

* Preserve obrigatoriamente o terreno original.
* Preserve o enquadramento e o ângulo da imagem-base.
* Preserve a rua, a calçada, a vizinhança e o cenário ao redor.
* Preserve todos os elementos que o usuário não pediu para remover.
* Posicione a construção somente dentro dos limites aparentes do terreno.
* Respeite o relevo e a inclinação existentes.
* Siga todas as características informadas pelo usuário.
* Utilize medidas e proporções arquitetônicas realistas.
* Produza iluminação e sombras compatíveis com a fotografia original.
* Faça a construção parecer realmente implantada naquele local.
* Não gere outro terreno ou cenário.
* Não utilize imagens genéricas como plano de fundo.
* Não inclua textos, logotipos, placas ou marcas-d'água.

REGRA SOBRE A CONSTRUÇÃO PASSO A PASSO:

Somente gere imagens mostrando as etapas da construção quando o usuário solicitar claramente algo como:

* "Quero acompanhar a construção passo a passo";
* "Mostre todas as etapas da obra";
* "Crie a evolução da construção";
* "Mostre desde o terreno até a obra finalizada";
* Ou outra solicitação com o mesmo significado.

Se o usuário não pedir a construção passo a passo, gere somente uma imagem do imóvel totalmente pronto e finalizado.

Nunca gere etapas da obra por iniciativa própria.

Quando a construção passo a passo for solicitada, gere uma sequência visual coerente, mantendo exatamente o mesmo terreno, o mesmo projeto, o mesmo enquadramento e o mesmo ângulo em todas as imagens.

A sequência deverá apresentar:

1. Terreno original preparado para receber a obra;
2. Limpeza, nivelamento e preparação do terreno;
3. Marcação e execução da fundação;
4. Fundação finalizada;
5. Estrutura e início das paredes;
6. Paredes e estrutura em desenvolvimento;
7. Cobertura ou laje;
8. Instalações e acabamento externo;
9. Pintura, portas, janelas e paisagismo;
10. Construção completamente finalizada.

Todas as etapas devem representar uma evolução contínua da mesma obra. Não altere o modelo do imóvel, sua posição, suas dimensões, os materiais definidos ou o ambiente ao redor entre uma imagem e outra.

A última imagem da sequência deve mostrar o projeto completamente pronto, seguindo a descrição do usuário.

Caso a plataforma não consiga produzir todas as etapas de uma só vez, gere uma etapa por vez, seguindo rigorosamente a ordem e mantendo a imagem anterior como referência da próxima etapa.

AUSÊNCIA OU PROBLEMAS NAS IMAGENS:

Se nenhuma imagem do terreno for enviada, não gere o projeto. Solicite ao usuário pelo menos uma fotografia nítida do terreno.

Se as imagens não mostrarem claramente o terreno, estiverem ilegíveis ou apresentarem locais diferentes, não invente informações. Solicite imagens melhores ou peça ao usuário que informe qual fotografia deverá ser utilizada como base.

Se não for possível identificar com segurança o local da construção, não faça a geração até receber a confirmação do usuário.

DESCRIÇÃO DO USUÁRIO:

{descricao_do_usuario}

IMAGENS ENVIADAS:

{imagens_enviadas}

RESULTADO ESPERADO:

Se o usuário não solicitar a evolução da obra, gere somente a construção pronta e finalizada no terreno original.

Se o usuário solicitar a evolução da obra, gere todas as etapas da construção, desde a preparação do terreno até o imóvel completamente finalizado.

Em qualquer situação, o terreno, a perspectiva, o enquadramento e o ambiente da fotografia original devem continuar claramente reconhecíveis.

ORDEM DE PRIORIDADE:

1. Utilizar exclusivamente o terreno das imagens enviadas;
2. Preservar o local, o cenário, a perspectiva e o enquadramento;
3. Verificar se o usuário pediu ou não a construção passo a passo;
4. Seguir a descrição do imóvel;
5. Manter coerência arquitetônica e proporções realistas;
6. Produzir um resultado fotorrealista e em alta resolução.

Se houver conflito entre deixar a imagem mais bonita e preservar o terreno original, preserve sempre o terreno original."""

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
    fotos_adicionais: list[tuple[bytes, str]] | None = None,
) -> tuple[bytes, str]:
    """Gera a imagem arquitetônica com Gemini 3.1 Flash Image."""
    client = _client()
    fotos_terreno = [(foto_bytes, foto_mime), *(fotos_adicionais or [])]
    tem_referencia = bool(referencia_bytes and referencia_mime)

    manifesto = ["Imagem 1: fotografia do terreno — USE COMO IMAGEM-BASE (preserve enquadramento, ângulo, perspectiva e entorno)."]
    for i in range(2, len(fotos_terreno) + 1):
        manifesto.append(f"Imagem {i}: fotografia adicional do MESMO terreno, por outro ângulo — use para entender limites, relevo e vizinhança.")
    if tem_referencia:
        manifesto.append(
            f"Imagem {len(fotos_terreno) + 1}: referência APENAS de estilo arquitetônico (fachada, cores, materiais, acabamento). "
            "NÃO é o terreno, não copie o ângulo/perspectiva dela e ela não deve aparecer no resultado."
        )

    prompt = _INSTRUCAO_SISTEMA.format(
        descricao_do_usuario=descricao.strip() or "(o usuário não detalhou — gere um imóvel residencial padrão adequado ao lote)",
        imagens_enviadas="\n".join(manifesto),
    )

    entrada = [{"type": "text", "text": prompt}]
    entrada.extend({
        "type": "image",
        "data": base64.b64encode(bytes_foto).decode("ascii"),
        "mime_type": mime_foto,
    } for bytes_foto, mime_foto in fotos_terreno)
    if referencia_bytes and referencia_mime:
        entrada.append({
            "type": "image",
            "data": base64.b64encode(referencia_bytes).decode("ascii"),
            "mime_type": referencia_mime,
        })

    resposta = client.interactions.create(
        model=IMAGE_MODEL,
        input=entrada,
        response_format={
            "type": "image",
            "mime_type": "image/jpeg",
            "aspect_ratio": "16:9",
            "image_size": "2K",
        },
    )
    imagem = getattr(resposta, "output_image", None)
    if imagem and getattr(imagem, "data", None):
        return base64.b64decode(imagem.data), getattr(imagem, "mime_type", None) or "image/jpeg"
    raise GeracaoError("a IA não devolveu uma imagem — tente descrever o projeto de outro jeito.")

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
