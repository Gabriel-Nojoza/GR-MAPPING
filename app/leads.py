"""Consulta de empresas no Google Places para a área administrativa."""
from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException


_URL_TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText"
_FIELD_MASK = ",".join(("places.id", "places.displayName", "places.formattedAddress", "places.internationalPhoneNumber", "places.googleMapsUri", "places.primaryTypeDisplayName", "places.businessStatus"))


def pesquisar_leads(cidade: str, segmento: str, limite: int = 20) -> list[dict]:
    """Busca estabelecimentos pelo Text Search oficial do Google Places."""
    chave = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
    if not chave:
        raise HTTPException(status_code=503, detail="A chave do Google Places não está configurada no servidor.")

    limite = max(1, min(limite, 60))
    consulta = f"{segmento.strip()} em {cidade.strip()}, Brasil"
    resultados: list[dict] = []
    token_pagina: str | None = None
    while len(resultados) < limite:
        corpo: dict = {"textQuery": consulta, "languageCode": "pt-BR", "regionCode": "BR", "maxResultCount": min(20, limite - len(resultados))}
        if token_pagina:
            corpo["pageToken"] = token_pagina
        requisicao = Request(_URL_TEXT_SEARCH, data=json.dumps(corpo).encode("utf-8"), method="POST", headers={"Content-Type": "application/json", "X-Goog-Api-Key": chave, "X-Goog-FieldMask": _FIELD_MASK})
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
        for local in dados.get("places", []):
            resultados.append({"place_id": local.get("id"), "nome": (local.get("displayName") or {}).get("text") or "Sem nome", "endereco": local.get("formattedAddress"), "telefone": local.get("internationalPhoneNumber"), "tipo": (local.get("primaryTypeDisplayName") or {}).get("text"), "situacao": local.get("businessStatus"), "google_maps_url": local.get("googleMapsUri")})
        token_pagina = dados.get("nextPageToken")
        if not token_pagina or not dados.get("places"):
            break
    return resultados
