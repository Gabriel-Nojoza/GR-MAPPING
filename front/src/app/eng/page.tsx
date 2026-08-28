import { DashboardEng } from "@/components/eng/dashboard-eng";

export default function EngenhariaDashboard() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold text-slate-900">Visão geral da obra</h1>
      <p className="mt-1 text-sm text-slate-500">Metros executados, custo realizado e receita prevista — a partir dos apontamentos de campo.</p>
      <DashboardEng />
    </div>
  );
}
