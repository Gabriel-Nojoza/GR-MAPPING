"use client";

import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Coins, HardHat, Package, TrendingUp, Truck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getRecursosEng, type RecursoEng } from "@/lib/api";
import { brl, custoEquipamento, custoMaterial, metrosMedicao, precoMedicaoObra, valorNum } from "@/lib/eng-recursos";

const CORES = ["#4f46e5", "#0ea5e9", "#f59e0b", "#94a3b8"];

export function PainelCustos() {
  const [equipamentos, setEquipamentos] = useState<RecursoEng[]>([]);
  const [materiais, setMateriais] = useState<RecursoEng[]>([]);
  const [custos, setCustos] = useState<RecursoEng[]>([]);
  const [medicoes, setMedicoes] = useState<RecursoEng[]>([]);
  const [obras, setObras] = useState<RecursoEng[]>([]);

  useEffect(() => {
    Promise.all([
      getRecursosEng("equipamento"), getRecursosEng("material"),
      getRecursosEng("custo"), getRecursosEng("medicao"), getRecursosEng("obra"),
    ]).then(([e, m, c, me, o]) => {
      setEquipamentos(e); setMateriais(m); setCustos(c); setMedicoes(me); setObras(o);
    }).catch(() => {});
  }, []);

  const analise = useMemo(() => {
    const soma = <T,>(rs: T[], f: (r: T) => number) => rs.reduce((s, r) => s + f(r), 0);

    const maoDeObra = soma(custos.filter((c) => c.dados.categoria === "Mão de obra"), (r) => valorNum(r, "valor"));
    const outros = soma(custos.filter((c) => c.dados.categoria !== "Mão de obra"), (r) => valorNum(r, "valor"));
    const equip = soma(equipamentos, custoEquipamento);
    const mat = soma(materiais, custoMaterial);
    const total = maoDeObra + outros + equip + mat;

    const composicao = [
      { nome: "Mão de obra", valor: maoDeObra },
      { nome: "Equipamentos", valor: equip },
      { nome: "Materiais", valor: mat },
      { nome: "Outros", valor: outros },
    ].filter((x) => x.valor > 0);

    const porObra = obras.map((o) => {
      const custoObra =
        soma(equipamentos.filter((r) => r.dados.obra === o.id), custoEquipamento) +
        soma(materiais.filter((r) => r.dados.obra === o.id), custoMaterial) +
        soma(custos.filter((r) => r.dados.obra === o.id), (r) => valorNum(r, "valor"));
      const metros = soma(medicoes.filter((r) => r.dados.obra === o.id), metrosMedicao);
      const preco = precoMedicaoObra(o);
      const receita = metros * preco;
      return {
        id: o.id, nome: o.nome, custo: custoObra, metros,
        porMetro: metros ? custoObra / metros : 0,
        receita, margem: receita - custoObra,
      };
    }).filter((x) => x.custo > 0 || x.metros > 0);

    const receitaPrevista = soma(porObra, (o) => o.receita);
    const margem = receitaPrevista - total;

    const trechos = new Map<string, number>();
    for (const c of custos) {
      const tr = (c.dados.trecho || "").trim();
      if (tr) trechos.set(tr, (trechos.get(tr) ?? 0) + valorNum(c, "valor"));
    }
    const porTrecho = [...trechos.entries()].map(([trecho, custo]) => ({ trecho, custo })).sort((a, b) => b.custo - a.custo);

    return { maoDeObra, outros, equip, mat, total, receitaPrevista, margem, composicao, porObra, porTrecho };
  }, [equipamentos, materiais, custos, medicoes, obras]);

  const cards = [
    { icon: Coins, label: "Custo realizado", valor: analise.total, cor: "slate" as const },
    { icon: TrendingUp, label: "Receita prevista", valor: analise.receitaPrevista, cor: "emerald" as const },
    { icon: TrendingUp, label: "Margem prevista", valor: analise.margem, cor: analise.margem >= 0 ? ("primary" as const) : ("red" as const) },
    { icon: Users, label: "Mão de obra", valor: analise.maoDeObra, cor: "slate" as const },
    { icon: Truck, label: "Equipamentos", valor: analise.equip, cor: "slate" as const },
    { icon: Package, label: "Materiais", valor: analise.mat, cor: "slate" as const },
    { icon: HardHat, label: "Outros custos", valor: analise.outros, cor: "slate" as const },
  ];
  const corTexto = (c: string) => (c === "emerald" ? "text-emerald-600" : c === "primary" ? "text-primary" : c === "red" ? "text-red-600" : "text-slate-800");

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map((c) => (
          <Card key={c.label} className={`p-4 ${c.cor === "emerald" || c.cor === "primary" ? "ring-1 ring-primary/15" : ""}`}>
            <c.icon size={18} className={c.cor === "slate" ? "text-slate-400" : corTexto(c.cor)} />
            <p className="mt-3 text-xs text-slate-500">{c.label}</p>
            <p className={`mt-1 text-lg font-semibold ${corTexto(c.cor)}`}>{brl(c.valor)}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <h2 className="text-sm font-medium text-slate-600">Composição de custos</h2>
          <p className="mt-1 text-xs text-slate-400">Mão de obra e outros vêm de lançamentos; equipamentos e materiais são calculados</p>
          <div className="mt-2 h-56">
            {analise.composicao.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-slate-400">Sem custos ainda</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analise.composicao} dataKey="valor" nameKey="nome" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {analise.composicao.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => brl(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            {analise.composicao.map((x, i) => (
              <span key={x.nome} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: CORES[i % CORES.length] }} />
                {x.nome}
              </span>
            ))}
          </div>
        </Card>

        <Card className="p-0">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-sm font-medium text-slate-600">Custo × receita por obra</h2>
            <p className="mt-1 text-xs text-slate-400">Receita prevista = metros executados × preço de medição (R$/m) da obra</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400">
                  <th className="px-4 py-2.5">Obra</th>
                  <th className="px-4 py-2.5">Metros</th>
                  <th className="px-4 py-2.5">R$/m custo</th>
                  <th className="px-4 py-2.5">Custo</th>
                  <th className="px-4 py-2.5">Receita prev.</th>
                  <th className="px-4 py-2.5">Margem</th>
                </tr>
              </thead>
              <tbody>
                {analise.porObra.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Cadastre obras, apontamentos e custos para ver a análise.</td></tr>
                ) : analise.porObra.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-700">{o.nome}</td>
                    <td className="px-4 py-3 text-slate-500">{o.metros || "—"} {o.metros ? "m" : ""}</td>
                    <td className="px-4 py-3 text-slate-500">{o.porMetro ? brl(o.porMetro) : "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{brl(o.custo)}</td>
                    <td className="px-4 py-3 text-emerald-600">{o.receita ? brl(o.receita) : "—"}</td>
                    <td className={`px-4 py-3 font-medium ${o.margem >= 0 ? "text-primary" : "text-red-600"}`}>{o.receita ? brl(o.margem) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {analise.porTrecho.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-sm font-medium text-slate-600">Custo por trecho</h2>
            <p className="mt-1 text-xs text-slate-400">Somatório dos lançamentos de custo com trecho informado</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400">
                  <th className="px-4 py-2.5">Trecho</th>
                  <th className="px-4 py-2.5">Custo</th>
                </tr>
              </thead>
              <tbody>
                {analise.porTrecho.map((t) => (
                  <tr key={t.trecho} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-700">{t.trecho}</td>
                    <td className="px-4 py-3 text-slate-600">{brl(t.custo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
