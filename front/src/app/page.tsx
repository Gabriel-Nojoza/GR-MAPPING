import { Ruler, Map, Video, Clock } from "lucide-react";
import { getPainelResumo } from "@/lib/api";
import { StatCard } from "@/components/dashboard/stat-card";
import { AtividadesPizza } from "@/components/dashboard/atividades-pizza";
import { MedicoesBarras } from "@/components/dashboard/medicoes-barras";
import { CalendarioCaptacoes } from "@/components/dashboard/calendario-captacoes";

export default async function Home() {
  let painel;
  try {
    painel = await getPainelResumo();
  } catch {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-4 text-sm text-red-600">
          Não consegui falar com a API. Confirme que ela está rodando em{" "}
          <code>uvicorn app.main:app --reload</code>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Resumo das medições e projetos gerados.</p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Ruler size={18} />} label="Terrenos medidos" value={painel.total_terrenos} />
        <StatCard icon={<Map size={18} />} label="Área total (ha)" value={painel.area_total_ha} />
        <StatCard icon={<Video size={18} />} label="Vídeos gerados" value={painel.total_videos} />
        <StatCard icon={<Clock size={18} />} label="Vídeos processando" value={painel.videos_processando} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MedicoesBarras medicoesPorDia={painel.medicoes_por_dia} />
        <AtividadesPizza
          totalTerrenos={painel.total_terrenos}
          totalVideos={painel.total_videos}
        />
      </div>

      <div className="mt-5">
        <CalendarioCaptacoes />
      </div>
    </div>
  );
}
