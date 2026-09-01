"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, Gauge, Ruler, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mapa, type SegmentoMapa } from "@/components/eng/mapa";
import {
  compararVoos, getFrentes, getRecursosEng, getVoos, salvarConsumo,
  type Comparacao, type Frente, type RecursoEng, type Voo,
} from "@/lib/api";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function AvancoPage() {
  const [obras, setObras] = useState<RecursoEng[]>([]);
  const [obraId, setObraId] = useState("");
  const [voos, setVoos] = useState<Voo[]>([]);
  const [vooA, setVooA] = useState("");
  const [vooB, setVooB] = useState("");
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [comp, setComp] = useState<Comparacao | null>(null);
  const [consumo, setConsumo] = useState<Record<string, { horas: string; custo: string }>>({});
  const [erro, setErro] = useState("");

  useEffect(() => { getRecursosEng("obra").then(setObras).catch(() => {}); }, []);

  async function trocarObra(id: string) {
    setObraId(id); setComp(null); setVooA(""); setVooB("");
    if (!id) { setVoos([]); setFrentes([]); return; }
    const [vs, fs] = await Promise.all([getVoos(id), getFrentes(id)]);
    setVoos(vs); setFrentes(fs);
  }

  async function comparar() {
    if (!vooA || !vooB || vooA === vooB) { setErro("Escolha dois voos diferentes."); return; }
    try {
      setErro("");
      const c = await compararVoos(obraId, vooA, vooB);
      setComp(c);
      setConsumo(Object.fromEntries(c.maquinas.map((m) => [m.maquina_id, { horas: String(m.horas || ""), custo: "" }])));
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao comparar."); }
  }

  async function salvarConsumoMaq(maquinaId: string) {
    const c = consumo[maquinaId];
    if (!c || !comp) return;
    const vb = comp.voo_b;
    await salvarConsumo({
      obra_id: obraId, data: vb.data, turno: vb.turno, maquina_id: maquinaId,
      horas: Number(c.horas) || 0, custo_hora_centavos: Math.round((Number(c.custo) || 0) * 100),
    });
    await comparar();
  }

  const linha = frentes[0]?.geojson?.coordinates ?? null;
  const centro = useMemo((): [number, number] | null => {
    const p = comp?.maquinas.find((m) => m.pos_a?.lat != null);
    if (p?.pos_a?.lat != null) return [p.pos_a.lat, p.pos_a.lon!];
    if (linha?.length) return [linha[0][1], linha[0][0]];
    return null;
  }, [comp, linha]);

  const segmentos: SegmentoMapa[] = (comp?.maquinas ?? []).flatMap((m) =>
    m.pos_a?.lat != null && m.pos_b?.lat != null
      ? [{ a: { lat: m.pos_a.lat, lon: m.pos_a.lon! }, b: { lat: m.pos_b.lat, lon: m.pos_b.lon! }, cor: m.parada ? "#ef4444" : "#22c55e" }]
      : [],
  );
  const pontos = (comp?.maquinas ?? []).flatMap((m) => {
    const out = [];
    if (m.pos_a?.lat != null) out.push({ lat: m.pos_a.lat, lon: m.pos_a.lon!, cor: "#3b82f6", titulo: `${m.maquina_nome} (voo A)` });
    if (m.pos_b?.lat != null) out.push({ lat: m.pos_b.lat, lon: m.pos_b.lon!, cor: "#16a34a", titulo: `${m.maquina_nome} (voo B)` });
    return out;
  });

  const opcoesVoo = (v: Voo) => `${new Date(v.data + "T00:00:00").toLocaleDateString("pt-BR")} · ${v.turno} (${v.total_deteccoes} máq.)`;

  return (
    <div className="mx-auto max-w-[100rem]">
      <h1 className="text-2xl font-semibold text-slate-900">Avanço</h1>
      <p className="mt-1 text-sm text-slate-500">Compare dois voos e veja quanto cada máquina produziu — e quem ficou parada.</p>

      <Card className="mt-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">Obra</label>
            <select value={obraId} onChange={(e) => void trocarObra(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
              <option value="">Selecione</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">Voo A (antes)</label>
            <select value={vooA} onChange={(e) => setVooA(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" disabled={!obraId}>
              <option value="">—</option>
              {voos.map((v) => <option key={v.id} value={v.id}>{opcoesVoo(v)}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">Voo B (depois)</label>
            <select value={vooB} onChange={(e) => setVooB(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" disabled={!obraId}>
              <option value="">—</option>
              {voos.map((v) => <option key={v.id} value={v.id}>{opcoesVoo(v)}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={comparar} disabled={!vooA || !vooB}>Comparar</Button>
          </div>
        </div>
        {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      </Card>

      {comp && (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5"><Ruler size={18} className="text-primary" /><p className="mt-3 text-sm text-slate-500">Avanço total</p><p className="mt-1 text-2xl font-semibold text-slate-900">{comp.avanco_total_m} m</p></Card>
            <Card className="p-5"><Coins size={18} className="text-slate-400" /><p className="mt-3 text-sm text-slate-500">Custo do período</p><p className="mt-1 text-2xl font-semibold text-slate-900">{brl(comp.custo_total)}</p></Card>
            <Card className="p-5"><TrendingUp size={18} className="text-emerald-600" /><p className="mt-3 text-sm text-slate-500">R$ por metro</p><p className="mt-1 text-2xl font-semibold text-emerald-600">{comp.custo_por_metro != null ? brl(comp.custo_por_metro) : "—"}</p></Card>
            <Card className="p-5"><Gauge size={18} className="text-amber-600" /><p className="mt-3 text-sm text-slate-500">Máquinas paradas</p><p className="mt-1 text-2xl font-semibold text-slate-900">{comp.maquinas.filter((m) => m.parada).length} / {comp.maquinas.length}</p></Card>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <Card className="p-3">
              <Mapa center={centro} zoom={centro ? 17 : 4} linha={linha} pontos={pontos} segmentos={segmentos} altura="480px" />
              <p className="mt-2 text-xs text-slate-500">Azul = posição no voo A · verde = voo B · linha = trajeto (vermelha se a máquina quase não andou).</p>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-800">Por máquina</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400">
                      <th className="px-4 py-2.5">Máquina</th><th className="px-4 py-2.5">Avanço</th>
                      <th className="px-4 py-2.5">Horas</th><th className="px-4 py-2.5">R$/h</th><th className="px-4 py-2.5">R$/m</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.maquinas.map((m) => (
                      <tr key={m.maquina_id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-700">{m.maquina_nome}</p>
                          {m.parada && <span className="text-xs text-red-600">parada</span>}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">{m.avanco_m != null ? `${m.avanco_m} m` : "—"}</td>
                        <td className="px-4 py-3">
                          <input value={consumo[m.maquina_id]?.horas ?? ""} onChange={(e) => setConsumo((c) => ({ ...c, [m.maquina_id]: { ...c[m.maquina_id], horas: e.target.value } }))} onBlur={() => salvarConsumoMaq(m.maquina_id)} type="number" min="0" step="0.5" className="w-16 rounded border border-slate-200 px-2 py-1 text-sm" />
                        </td>
                        <td className="px-4 py-3">
                          <input value={consumo[m.maquina_id]?.custo ?? ""} onChange={(e) => setConsumo((c) => ({ ...c, [m.maquina_id]: { ...c[m.maquina_id], custo: e.target.value } }))} onBlur={() => salvarConsumoMaq(m.maquina_id)} type="number" min="0" step="1" placeholder="R$" className="w-20 rounded border border-slate-200 px-2 py-1 text-sm" />
                        </td>
                        <td className="px-4 py-3 font-medium text-primary">{m.custo_por_metro != null ? brl(m.custo_por_metro) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-slate-100 p-3 text-xs text-slate-400">Preencha horas e R$/h de cada máquina no turno pra ver o custo por metro.</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
