"""Rotina de lembretes automÃ¡ticos de aluguel via Evolution/WhatsApp."""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import date

from app import db
from app.evolution import EvolutionError, enviar_texto

log = logging.getLogger(__name__)


def _ativo() -> bool:
    return os.getenv("COBRANCA_LEMBRETES_AUTOMATICOS", "false").strip().lower() in {"1", "true", "sim", "yes"}


def _texto(linha, tipo: str) -> str:
    valor = f"{linha['valor_centavos'] / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    vencimento = date.fromisoformat(linha["vencimento"]).strftime("%d/%m/%Y")
    inicio = f"Olá, {linha['cliente_nome']}! "
    if tipo == "antes_vencimento":
        aviso = f"Seu aluguel do imóvel {linha['imovel_titulo']} vence em {vencimento}."
    elif tipo == "vencimento":
        aviso = f"Hoje vence o aluguel do imóvel {linha['imovel_titulo']}."
    else:
        aviso = f"O aluguel do imóvel {linha['imovel_titulo']} venceu em {vencimento} e ainda consta pendente."
    return f"{inicio}{aviso} Valor: R$ {valor}. Em caso de pagamento, desconsidere esta mensagem."


def processar_lembretes() -> int:
    """Envia no mÃ¡ximo um lembrete de cada tipo por cobranÃ§a."""
    if not _ativo():
        return 0
    hoje = date.today()
    enviados = 0
    for linha in db.listar_cobrancas():
        if linha["status"] == "pago" or not linha["cliente_whatsapp_cobranca_ativo"]:
            continue
        dias = (date.fromisoformat(linha["vencimento"]) - hoje).days
        tipo = "antes_vencimento" if dias == 3 else "vencimento" if dias == 0 else "atraso" if dias == -3 else None
        if not tipo or db.lembrete_automatico_ja_enviado(linha["id"], tipo):
            continue
        try:
            enviar_texto(linha["cliente_contato"] or "", _texto(linha, tipo))
            db.registrar_lembrete_automatico(linha["id"], tipo)
            db.registrar_lembrete_cobranca(linha["id"])
            enviados += 1
        except EvolutionError as erro:
            log.warning("Falha ao enviar lembrete da cobrança %s: %s", linha["id"], erro)
    return enviados


async def rotina_diaria() -> None:
    """Roda uma vez ao dia no horÃ¡rio definido, sem exigir n8n."""
    ultimo_dia: str | None = None
    while True:
        agora = __import__("datetime").datetime.now()
        dia = agora.date().isoformat()
        hora = int(os.getenv("COBRANCA_HORA_LEMBRETE", "9"))
        if _ativo() and agora.hour >= hora and ultimo_dia != dia:
            enviados = processar_lembretes()
            log.info("Rotina de cobranças concluída: %s lembrete(s) enviado(s).", enviados)
            ultimo_dia = dia
        await asyncio.sleep(300)
