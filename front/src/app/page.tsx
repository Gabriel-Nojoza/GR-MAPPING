import { Banknote, Clock, Map, Ruler, Users, Video, Wallet } from "lucide-react";
import { getPainelResumo } from "@/lib/api";
import { StatCard } from "@/components/dashboard/stat-card";
import { AtividadesPizza } from "@/components/dashboard/atividades-pizza";
import { MedicoesBarras } from "@/components/dashboard/medicoes-barras";
import { CalendarioCaptacoes } from "@/components/dashboard/calendario-captacoes";
import { AtividadesLista } from "@/components/dashboard/atividades-lista";
import { FinanceiroBarras } from "@/components/dashboard/financeiro-barras";

export default async function Home() {
  let painel;
  try { painel = await getPainelResumo(); } catch { return <div><h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1><p className="mt-4 text-sm text-red-600">Não consegui falar com a API. Confirme que ela está rodando.</p></div>; }
  const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  return <div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary">Visão geral</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">Dashboard</h1><p className="mt-1 text-sm text-slate-500">Acompanhe operação, projetos, clientes e resultado financeiro.</p></div><p className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">Dados atualizados em tempo real</p></div>
    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"><StatCard icon={<Ruler size={18} />} label="Terrenos medidos" value={painel.total_terrenos} /><StatCard icon={<Map size={18} />} label="Área total (ha)" value={painel.area_total_ha} /><StatCard icon={<Video size={18} />} label="Vídeos gerados" value={painel.total_videos} /><StatCard icon={<Users size={18} />} label="Clientes cadastrados" value={painel.total_clientes} /></div>
    <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"><StatCard icon={<Wallet size={18} />} label="Saldo do mês" value={moeda.format(painel.receitas_pagas_mes - painel.despesas_pagas_mes)} /><StatCard icon={<Banknote size={18} />} label="Recebido no mês" value={moeda.format(painel.receitas_pagas_mes)} /><StatCard icon={<Clock size={18} />} label="A receber" value={moeda.format(painel.a_receber_mes)} /><StatCard icon={<Clock size={18} />} label="Vídeos processando" value={painel.videos_processando} /></div>
    <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2"><MedicoesBarras medicoesPorDia={painel.medicoes_por_dia} /><FinanceiroBarras receitas={painel.receitas_pagas_mes} despesas={painel.despesas_pagas_mes} receber={painel.a_receber_mes} pagar={painel.a_pagar_mes} /></div>
    <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]"><AtividadesPizza totalTerrenos={painel.total_terrenos} totalVideos={painel.total_videos} /><AtividadesLista atividades={painel.atividades} /></div><div className="mt-5"><CalendarioCaptacoes /></div>
  </div>;
}
