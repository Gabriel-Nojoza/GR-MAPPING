"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";

export function FinanceiroBarras({ receitas, despesas, receber, pagar }: { receitas: number; despesas: number; receber: number; pagar: number }) {
  const dados = [
    { nome: "Recebido", valor: receitas, cor: "#16a34a" },
    { nome: "Pago", valor: despesas, cor: "#ef4444" },
    { nome: "A receber", valor: receber, cor: "#f59e0b" },
    { nome: "A pagar", valor: pagar, cor: "#8b5cf6" },
  ];
  return <Card><div className="flex items-center justify-between"><div><h2 className="text-sm font-medium text-slate-600">Financeiro do mês</h2><p className="mt-1 text-xs text-slate-400">Receitas, despesas e compromissos</p></div></div><div className="mt-3 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={dados}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="nome" fontSize={11} stroke="#94a3b8" /><YAxis fontSize={11} stroke="#94a3b8" /><Tooltip formatter={(valor) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor))} /><Bar dataKey="valor" radius={[5, 5, 0, 0]}>{dados.map((item) => <Cell key={item.nome} fill={item.cor} />)}</Bar></BarChart></ResponsiveContainer></div></Card>;
}
