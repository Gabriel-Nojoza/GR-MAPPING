"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HardHat, Joystick, Plane, Ruler, Truck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getEngDashboard, getPessoasEmObra, getRecursosEng, type EngDashboard, type PessoasEmObra, type RecursoEng } from "@/lib/api";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const STATUS_COR: Record<string, string> = {
  "Planejamento": "bg-slate-100 text-slate-600",
  "Em andamento": "bg-emerald-50 text-emerald-700",
  "Paralisada": "bg-amber-50 text-amber-700",
  "Concluída": "bg-indigo-50 text-primary",
};

export function DashboardEng() {
  const [d, setD] = useState<EngDashboard | null>(null);
  const [obras, setObras] = useState<RecursoEng[]>([]);
  const [pessoas, setPessoas] = useState<PessoasEmObra[]>([]);
  const [mes, setMes] = useState(() => new Date());

  useEffect(() => {
    getEngDashboard().then(setD).catch(() => {});
    getRecursosEng("obra").then(setObras).catch(() => {});
    getPessoasEmObra().then(setPessoas).catch(() => {});
  }, []);

  const grade = useMemo(() => {
    const ano = mes.getFullYear(), m = mes.getMonth();
    const primeiro = new Date(ano, m, 1).getDay();
    const dias = new Date(ano, m + 1, 0).getDate();
    const celulas: (string | null)[] = Array(primeiro).fill(null);
    for (let i = 1; i <= dias; i++) celulas.push(`${ano}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
    return celulas;
  }, [mes]);

  if (!d) return <div className="mt-6 text-sm text-slate-400">Carregando…</div>;

  const kpis = [
    { icon: HardHat, label: "Obras em andamento", valor: d.obras_em_andamento, nota: `${d.obras_total} no total` },
    { icon: Truck, label: "Máquinas", valor: d.maquinas_total, nota: "com etiqueta QR" },
    { icon: Joystick, label: "Operadores", valor: d.operadores_total, nota: "de drone" },
    { icon: Plane, label: "Voos no mês", valor: d.voos_mes, nota: `${d.voos_total} no total` },
    { icon: Ruler, label: "Avanço total", valor: `${d.avanco_total_m} m`, nota: "somando todos os dias" },
  ];

  const chaveMes = new Date().toISOString().slice(0, 7);

  // atividade real dos últimos 14 dias (voos feitos), não só os dias com
  // par manhã+tarde — assim o gráfico quase nunca fica vazio
  const atividade: { dia: string; voos: number; hoje: boolean }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const chave = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const eventos = d.calendario[chave] ?? [];
    atividade.push({
      dia: dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      voos: eventos.reduce((s, e) => s + e.turnos.length, 0),
      hoje: i === 0,
    });
  }

  // situação por obra: cruza cadastro + avanço acumulado + pessoas do último voo
  const metrosPorObra = new Map(d.por_obra.map((o) => [o.obra, o.metros]));
  const voosPorObra = new Map<string, number>();
  for (const eventos of Object.values(d.calendario)) {
    for (const ev of eventos) voosPorObra.set(ev.obra, (voosPorObra.get(ev.obra) ?? 0) + ev.turnos.length);
  }
  const situacaoObras = obras.map((o) => ({
    id: o.id,
    nome: o.nome,
    status: o.dados.status || "—",
    voos: voosPorObra.get(o.nome) ?? 0,
    metros: metrosPorObra.get(o.nome),
    pessoas: pessoas.find((p) => p.obra_id === o.id)?.total_estimado,
  }));

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <k.icon className="text-primary" size={20} />
            <p className="mt-3 text-sm text-slate-500">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{k.valor}</p>
            <p className="mt-1 text-xs text-slate-400">{k.nota}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-medium text-slate-600">Atividade — voos por dia (últimos 14)</h2>
          <p className="mt-0.5 text-xs text-slate-400">Quantos voos foram enviados a cada dia, mesmo sem par manhã/tarde ainda</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={atividade}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="dia" fontSize={11} stroke="#94a3b8" interval={1} />
                <YAxis fontSize={11} stroke="#94a3b8" allowDecimals={false} width={24} />
                <Tooltip formatter={(v) => [`${Number(v)} voo(s)`, "Voos"]} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="voos" radius={[5, 5, 0, 0]} maxBarSize={22}>
                  {atividade.map((a, i) => <Cell key={i} fill={a.hoje ? "#4f46e5" : "#c7d2fe"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-0">
          <div className="border-b border-slate-100 p-4 pb-3">
            <h2 className="text-sm font-medium text-slate-600">Situação por obra</h2>
            <p className="mt-0.5 text-xs text-slate-400">Voos, avanço acumulado e pessoas vistas no último voo</p>
          </div>
          <div className="max-h-64 divide-y divide-slate-50 overflow-y-auto">
            {situacaoObras.length === 0 ? (
              <p className="p-5 text-center text-sm text-slate-400">Nenhuma obra cadastrada ainda.</p>
            ) : situacaoObras.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">{o.nome}</p>
                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COR[o.status] ?? "bg-slate-100 text-slate-500"}`}>{o.status}</span>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-right text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Plane size={12} className="text-slate-400" /> {o.voos}</span>
                  <span className="flex items-center gap-1"><Ruler size={12} className="text-slate-400" /> {o.metros != null ? `${o.metros} m` : "—"}</span>
                  <span className="flex items-center gap-1"><Users size={12} className="text-slate-400" /> {o.pessoas != null ? `~${o.pessoas}` : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-600">Calendário de voos — {MESES[mes.getMonth()]} de {mes.getFullYear()}</h2>
          <div className="flex gap-1">
            <button onClick={() => setMes((x) => new Date(x.getFullYear(), x.getMonth() - 1, 1))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">‹</button>
            <button onClick={() => setMes((x) => new Date(x.getFullYear(), x.getMonth() + 1, 1))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">›</button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">
          {DIAS_SEMANA.map((s, i) => <div key={i} className="pb-1 font-medium text-slate-400">{s}</div>)}
          {grade.map((data, i) => {
            const eventos = data ? d.calendario[data] : undefined;
            return (
              <div key={i} className={`min-h-16 rounded-lg border p-1 text-left ${!data ? "border-transparent" : eventos ? "border-primary/30 bg-indigo-50/50" : "border-slate-100"}`}>
                {data && <span className={`text-[11px] ${data.slice(0, 7) === chaveMes && Number(data.slice(8)) === new Date().getDate() ? "font-bold text-primary" : "text-slate-400"}`}>{Number(data.slice(8))}</span>}
                {eventos?.map((ev, j) => (
                  <div key={j} className="mt-0.5 rounded bg-primary/10 px-1 py-0.5 text-[10px] leading-tight text-primary" title={`${ev.obra} · ${ev.turnos.join(", ")}${ev.operadores.length ? " · " + ev.operadores.join(", ") : ""}`}>
                    {ev.turnos.join("/")}{ev.operadores.length ? ` · ${ev.operadores[0].split(" ")[0]}` : ""}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
