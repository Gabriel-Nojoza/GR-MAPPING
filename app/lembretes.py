"""Rotina de lembretes automáticos de aluguel via Evolution/WhatsApp."""
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


def texto_lembrete(linha, tipo: str = "manual") -> str:
    """Monta uma mensagem clara para envio manual ou automático de cobrança."""
    valor = f"{linha['valor_centavos'] / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    vencimento = date.fromisoformat(linha["vencimento"]).strftime("%d/%m/%Y")
    if tipo == "antes_vencimento":
        assunto = "Lembrete de vencimento próximo"
        aviso = "Seu aluguel vence em breve."
    elif tipo == "atraso":
        assunto = "Lembrete de aluguel em aberto"
        aviso = "Identificamos que este aluguel ainda consta em aberto."
    elif tipo == "vencimento":
        assunto = "Lembrete de vencimento hoje"
        aviso = "Seu aluguel vence hoje."
    else:
        assunto = "Lembrete de aluguel"
        aviso = "Segue um lembrete sobre o seu aluguel."

    return (
        f"Olá, {linha['cliente_nome']}!\n\n"
        f"*{assunto}*\n"
        f"{aviso}\n\n"
        f"🏠 *Imóvel:* {linha['imovel_titulo']}\n"
        f"📅 *Vencimento:* {vencimento}\n"
        f"💰 *Valor:* R$ {valor}\n\n"
        "Caso o pagamento já tenha sido realizado, desconsidere esta mensagem. "
        "Em caso de dúvidas, fale com a imobiliária."
    )


def processar_lembretes() -> int:
    """Envia no máximo um lembrete de cada tipo por cobrança."""
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
            enviar_texto(linha["cliente_contato"] or "", texto_lembrete(linha, tipo))
            db.registrar_lembrete_automatico(linha["id"], tipo)
            db.registrar_lembrete_cobranca(linha["id"])
            enviados += 1
        except EvolutionError as erro:
            log.warning("Falha ao enviar lembrete da cobrança %s: %s", linha["id"], erro)
    return enviados


async def rotina_diaria() -> None:
    """Roda uma vez ao dia no horário definido, sem exigir n8n."""
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
