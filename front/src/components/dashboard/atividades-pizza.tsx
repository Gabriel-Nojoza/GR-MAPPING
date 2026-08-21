"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";

const CORES = ["#4f46e5", "#16a34a"];

export function AtividadesPizza({
  totalTerrenos,
  totalVideos,
}: {
  totalTerrenos: number;
  totalVideos: number;
}) {
  const dados = [
    { nome: "Terrenos medidos", valor: totalTerrenos },
    { nome: "Vídeos gerados", valor: totalVideos },
  ];

  return (
    <Card>
      <h2 className="text-sm font-medium text-slate-500">Terrenos x Vídeos</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dados}
              dataKey="valor"
              nameKey="nome"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
            >
              {dados.map((_, i) => (
                <Cell key={i} fill={CORES[i % CORES.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
