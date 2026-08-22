"use client";

import { useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Check, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { criarLancamento, excluirLancamento, getFinanceiro, getResumoFinanceiro, marcarLancamento, type LancamentoFinanceiro, type ResumoFinanceiro } from "@/lib/api";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const hoje = new Date().toISOString().slice(0, 10);
const mesAtual = hoje.slice(0, 7);

export default function Financeiro() {
  const [mes, setMes] = useState(mesAtual);
  const [itens, setItens] = useState<LancamentoFinanceiro[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ tipo: "receita" as "receita" | "despesa", descricao: "", categoria: "Medição de terreno", valor: "", vencimento: hoje, observacao: "" });

  async function carregar() {
    try { setErro(""); const [lista, dados] = await Promise.all([getFinanceiro(mes), getResumoFinanceiro(mes)]); setItens(lista); setResumo(dados); }
    catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível carregar o financeiro."); }
  }
  useEffect(() => { carregar(); }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar() {
    const centavos = Math.round(Number(form.valor.replace(",", ".")) * 100);
    if (!form.descricao.trim() || !centavos) { setErro("Informe descrição e valor."); return; }
    try { await criarLancamento({ ...form, descricao: form.descricao.trim(), valor_centavos: centavos }); setForm({ ...form, descricao: "", valor: "", observacao: "" }); carregar(); }
    catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível salvar."); }
  }
  async function alterar(id: string, status: "pendente" | "pago") { await marcarLancamento(id, status); carregar(); }
  async function apagar(id: string) { if (window.confirm("Excluir este lançamento?")) { await excluirLancamento(id); carregar(); } }

  const cards = resumo ? [
    ["Saldo realizado", resumo.saldo, Wallet, "text-slate-800"], ["Recebido", resumo.receitas_pagas, ArrowUpCircle, "text-emerald-600"], ["Pago", resumo.despesas_pagas, ArrowDownCircle, "text-red-600"], ["A receber", resumo.a_receber, ArrowUpCircle, "text-amber-600"],
  ] as const : [];

  return <div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary">Controle do negócio</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">Financeiro</h1><p className="mt-1 text-sm text-slate-500">Controle receitas, despesas, vencimentos e valores pendentes.</p></div><input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([titulo, valor, Icon, cor]) => <Card key={titulo} className="p-4"><div className="flex items-center justify-between text-sm text-slate-500">{titulo}<Icon size={18} className={cor} /></div><p className={`mt-3 text-xl font-semibold ${cor}`}>{moeda.format(valor)}</p></Card>)}</div>
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]"><Card className="p-5"><h2 className="font-semibold text-slate-800">Novo lançamento</h2><div className="mt-4 grid gap-3"><div className="flex rounded-lg bg-slate-100 p-1"><button onClick={() => setForm({ ...form, tipo: "receita" })} className={`flex-1 rounded-md py-2 text-sm ${form.tipo === "receita" ? "bg-white text-emerald-700 shadow" : "text-slate-500"}`}>Receita</button><button onClick={() => setForm({ ...form, tipo: "despesa" })} className={`flex-1 rounded-md py-2 text-sm ${form.tipo === "despesa" ? "bg-white text-red-700 shadow" : "text-slate-500"}`}>Despesa</button></div><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição" className="rounded-lg border border-slate-200 p-2.5 text-sm" /><input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Categoria" className="rounded-lg border border-slate-200 p-2.5 text-sm" /><div className="grid grid-cols-2 gap-3"><input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="Valor (R$)" inputMode="decimal" className="rounded-lg border border-slate-200 p-2.5 text-sm" /><input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} className="rounded-lg border border-slate-200 p-2.5 text-sm" /></div><textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Observação (opcional)" className="min-h-20 rounded-lg border border-slate-200 p-2.5 text-sm" /><Button onClick={salvar} className="w-full"><Plus size={16} /> Adicionar lançamento</Button></div></Card>
      <Card className="overflow-x-auto p-0"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs text-slate-400"><th className="px-5 py-3">Lançamento</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3" /></tr></thead><tbody>{itens.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">Nenhum lançamento neste mês.</td></tr> : itens.map((item) => <tr key={item.id} className="border-b border-slate-50 last:border-0"><td className="px-5 py-3"><p className="font-medium text-slate-700">{item.descricao}</p><p className="text-xs text-slate-400">{item.categoria}</p></td><td className="px-4 py-3 text-slate-500">{new Date(`${item.vencimento}T12:00:00`).toLocaleDateString("pt-BR")}</td><td className={`px-4 py-3 font-medium ${item.tipo === "receita" ? "text-emerald-600" : "text-red-600"}`}>{item.tipo === "receita" ? "+" : "−"} {moeda.format(item.valor)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${item.status === "pago" ? "bg-emerald-50 text-emerald-700" : item.status === "atrasado" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{item.status}</span></td><td className="px-4 py-3"><div className="flex gap-2">{item.status !== "pago" && <button onClick={() => alterar(item.id, "pago")} title="Marcar como pago" className="text-emerald-600"><Check size={18} /></button>}<button onClick={() => apagar(item.id)} title="Excluir" className="text-slate-400 hover:text-red-600"><Trash2 size={17} /></button></div></td></tr>)}</tbody></table></Card></div>
    {resumo && resumo.atrasados > 0 && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Há {moeda.format(resumo.atrasados)} em lançamentos vencidos.</p>}{erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
  </div>;
}
