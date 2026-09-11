"use client";

import { useState } from "react";
import { Save, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mapa } from "@/components/eng/mapa";
import { atualizarRecursoEng, type RecursoEng } from "@/lib/api";

function contornoDe(obra: RecursoEng): [number, number][] {
  try {
    const p = JSON.parse(obra.dados.contorno || "[]");
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

/** Traça o contorno (perímetro) do terreno da obra, clicando no mapa. */
export function ContornoObra({
  obra,
  onFechar,
  onSalvo,
}: {
  obra: RecursoEng;
  onFechar: () => void;
  onSalvo: (r: RecursoEng) => void;
}) {
  const inicial = contornoDe(obra);
  const [pontos, setPontos] = useState<[number, number][]>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const lat = Number(obra.dados.localizacao_lat);
  const lon = Number(obra.dados.localizacao_lon);
  const center: [number, number] | null = inicial.length
    ? [inicial[0][1], inicial[0][0]]
    : Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon)
      ? [lat, lon]
      : null;

  async function salvar() {
    if (pontos.length < 2) { setErro("Marque pelo menos 2 pontos no mapa antes de salvar."); return; }
    try {
      setSalvando(true); setErro("");
      const r = await atualizarRecursoEng("obra", obra.id, {
        nome: obra.nome,
        dados: { ...obra.dados, contorno: JSON.stringify(pontos) },
      });
      onSalvo(r);
      onFechar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar o contorno."); }
    finally { setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">Contorno da obra — {obra.nome}</h2>
            <p className="text-xs text-slate-500">
              Clica no mapa marcando os cantos do terreno, em volta — sem precisar fechar no fim.
              {pontos.length > 0 && ` ${pontos.length} ponto(s) marcado(s).`}
            </p>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="mt-3">
          <Mapa center={center} zoom={center ? 18 : 4} busca linhaEditavel linha={pontos} onLinhaChange={setPontos} altura="480px" />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPontos((p) => p.slice(0, -1))} disabled={!pontos.length}>
              <Undo2 size={15} /> Desfazer último
            </Button>
            <Button variant="secondary" onClick={() => setPontos([])} disabled={!pontos.length}>
              <Trash2 size={15} /> Limpar
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}><Save size={15} /> {salvando ? "Salvando..." : "Salvar contorno"}</Button>
          </div>
        </div>
        {pontos.length === 1 && (
          <p className="mt-2 text-xs text-amber-600">Marque mais um ponto pelo menos pra formar uma linha.</p>
        )}
        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      </div>
    </div>
  );
}
