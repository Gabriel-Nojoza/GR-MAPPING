"""
Catálogo central de ramos de atuação.

Cada empresa cadastrada pertence a um ramo. O ramo decide, para todos os
usuários daquela empresa:

  - qual barra lateral (sidebar) o front carrega;
  - para quais áreas de rota o usuário tem acesso;
  - o schema do formulário de cliente (campos além do núcleo nome/contato/e-mail).

Esta é a fonte única da verdade no backend. O front espelha o mesmo formato
em ``front/src/lib/ramos.ts`` e busca a configuração pronta em ``GET /config/ramo``.
"""
from __future__ import annotations

RAMO_PADRAO = "imobiliaria"


# Cada campo do formulário de cliente:
#   key         -> chave gravada em clientes.dados_json
#   label       -> rótulo exibido no formulário
#   tipo        -> "texto" | "contrato"  (o front decide como renderizar)
#   obrigatorio -> valida no backend e no front
RAMOS: dict[str, dict] = {
    "imobiliaria": {
        "label": "Imobiliária",
        "rota_inicial": "/",
        "sidebar": [
            "dashboard", "medir", "terrenos", "videos", "clientes",
            "imoveis", "financeiro", "cobrancas", "documentos",
            "gerar_projeto", "configuracoes",
        ],
        "campos_cliente": [],
    },
    "engenharia": {
        "label": "Engenharia / Construção civil",
        "rota_inicial": "/eng",
        "sidebar": [
            "eng_dashboard", "eng_obras", "eng_equipamentos", "eng_materiais",
            "eng_custos", "eng_monitoramento", "eng_medicoes",
            "eng_clientes", "eng_configuracoes",
        ],
        "campos_cliente": [
            {"key": "endereco", "label": "Endereço", "tipo": "texto", "obrigatorio": False},
            {"key": "contrato", "label": "Contrato", "tipo": "contrato", "obrigatorio": False},
        ],
    },
}


def ramo_valido(slug: str | None) -> bool:
    return slug in RAMOS


def normalizar_ramo(slug: str | None) -> str:
    """Devolve um slug de ramo sempre válido (cai no padrão quando desconhecido)."""
    slug = (slug or "").strip().lower()
    return slug if slug in RAMOS else RAMO_PADRAO


def config_ramo(slug: str | None) -> dict:
    """Configuração completa do ramo, pronta para o front montar a interface."""
    slug = normalizar_ramo(slug)
    dados = RAMOS[slug]
    return {
        "ramo": slug,
        "label": dados["label"],
        "rota_inicial": dados["rota_inicial"],
        "sidebar": list(dados["sidebar"]),
        "campos_cliente": [dict(campo) for campo in dados["campos_cliente"]],
    }


def chaves_cliente_permitidas(slug: str | None) -> set[str]:
    return {campo["key"] for campo in RAMOS[normalizar_ramo(slug)]["campos_cliente"]}


def campos_cliente_obrigatorios(slug: str | None) -> list[dict]:
    return [c for c in RAMOS[normalizar_ramo(slug)]["campos_cliente"] if c.get("obrigatorio")]
