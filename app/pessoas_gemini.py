"""
Contagem de pessoas em obra pela IA da Google (Gemini Vision).

Alternativa ao YOLO local (app/deteccao_pessoas.py): o Gemini olha a foto e
diz quantas pessoas aparecem e a cor do capacete de cada uma. Costuma
acertar bem mais em foto de drone (pessoa pequena, ângulo torto, colete
que confunde).

Precisa da env GEMINI_API_KEY. Cada foto = 1 chamada (~1-3 s, custo de
centavos). Só roda em imagem, não em vídeo.
"""
from __future__ import annotations

import io
import json
import os
from pathlib import Path

try:
    from google import genai
    from google.genai import types
    from PIL import Image
except ImportError:
    genai = None
    types = None
    Image = None

MODELO = os.getenv("GEMINI_MODELO_VISAO", "gemini-3.6-flash")
_LADO_MAX = 1568  # o Gemini já reduz internamente; mandar menor economiza banda/token

_CORES = ["Branco", "Amarelo", "Azul", "Verde", "Vermelho", "Laranja", "Sem capacete"]

_PROMPT = (
    "A imagem é de um canteiro de obras (pode ser vista aérea de drone). "
    "Conte quantas PESSOAS aparecem e, para cada uma, a cor do capacete na cabeça. "
    f"Cores possíveis: {', '.join(_CORES[:-1])}. "
    "ATENÇÃO: capacete AZUL, visto de cima, contra fundo escuro (terra, vala, sombra), costuma ficar "
    "escuro e parecer 'sem capacete' à primeira vista — olhe com cuidado o formato arredondado e o "
    "brilho/reflexo típico de capacete antes de classificar como 'Sem capacete'. Só use 'Sem capacete' "
    "quando tiver certeza de que não há nada na cabeça (cabelo ou couro cabeludo visíveis). "
    "Preciso que faça a contagem certa sem erros, porque tem materiais que são da mesma cor do capacete "
    "(colete, balde, cone, tecido, plástico) — diferencie o capacete pelo MATERIAL e formato (plástico rígido, "
    "casco arredondado com aba), não só pela cor. "
    "Se houver fio de poste, cabo ou qualquer linha cruzando por cima da pessoa na imagem, ignore essa "
    "sobreposição e olhe com atenção redobrada a cor do capacete por baixo do fio — não deixe o fio confundir "
    "a cor nem esconder a pessoa. "
    "Se o operador estiver dentro de um buraco, vala ou cava (só cabeça/tronco visível, parte do corpo cortada "
    "pela borda do buraco), preste atenção redobrada: ele conta como pessoa normalmente e a cor do capacete deve "
    "ser identificada mesmo com iluminação mais escura ali dentro. "
    "NÃO conte cone, placa, tambor, colete ou balde como capacete — capacete fica na cabeça de uma pessoa. "
    "Responda SOMENTE um JSON neste formato exato, sem texto antes ou depois:\n"
    '{"total": <int>, "por_cor": {"Branco": <int>, "Amarelo": <int>, "Azul": <int>, '
    '"Verde": <int>, "Vermelho": <int>, "Laranja": <int>, "Sem capacete": <int>}}\n'
    "Só inclua as cores com contagem maior que zero. Se não houver ninguém, total 0 e por_cor vazio."
)


def disponivel() -> bool:
    return genai is not None and bool(os.environ.get("GEMINI_API_KEY", "").strip())


def _bytes_reduzidos(caminho: Path) -> bytes:
    dados = caminho.read_bytes()
    if Image is None:
        return dados
    try:
        with Image.open(io.BytesIO(dados)) as im:
            im = im.convert("RGB")
            if max(im.size) > _LADO_MAX:
                escala = _LADO_MAX / max(im.size)
                im = im.resize((int(im.width * escala), int(im.height * escala)))
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=88)
            return buf.getvalue()
    except Exception:
        return dados


def contar_pessoas(caminho: str | Path) -> dict[str, int]:
    """{"Branco": 3, "Sem capacete": 1, ...} — total = soma. {} se não deu."""
    if not disponivel():
        print("[pessoas_gemini] GEMINI_API_KEY ausente, pulando")
        return {}
    try:
        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"].strip())
        resp = client.models.generate_content(
            model=MODELO,
            contents=[
                types.Part.from_bytes(data=_bytes_reduzidos(Path(caminho)), mime_type="image/jpeg"),
                _PROMPT,
            ],
            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0),
        )
        bruto = (resp.text or "").strip()
    except Exception as e:
        print(f"[pessoas_gemini] erro na chamada ({type(e).__name__}): {e}")
        return {}

    try:
        obj = json.loads(bruto)
    except ValueError:
        # às vezes vem com ```json ... ``` em volta mesmo pedindo json puro
        limpo = bruto.strip("`").removeprefix("json").strip() if bruto.strip("`") else bruto
        try:
            obj = json.loads(limpo)
        except ValueError:
            print(f"[pessoas_gemini] resposta não é JSON válido: {bruto[:300]!r}")
            return {}

    por_cor = obj.get("por_cor") or {}
    saida: dict[str, int] = {}
    for cor, qtd in por_cor.items():
        cor = str(cor).strip().capitalize()
        if cor == "Sem capacete" or cor in _CORES:
            try:
                n = int(qtd)
            except (TypeError, ValueError):
                continue
            if n > 0:
                saida[cor] = n
    return saida
