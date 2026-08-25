"use client";

import { useState } from "react";
import { Building2, ExternalLink, MapPin, Search, SlidersHorizontal, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pesquisarLeads, type LeadEncontrado } from "@/lib/admin-api";

export default function LeadsAdmin() {
  const [cidade, setCidade] = useState("Fortaleza");
  const [segmento, setSegmento] = useState("Imobiliárias");
  const [resultados, setResultados] = useState<LeadEncontrado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function buscar() {
    if (!cidade.trim()) { setErro("Informe a cidade ou região."); return; }
    try {
      setCarregando(true); setErro("");
      setResultados(await pesquisarLeads({ cidade: cidade.trim(), segmento: segmento.trim() || "Imobiliárias" }));
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível pesquisar os leads.");
    } finally { setCarregando(false); }
  }

  return <div className="mx-auto max-w-7xl">
    <div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-50 p-3 text-primary"><Target size={23} /></div><div><p className="text-sm font-medium text-primary">Administração Master</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">Leads</h1><p className="mt-1 text-sm text-slate-500">Encontre imobiliárias e organize oportunidades comerciais.</p></div></div>
    <Card className="mt-7 p-5"><div className="flex items-center gap-2"><span className="rounded-lg bg-indigo-50 p-2 text-primary"><Search size={18} /></span><div><h2 className="font-semibold text-slate-800">Pesquisar novos leads</h2><p className="text-xs text-slate-500">Pesquisa oficial pelo Google Places.</p></div></div>
      <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto]"><label className="relative"><MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade ou região" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary" /></label><label className="relative"><Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Segmento" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary" /></label><div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-500"><SlidersHorizontal size={16} />Até 20 resultados</div><Button onClick={() => void buscar()} disabled={carregando}><Search size={16} />{carregando ? "Pesquisando..." : "Buscar leads"}</Button></div>
      <p className="mt-3 text-xs text-slate-500">Os resultados vêm do Google Places e não são salvos automaticamente.</p></Card>
    <Card className="mt-5 overflow-hidden p-0"><div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-semibold text-slate-800">Resultados</h2><p className="text-xs text-slate-500">Confira a empresa e abra a localização no Google Maps.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{resultados.length} leads</span></div>
      {resultados.length === 0 ? <div className="grid place-items-center px-6 py-16 text-center"><div className="rounded-full bg-slate-100 p-4 text-slate-400"><Target size={28} /></div><h3 className="mt-4 font-medium text-slate-700">Pronto para iniciar a prospecção</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Pesquise por cidade e segmento para encontrar empresas.</p></div> : <div className="divide-y divide-slate-100">{resultados.map((lead) => <div key={lead.place_id ?? `${lead.nome}-${lead.endereco}`} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="font-medium text-slate-800">{lead.nome}</p><p className="mt-1 flex items-start gap-1 text-sm text-slate-500"><MapPin className="mt-0.5 shrink-0" size={14} />{lead.endereco || "Endereço não informado"}</p>{lead.tipo && <p className="mt-1 text-xs text-slate-400">{lead.tipo}</p>}</div>{lead.google_maps_url && <a href={lead.google_maps_url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-primary hover:bg-indigo-50">Maps <ExternalLink size={14} /></a>}</div>)}</div>}</Card>
    {erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
  </div>;
}
