"use client";

import { useEffect, useMemo, useState } from "react";
import { Route, Save, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mapa } from "@/components/eng/mapa";
import {
  atualizarFrente, criarFrente, excluirFrente, getFrentes, getRecursosEng,
  type Frente, type RecursoEng,
} from "@/lib/api";

function comprimentoM(coords: [number, number][]) {
  const R = 6371000;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lo1, la1] = coords[i - 1], [lo2, la2] = coords[i];
    const dLa = (la2 - la1) * Math.PI / 180, dLo = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(a));
  }
  return Math.round(total);
}

export default function FrentesPage() {
  const [obras, setObras] = useState<RecursoEng[]>([]);
  const [obraId, setObraId] = useState("");
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [editando, setEditando] = useState<Frente | null>(null);
  const [nome, setNome] = useState("");
  const [coords, setCoords] = useState<[number, number][]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { getRecursosEng("obra").then(setObras).catch(() => {}); }, []);

  async function carregar(id: string) {
    setObraId(id); setEditando(null); setNome(""); setCoords([]);
    if (!id) { setFrentes([]); return; }
    try { setFrentes(await getFrentes(id)); } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao carregar frentes."); }
  }

  function abrirNova() { setEditando(null); setNome(""); setCoords([]); setErro(""); }
  function abrirEdicao(f: Frente) {
    setEditando(f); setNome(f.nome); setCoords(f.geojson?.coordinates ?? []); setErro("");
  }

  const centro = useMemo((): [number, number] | null => {
    if (coords.length) return [coords[0][1], coords[0][0]];
    const comLinha = frentes.find((f) => f.geojson?.coordinates.length);
    if (comLinha) return [comLinha.geojson!.coordinates[0][1], comLinha.geojson!.coordinates[0][0]];
    return null;
  }, [coords, frentes]);

  async function salvar() {
    if (!nome.trim()) { setErro("Dê um nome pra frente."); return; }
    if (coords.length < 2) { setErro("Clique no mapa pra desenhar a linha da frente (2+ pontos)."); return; }
    const geojson = { type: "LineString" as const, coordinates: coords };
    const payload = { obra_id: obraId, nome: nome.trim(), geojson, extensao_prevista_m: comprimentoM(coords) };
    try {
      setSalvando(true); setErro("");
      if (editando) await atualizarFrente(editando.id, payload);
      else await criarFrente(payload);
      await carregar(obraId);
      abrirNova();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSalvando(false); }
  }

  async function apagar(f: Frente) {
    if (window.confirm(`Excluir a frente "${f.nome}"?`)) { await excluirFrente(f.id); void carregar(obraId); }
  }

  return (
    <div className="mx-auto max-w-[100rem]">
      <h1 className="text-2xl font-semibold text-slate-900">Frentes de serviço</h1>
      <p className="mt-1 text-sm text-slate-500">Desenhe no mapa por onde a obra avança. É a referência pra medir o avanço de cada máquina.</p>

      <Card className="mt-6 p-5">
        <label className="text-xs font-medium text-slate-600">Obra</label>
        <select value={obraId} onChange={(e) => void carregar(e.target.value)} className="mt-1.5 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
          <option value="">Selecione a obra</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </Card>

      {obraId && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card className="p-3">
            <Mapa
              center={centro}
              zoom={centro ? 16 : 4}
              busca
              linha={coords}
              linhaEditavel
              onLinhaChange={setCoords}
              pontos={editando ? [] : frentes.flatMap((f) => (f.geojson?.coordinates ?? []).slice(0, 1).map(([lo, la]) => ({ lat: la, lon: lo, cor: "#94a3b8", titulo: f.nome })))}
              altura="520px"
            />
            <div className="mt-2 flex items-center gap-2 text-sm">
              <button onClick={() => setCoords((c) => c.slice(0, -1))} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"><Undo2 size={14} /> Desfazer</button>
              <button onClick={() => setCoords([])} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50">Limpar</button>
              <span className="ml-auto text-slate-500">{coords.length} pontos · {comprimentoM(coords)} m</span>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-semibold text-slate-800"><Route size={16} className="text-primary" />{editando ? "Editar frente" : "Nova frente"}</h2>
              <label className="mt-3 block text-xs font-medium text-slate-600">Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Vala principal / Rua A" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              <p className="mt-2 text-xs text-slate-500">Clique no mapa seguindo o eixo da vala, do início ao fim.</p>
              <div className="mt-4 flex gap-2">
                <Button onClick={salvar} disabled={salvando}><Save size={15} />{salvando ? "Salvando..." : "Salvar"}</Button>
                {editando && <Button variant="secondary" onClick={abrirNova}>Nova</Button>}
              </div>
              {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
            </Card>

            <Card className="p-0">
              <div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-800">Frentes da obra</h2></div>
              <div className="divide-y divide-slate-50">
                {frentes.length === 0 ? (
                  <p className="p-4 text-sm text-slate-400">Nenhuma frente ainda.</p>
                ) : frentes.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-4">
                    <button onClick={() => abrirEdicao(f)} className="text-left">
                      <p className="text-sm font-medium text-slate-700">{f.nome}</p>
                      <p className="text-xs text-slate-400">{Math.round(f.extensao_prevista_m)} m · {f.geojson?.coordinates.length ?? 0} pontos</p>
                    </button>
                    <button onClick={() => apagar(f)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
