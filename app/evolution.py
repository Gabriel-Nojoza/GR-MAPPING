"""Cliente interno da Evolution API; as chaves nunca são enviadas ao navegador."""
from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class EvolutionError(RuntimeError):
    pass


def _config() -> tuple[str, str, str]:
    url = os.getenv("EVOLUTION_API_URL", "").rstrip("/")
    chave = os.getenv("EVOLUTION_API_KEY", "")
    instancia = os.getenv("EVOLUTION_INSTANCE", "imobiliaria")
    if not url or not chave:
        raise EvolutionError("Evolution API ainda não está configurada no servidor.")
    return url, chave, instancia


def _chamar(caminho: str, metodo: str = "GET", corpo: dict | None = None) -> dict:
    url, chave, _ = _config()
    dados = json.dumps(corpo).encode() if corpo is not None else None
    requisicao = Request(f"{url}{caminho}", data=dados, method=metodo, headers={"apikey": chave, "Content-Type": "application/json"})
    try:
        with urlopen(requisicao, timeout=20) as resposta:
            return json.loads(resposta.read().decode() or "{}")
    except HTTPError as erro:
        detalhe = erro.read().decode(errors="replace")
        raise EvolutionError(f"Evolution API respondeu {erro.code}: {detalhe[:180]}") from erro
    except URLError as erro:
        raise EvolutionError("Não foi possível comunicar com a Evolution API.") from erro


def status() -> dict:
    _, _, instancia = _config()
    try:
        resposta = _chamar(f"/instance/connectionState/{instancia}")
        return {"configurada": True, "instancia": instancia, "estado": resposta.get("instance", {}).get("state", "desconhecido")}
    except EvolutionError as erro:
        if "respondeu 404" in str(erro):
            return {"configurada": True, "instancia": instancia, "estado": "não_criada"}
        raise


def conectar() -> dict:
    atual = status()
    instancia = atual["instancia"]
    if atual["estado"] == "não_criada":
        _chamar("/instance/create", "POST", {"instanceName": instancia, "integration": "WHATSAPP-BAILEYS", "qrcode": True})
    resposta = _chamar(f"/instance/connect/{instancia}")
    return {"qrcode": resposta.get("base64"), "instancia": instancia}


def enviar_texto(numero: str, texto: str) -> None:
    """Envia uma mensagem de texto pela instÃ¢ncia conectada da imobiliÃ¡ria."""
    _, _, instancia = _config()
    digitos = "".join(caractere for caractere in numero if caractere.isdigit())
    if len(digitos) < 10:
        raise EvolutionError("O cliente nÃ£o possui um nÃºmero de WhatsApp vÃ¡lido.")
    if len(digitos) in {10, 11}:
        digitos = f"55{digitos}"
    _chamar(
        f"/message/sendText/{instancia}",
        "POST",
        # Evolution API 2.x recebe o texto diretamente no campo `text`.
        {"number": digitos, "text": texto},
    )
