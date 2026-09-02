"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HardHat, Joystick, Plane, Ruler, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getEngDashboard, type EngDashboard } from "@/lib/api";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function DashboardEng() {
  const [d, setD] = useState<EngDashboard | null>(null);
  const [mes, setMes] = useState(() => new Date());

  useEffect(() => { getEngDashboard().then(setD).catch(() => {}); }, []);

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

  const porDia = d.dias.slice(-14).map((x) => ({ dia: new Date(x.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), metros: x.avanco_m }));
  const chaveMes = new Date().toISOString().slice(0, 7);

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
          <h2 className="text-sm font-medium text-slate-600">Avanço por dia (últimos 14)</h2>
          <div className="mt-3 h-60">
            {porDia.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-slate-400">Sem dias com 2 voos ainda</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="dia" fontSize={11} stroke="#94a3b8" />
                  <YAxis fontSize={11} stroke="#94a3b8" tickFormatter={(v) => `${v}m`} />
                  <Tooltip formatter={(v) => `${Number(v)} m`} />
                  <Bar dataKey="metros" name="Avanço" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-slate-600">Avanço acumulado por obra</h2>
          <div className="mt-3 h-60">
            {d.por_obra.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-slate-400">Sem dados ainda</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.por_obra} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" fontSize={11} stroke="#94a3b8" />
                  <YAxis type="category" dataKey="obra" fontSize={11} stroke="#94a3b8" width={130} />
                  <Tooltip formatter={(v) => `${Number(v)} m`} />
                  <Bar dataKey="metros" name="Metros" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
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
