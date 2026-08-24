"use client";

import { useEffect, useState } from "react";
import { Bell, CalendarDays, Check, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { enviarLembreteCobranca, getCobrancas, marcarCobranca, type Cobranca } from "@/lib/api";

const hoje = new Date().toISOString().slice(0, 10);
const mesAtual = hoje.slice(0, 7);
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function Cobrancas() {
  const [mes, setMes] = useState(mesAtual);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState("");

  async function carregar() {
    try {
      setErro("");
      setCobrancas(await getCobrancas(mes));
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível carregar as cobranças.");
    }
  }

  useEffect(() => { void carregar(); }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pagar(id: string) {
    try { await marcarCobranca(id, "pago"); await carregar(); }
    catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível atualizar."); }
  }

  async function lembrar(cobranca: Cobranca) {
    if (!window.confirm(`Enviar lembrete de ${moeda.format(cobranca.valor)} para ${cobranca.cliente_nome} pelo WhatsApp?`)) return;
    try {
      setEnviando(cobranca.id);
      await enviarLembreteCobranca(cobranca.id);
      await carregar();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível enviar o lembrete.");
    } finally {
      setEnviando("");
    }
  }

  const pendentes = cobrancas.filter((item) => item.status !== "pago");
  const totalPendente = pendentes.reduce((total, item) => total + item.valor, 0);

  return <div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary">Locação imobiliária</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">Cobranças</h1><p className="mt-1 text-sm text-slate-500">As cobranças são criadas automaticamente conforme o vencimento de cada imóvel alugado.</p></div><input type="month" value={mes} onChange={(evento) => setMes(evento.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-3"><Card className="p-4"><p className="text-sm text-slate-500">A receber</p><p className="mt-2 text-xl font-semibold text-amber-600">{moeda.format(totalPendente)}</p></Card><Card className="p-4"><p className="text-sm text-slate-500">Pendentes</p><p className="mt-2 text-xl font-semibold text-slate-800">{pendentes.length}</p></Card><Card className="p-4"><p className="text-sm text-slate-500">Lembretes enviados</p><p className="mt-2 text-xl font-semibold text-primary">{cobrancas.filter((item) => item.lembrete_enviado_em).length}</p></Card></div>
    <Card className="mt-6 p-5"><div className="flex items-start gap-3"><div className="rounded-lg bg-indigo-50 p-2 text-primary"><CalendarDays size={19} /></div><div><h2 className="font-semibold text-slate-800">Agenda automática de aluguel</h2><p className="mt-1 text-sm text-slate-500">O valor é definido no cadastro do imóvel: aluguel + condomínio. Não é necessário criar cobranças manualmente.</p></div></div></Card>
    <Card className="mt-6 overflow-x-auto p-0"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs text-slate-400"><th className="px-5 py-3">Morador / imóvel</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3" /></tr></thead><tbody>{cobrancas.length === 0 ? <tr><td colSpan={5} className="px-5 py-14 text-center text-slate-400">Nenhum imóvel alugado para esta competência.</td></tr> : cobrancas.map((cobranca) => <tr key={cobranca.id} className="border-b border-slate-50 last:border-0"><td className="px-5 py-3"><p className="font-medium text-slate-700">{cobranca.cliente_nome}</p><p className="text-xs text-slate-400">{cobranca.imovel_titulo}</p></td><td className="px-4 py-3 text-slate-600">{new Date(`${cobranca.vencimento}T12:00:00`).toLocaleDateString("pt-BR")}</td><td className="px-4 py-3 font-medium text-slate-700">{moeda.format(cobranca.valor)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${cobranca.status === "pago" ? "bg-emerald-50 text-emerald-700" : cobranca.status === "atrasado" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{cobranca.status}</span></td><td className="px-4 py-3"><div className="flex gap-2">{cobranca.status !== "pago" && <button onClick={() => void pagar(cobranca.id)} title="Marcar como pago" className="text-emerald-600"><Check size={18} /></button>}{cobranca.status !== "pago" && <button onClick={() => void lembrar(cobranca)} disabled={enviando === cobranca.id} title="Enviar lembrete pelo WhatsApp" className="text-primary disabled:opacity-40">{cobranca.lembrete_enviado_em ? <Bell size={18} /> : <Send size={18} />}</button>}</div></td></tr>)}</tbody></table></Card>
    {erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
  </div>;
}
