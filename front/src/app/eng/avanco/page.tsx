"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, Gauge, Ruler, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Mapa, type SegmentoMapa } from "@/components/eng/mapa";
import { compararVoos, getRecursosEng, getVoos, type Comparacao, type RecursoEng, type Voo } from "@/lib/api";
import { brl, custoDiarioEquipamento } from "@/lib/eng-recursos";

const ORDEM_TURNO: Record<string, number> = { "Manhã": 0, "Único": 1, "Tarde": 2 };
const dataBr = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

type Dia = { chave: string; obraId: string; obraNome: string; data: string; voos: Voo[] };

export default function AvancoPage() {
  const [obras, setObras] = useState<RecursoEng[]>([]);
  const [voos, setVoos] = useState<Voo[]>([]);
  const [maquinas, setMaquinas] = useState<RecursoEng[]>([]);
  const [comp, setComp] = useState<Comparacao | null>(null);
  const [selecionado, setSelecionado] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    Promise.all([getRecursosEng("obra"), getVoos(), getRecursosEng("equipamento")])
      .then(([o, v, m]) => { setObras(o); setVoos(v); setMaquinas(m); })
      .catch(() => {});
  }, []);

  // custo/dia de cada máquina, rateado do valor mensal cadastrado — usado
  // pra cruzar com o avanço medido pelo drone (quanto custou x quanto andou)
  const custoDiaPorMaquina = useMemo(
    () => new Map(maquinas.map((m) => [m.id, custoDiarioEquipamento(m)])),
    [maquinas],
  );

  const dias = useMemo<Dia[]>(() => {
    const nome = new Map(obras.map((o) => [o.id, o.nome]));
    const grupos = new Map<string, Dia>();
    for (const v of voos) {
      const chave = `${v.obra_id}|${v.data}`;
      if (!grupos.has(chave)) grupos.set(chave, { chave, obraId: v.obra_id, obraNome: nome.get(v.obra_id) ?? "Obra", data: v.data, voos: [] });
      grupos.get(chave)!.voos.push(v);
    }
    return [...grupos.values()]
      .filter((d) => d.voos.length >= 2)
      .map((d) => ({ ...d, voos: [...d.voos].sort((a, b) => (ORDEM_TURNO[a.turno] ?? 1) - (ORDEM_TURNO[b.turno] ?? 1)) }))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [obras, voos]);

  async function abrirDia(dia: Dia) {
    setSelecionado(dia.chave); setErro(""); setComp(null);
    const primeiro = dia.voos[0], ultimo = dia.voos[dia.voos.length - 1];
    try {
      setComp(await compararVoos(dia.obraId, primeiro.id, ultimo.id));
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao comparar."); }
  }

  const centro = useMemo((): [number, number] | null => {
    const p = comp?.maquinas.find((m) => m.pos_a?.lat != null);
    return p?.pos_a?.lat != null ? [p.pos_a.lat, p.pos_a.lon!] : null;
  }, [comp]);

  const segmentos: SegmentoMapa[] = (comp?.maquinas ?? []).flatMap((m) =>
    m.pos_a?.lat != null && m.pos_b?.lat != null
      ? [{ a: { lat: m.pos_a.lat, lon: m.pos_a.lon! }, b: { lat: m.pos_b.lat, lon: m.pos_b.lon! }, cor: m.parada ? "#ef4444" : "#22c55e" }]
      : [],
  );
  const pontos = (comp?.maquinas ?? []).flatMap((m) => {
    const out = [];
    if (m.pos_a?.lat != null) out.push({ lat: m.pos_a.lat, lon: m.pos_a.lon!, cor: "#3b82f6", titulo: `${m.maquina_nome} · manhã` });
    if (m.pos_b?.lat != null) out.push({ lat: m.pos_b.lat, lon: m.pos_b.lon!, cor: "#16a34a", titulo: `${m.maquina_nome} · tarde` });
    return out;
  });

  return (
    <div className="mx-auto max-w-[100rem]">
      <h1 className="text-2xl font-semibold text-slate-900">Avanço</h1>
      <p className="mt-1 text-sm text-slate-500">Compara os voos da manhã e da tarde do mesmo dia e mostra quanto cada máquina produziu.</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card className="p-0">
          <div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-800">Dias com 2 voos</h2></div>
          {dias.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Nenhum dia com voo de manhã e de tarde ainda. Registre os dois em <b>Voos</b>.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {dias.map((d) => (
                <button
                  key={d.chave}
                  onClick={() => abrirDia(d)}
                  className={`flex w-full items-center justify-between p-4 text-left text-sm hover:bg-slate-50 ${selecionado === d.chave ? "bg-indigo-50/60" : ""}`}
                >
                  <div>
                    <p className="font-medium text-slate-700">{d.obraNome}</p>
                    <p className="text-xs text-slate-400">{dataBr(d.data)} · {d.voos.map((v) => v.turno).join(" + ")}</p>
                  </div>
                  <TrendingUp size={15} className="text-slate-300" />
                </button>
              ))}
            </div>
          )}
        </Card>

        <div>
          {erro && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
          {!comp && !erro && <Card className="grid h-64 place-items-center text-sm text-slate-400">Escolha um dia à esquerda.</Card>}
          {comp && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-5"><Ruler size={18} className="text-primary" /><p className="mt-3 text-sm text-slate-500">Avanço total do dia</p><p className="mt-1 text-2xl font-semibold text-slate-900">{comp.avanco_total_m} m</p></Card>
                <Card className="p-5"><Gauge size={18} className="text-amber-600" /><p className="mt-3 text-sm text-slate-500">Máquinas paradas</p><p className="mt-1 text-2xl font-semibold text-slate-900">{comp.maquinas.filter((m) => m.parada).length} / {comp.maquinas.length}</p></Card>
                <Card className="p-5"><TrendingUp size={18} className="text-emerald-600" /><p className="mt-3 text-sm text-slate-500">Máquinas em campo</p><p className="mt-1 text-2xl font-semibold text-slate-900">{comp.maquinas.length}</p></Card>
                <Card className="p-5"><Coins size={18} className="text-slate-400" /><p className="mt-3 text-sm text-slate-500">Gasto estimado do dia</p><p className="mt-1 text-2xl font-semibold text-slate-900">{brl(comp.maquinas.reduce((s, m) => s + (custoDiaPorMaquina.get(m.maquina_id) ?? 0), 0))}</p></Card>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="p-3">
                  <Mapa center={centro} zoom={centro ? 17 : 4} pontos={pontos} segmentos={segmentos} altura="440px" />
                  <p className="mt-2 text-xs text-slate-500">Azul = manhã · verde = tarde · linha = trajeto (vermelha se quase não andou).</p>
                </Card>

                <Card className="overflow-hidden p-0">
                  <div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-800">Por máquina</h2></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs text-slate-400">
                          <th className="px-4 py-2.5">Máquina</th><th className="px-4 py-2.5">Avanço</th><th className="px-4 py-2.5">Situação</th>
                          <th className="px-4 py-2.5">Gasto do dia</th><th className="px-4 py-2.5">R$/m</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comp.maquinas.map((m) => {
                          const gasto = custoDiaPorMaquina.get(m.maquina_id) ?? 0;
                          const desperdicio = m.parada && gasto > 0;
                          return (
                          <tr key={m.maquina_id} className={`border-b border-slate-50 last:border-0 ${desperdicio ? "bg-red-50/40" : ""}`}>
                            <td className="px-4 py-3 font-medium text-slate-700">{m.maquina_nome}</td>
                            <td className="px-4 py-3 text-slate-700">{m.avanco_m != null ? `${m.avanco_m} m` : "—"}</td>
                            <td className="px-4 py-3">
                              {m.avanco_m == null
                                ? <span className="text-slate-400">sem posição nas fotos</span>
                                : m.parada
                                  ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs text-red-700">parada</span>
                                  : <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">trabalhando</span>}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{gasto > 0 ? brl(gasto) : "—"}</td>
                            <td className="px-4 py-3">
                              {desperdicio
                                ? <span className="font-medium text-red-700">pagou e não andou</span>
                                : m.avanco_m ? brl(gasto / m.avanco_m) : "—"}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
                    Gasto do dia = custo mensal cadastrado da máquina ÷ 26 dias úteis. Linhas em vermelho: gerou custo e não andou.
                  </p>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
