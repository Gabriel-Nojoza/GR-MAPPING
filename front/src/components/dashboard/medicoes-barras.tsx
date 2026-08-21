"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";

export function MedicoesBarras({
  medicoesPorDia,
}: {
  medicoesPorDia: Record<string, number>;
}) {
  const dados = Object.entries(medicoesPorDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, medicoes]) => ({ dia, medicoes }));

  return (
    <Card>
      <h2 className="text-sm font-medium text-slate-500">Medições por dia</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="dia" fontSize={12} stroke="#94a3b8" />
            <YAxis allowDecimals={false} fontSize={12} stroke="#94a3b8" />
            <Tooltip />
            <Bar dataKey="medicoes" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
