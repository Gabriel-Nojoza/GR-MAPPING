import { Ruler, Video } from "lucide-react";
import type { Atividade } from "@/types/painel";
import { Card } from "@/components/ui/card";

export function AtividadesLista({ atividades }: { atividades: Atividade[] }) {
  return (
    <Card>
      <h2 className="text-sm font-medium text-slate-500">Atividade recente</h2>
      <ul className="mt-2 flex flex-col divide-y divide-slate-100">
        {atividades.length === 0 && (
          <li className="py-3 text-sm text-slate-400">Nenhuma atividade ainda.</li>
        )}
        {atividades.map((a, i) => (
          <li key={i} className="flex items-start gap-3 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-primary">
              {a.tipo === "video" ? <Video size={14} /> : <Ruler size={14} />}
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800">{a.titulo}</p>
              <p className="text-xs text-slate-500">{a.detalhe}</p>
              <p className="text-xs text-slate-400">{a.criado_em}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
