"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Coins, Gauge, Ruler, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getRecursosEng, type RecursoEng } from "@/lib/api";
import { brl, custoEquipamento, custoMaterial, metrosMedicao, precoMedicaoObra, valorNum } from "@/lib/eng-recursos";

const kMoeda = (v: number) => `${Math.round(v / 1000)}k`;

export function DashboardEng() {
  const [obras, setObras] = useState<RecursoEng[]>([]);
  const [equip, setEquip] = useState<RecursoEng[]>([]);
  const [mat, setMat] = useState<RecursoEng[]>([]);
  const [custos, setCustos] = useState<RecursoEng[]>([]);
  const [medicoes, setMedicoes] = useState<RecursoEng[]>([]);

  useEffect(() => {
    Promise.all([
      getRecursosEng("obra"), getRecursosEng("equipamento"), getRecursosEng("material"),
      getRecursosEng("custo"), getRecursosEng("medicao"),
    ]).then(([o, e, m, c, me]) => { setObras(o); setEquip(e); setMat(m); setCustos(c); setMedicoes(me); })
      .catch(() => {});
  }, []);

  const d = useMemo(() => {
    const soma = <T,>(rs: T[], f: (r: T) => number) => rs.reduce((s, r) => s + f(r), 0);
    const custo = soma(equip, custoEquipamento) + soma(mat, custoMaterial) + soma(custos, (r) => valorNum(r, "valor"));
    const metros = soma(medicoes, metrosMedicao);

    const porObra = obras.map((o) => {
      const cObra = soma(equip.filter((r) => r.dados.obra === o.id), custoEquipamento)
        + soma(mat.filter((r) => r.dados.obra === o.id), custoMaterial)
        + soma(custos.filter((r) => r.dados.obra === o.id), (r) => valorNum(r, "valor"));
      const mObra = soma(medicoes.filter((r) => r.dados.obra === o.id), metrosMedicao);
      const receita = mObra * precoMedicaoObra(o);
      return { nome: o.nome.length > 16 ? o.nome.slice(0, 15) + "…" : o.nome, custo: cObra, receita, metros: mObra };
    });
    const receita = soma(porObra, (o) => o.receita);
    return { custo, metros, receita, margem: receita - custo, porObra, emAndamento: obras.filter((o) => o.dados.status === "Em andamento").length };
  }, [obras, equip, mat, custos, medicoes]);

  const kpis = [
    { icon: Ruler, label: "Metros executados", valor: `${d.metros} m`, nota: `${d.emAndamento} obra(s) em andamento` },
    { icon: Coins, label: "Custo realizado", valor: brl(d.custo), nota: "mão de obra + equip. + materiais" },
    { icon: TrendingUp, label: "Receita prevista", valor: brl(d.receita), nota: "metros × R$/m de medição" },
    { icon: Gauge, label: "Margem prevista", valor: brl(d.margem), nota: d.receita ? `${Math.round((d.margem / d.receita) * 100)}% da receita` : "—" },
  ];

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <k.icon className="text-primary" size={20} />
            <p className="mt-4 text-sm text-slate-500">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{k.valor}</p>
            <p className="mt-1 text-xs text-slate-400">{k.nota}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-medium text-slate-600">Custo × Receita prevista por obra</h2>
          <div className="mt-3 h-64">
            {d.porObra.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-slate-400">Sem obras cadastradas</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.porObra}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nome" fontSize={11} stroke="#94a3b8" />
                  <YAxis fontSize={11} stroke="#94a3b8" tickFormatter={kMoeda} />
                  <Tooltip formatter={(v) => brl(Number(v))} />
                  <Legend />
                  <Bar dataKey="custo" name="Custo" fill="#ef4444" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="receita" name="Receita prevista" fill="#16a34a" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-slate-600">Metros executados por obra</h2>
          <div className="mt-3 h-64">
            {d.porObra.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-slate-400">Sem obras cadastradas</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.porObra} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" fontSize={11} stroke="#94a3b8" />
                  <YAxis type="category" dataKey="nome" fontSize={11} stroke="#94a3b8" width={110} />
                  <Tooltip formatter={(v) => `${Number(v)} m`} />
                  <Bar dataKey="metros" name="Metros" fill="#0ea5e9" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
