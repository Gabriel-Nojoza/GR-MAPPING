"""Consulta de empresas no Google Places para a área administrativa."""
from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException


_URL_TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText"
_FIELD_MASK = ",".join(("places.id", "places.displayName", "places.formattedAddress", "places.googleMapsUri", "places.primaryTypeDisplayName", "places.businessStatus"))


def pesquisar_leads(cidade: str, segmento: str, limite: int = 20) -> list[dict]:
    """Busca estabelecimentos pelo Text Search oficial do Google Places."""
    chave = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
    if not chave:
        raise HTTPException(status_code=503, detail="A chave do Google Places não está configurada no servidor.")

    consulta = f"{segmento.strip()} em {cidade.strip()}, Brasil"
    corpo = json.dumps({"textQuery": consulta, "languageCode": "pt-BR", "regionCode": "BR", "maxResultCount": max(1, min(limite, 20))}).encode("utf-8")
    requisicao = Request(_URL_TEXT_SEARCH, data=corpo, method="POST", headers={"Content-Type": "application/json", "X-Goog-Api-Key": chave, "X-Goog-FieldMask": _FIELD_MASK})
    try:
        with urlopen(requisicao, timeout=20) as resposta:  # nosec B310 - URL fixa da API Google
            dados = json.loads(resposta.read().decode("utf-8"))
    except HTTPError as erro:
        try:
            detalhe = json.loads(erro.read().decode("utf-8")).get("error", {}).get("message")
        except (ValueError, UnicodeDecodeError):
            detalhe = None
        raise HTTPException(status_code=502, detail=detalhe or "Não foi possível consultar o Google Places.")
    except URLError:
        raise HTTPException(status_code=502, detail="Não foi possível conectar ao Google Places.")

    resultados: list[dict] = []
    for local in dados.get("places", []):
        resultados.append({
            "place_id": local.get("id"),
            "nome": (local.get("displayName") or {}).get("text") or "Sem nome",
            "endereco": local.get("formattedAddress"),
            "tipo": (local.get("primaryTypeDisplayName") or {}).get("text"),
            "situacao": local.get("businessStatus"),
            "google_maps_url": local.get("googleMapsUri"),
        })
    return resultados
