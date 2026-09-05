"use client";

import { useEffect, useState } from "react";
import { HardHat, Plane } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getPessoasEmObra, type PessoasEmObra } from "@/lib/api";

const dataBr = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

export function PainelPessoasObra() {
  const [lista, setLista] = useState<PessoasEmObra[]>([]);
  const [carregou, setCarregou] = useState(false);

  useEffect(() => {
    getPessoasEmObra()
      .then(setLista)
      .catch(() => {})
      .finally(() => setCarregou(true));
  }, []);

  if (!carregou || lista.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-slate-600">Pessoas em obra pelo drone</h2>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">experimental</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Contagem automática por cor de capacete no voo mais recente de cada obra. Ainda não calibrada — use como
        conferência com o ponto, não como número oficial.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {lista.map((p) => (
          <Card key={p.obra_id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-800">{p.obra_nome}</p>
              <span className="flex items-center gap-1 text-[11px] text-slate-400"><Plane size={12} /> {dataBr(p.data)} · {p.turno}</span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <p className="text-3xl font-semibold text-slate-900">~{p.total_estimado}</p>
              <p className="pb-1 text-xs text-slate-400">
                {p.cadastrados > 0 ? `de ${p.cadastrados} cadastrado(s)` : "vistos no voo"}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(p.pessoas_por_cor).map(([cor, qtd]) => (
                <span key={cor} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                  <HardHat size={11} /> {cor}: {qtd}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
