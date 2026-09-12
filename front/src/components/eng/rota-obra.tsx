"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Save, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mapa } from "@/components/eng/mapa";
import {
  atualizarFrente, criarFrente, excluirFrente, getFrentes,
  type Frente, type RecursoEng,
} from "@/lib/api";
import { comprimentoLinha } from "@/lib/geo";

/** Desenha (ou importa por KMZ, noutra tela) o traçado de um trecho da obra —
 * alternativa manual ao KMZ, útil pra testar rápido ou ajustar um trecho. */
export function RotaObra({
  obra,
  onFechar,
  onMudou,
}: {
  obra: RecursoEng;
  onFechar: () => void;
  onMudou: () => void;
}) {
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [editando, setEditando] = useState<Frente | null>(null);
  const [pontos, setPontos] = useState<[number, number][]>([]);
  const [nome, setNome] = useState("");
  const [diametro, setDiametro] = useState("");
  const [material, setMaterial] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  const lat = Number(obra.dados.localizacao_lat);
  const lon = Number(obra.dados.localizacao_lon);
  const center: [number, number] | null = pontos.length
    ? [pontos[0][1], pontos[0][0]]
    : Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon)
      ? [lat, lon]
      : null;

  function carregar() {
    getFrentes(obra.id).then(setFrentes).catch(() => {});
  }
  useEffect(carregar, [obra.id]);

  function novoTrecho() {
    setEditando(null);
    setPontos([]);
    setNome(`Trecho ${frentes.length + 1}`);
    setDiametro("");
    setMaterial("");
    setErro(""); setMsg("");
  }
  useEffect(novoTrecho, []); // eslint-disable-line react-hooks/exhaustive-deps

  function editar(f: Frente) {
    setEditando(f);
    setPontos((f.geojson?.coordinates ?? []) as [number, number][]);
    setNome(f.nome);
    setDiametro(f.diametro_mm ? String(f.diametro_mm) : "");
    setMaterial(f.material ?? "");
    setErro(""); setMsg("");
  }

  async function excluir(f: Frente) {
    if (!confirm(`Excluir o trecho "${f.nome}"?`)) return;
    await excluirFrente(f.id);
    if (editando?.id === f.id) novoTrecho();
    carregar();
    onMudou();
  }

  async function salvar() {
    if (pontos.length < 2) { setErro("Marque pelo menos 2 pontos no mapa antes de salvar."); return; }
    if (!nome.trim()) { setErro("Dê um nome pro trecho."); return; }
    try {
      setSalvando(true); setErro(""); setMsg("");
      const extensao = comprimentoLinha(pontos);
      const corpo = {
        obra_id: obra.id,
        nome: nome.trim(),
        geojson: { type: "LineString" as const, coordinates: pontos },
        extensao_prevista_m: Math.round(extensao * 10) / 10,
        diametro_mm: diametro.trim() ? Number(diametro) : null,
        material: material.trim() || null,
      };
      if (editando) await atualizarFrente(editando.id, corpo);
      else await criarFrente(corpo);
      setMsg(`Trecho salvo: ${Math.round(extensao)} m.`);
      carregar();
      onMudou();
      if (!editando) novoTrecho();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o trecho.");
    } finally {
      setSalvando(false);
    }
  }

  const extensaoAtual = comprimentoLinha(pontos);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">Rota da obra — {obra.nome}</h2>
            <p className="text-xs text-slate-500">
              Clica no mapa marcando o traçado do trecho, em sequência.
              {pontos.length > 0 && ` ${pontos.length} ponto(s) · ≈ ${Math.round(extensaoAtual)} m marcados.`}
            </p>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_260px]">
          <Mapa center={center} zoom={center ? 16 : 4} busca linhaEditavel linha={pontos} onLinhaChange={setPontos} altura="440px" />

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Nome do trecho</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)}
                     className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-500">Diâmetro (mm)</label>
                <input value={diametro} onChange={(e) => setDiametro(e.target.value)} placeholder="ex: 600"
                       className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Material</label>
                <input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="ex: PVC"
                       className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPontos((p) => p.slice(0, -1))} disabled={!pontos.length}>
                <Undo2 size={15} /> Desfazer
              </Button>
              <Button variant="secondary" onClick={() => setPontos([])} disabled={!pontos.length}>
                <Trash2 size={15} /> Limpar
              </Button>
            </div>
            <Button onClick={salvar} disabled={salvando}>
              <Save size={15} /> {salvando ? "Salvando..." : editando ? "Salvar trecho" : "Adicionar trecho"}
            </Button>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {msg && <p className="text-sm text-emerald-600">{msg}</p>}

            <div className="mt-2 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Trechos da obra</p>
                <button onClick={novoTrecho} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <Plus size={13} /> novo
                </button>
              </div>
              <div className="mt-2 flex max-h-52 flex-col gap-1.5 overflow-y-auto">
                {frentes.length === 0 && <p className="text-xs text-slate-400">Nenhum trecho ainda.</p>}
                {frentes.map((f) => (
                  <div key={f.id} className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${editando?.id === f.id ? "border-primary bg-indigo-50/60" : "border-slate-200"}`}>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">{f.nome}</p>
                      <p className="text-slate-400">{Math.round(f.extensao_prevista_m)} m{f.diametro_mm ? ` · DN${f.diametro_mm}` : ""}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => editar(f)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary"><Pencil size={13} /></button>
                      <button onClick={() => excluir(f)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
