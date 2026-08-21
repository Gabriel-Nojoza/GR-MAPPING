import { Ruler, TriangleAlert } from "lucide-react";
import type { Medicao } from "@/types/medicao";
import { Card } from "@/components/ui/card";

export function ResultadoMedicao({ medicao }: { medicao: Medicao }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
          <Ruler size={18} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Medição do terreno</h2>
          <p className="text-xs text-slate-500">Confira os valores calculados abaixo.</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Área total</p>
        <p className="mt-1 text-3xl font-semibold text-slate-900">{medicao.area_hectares} ha</p>
        <p className="mt-1 text-sm text-slate-500">Equivale a {medicao.area_m2} m²</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-100 px-3 py-3">
          <p className="text-xs text-slate-500">Perímetro</p>
          <p className="mt-1 text-base font-semibold text-slate-800">{medicao.perimetro_m} m</p>
        </div>
        <div className="rounded-xl border border-slate-100 px-3 py-3">
          <p className="text-xs text-slate-500">Escala usada</p>
          <p className="mt-1 text-base font-semibold text-slate-800">{medicao.gsd_cm_por_px} cm/px</p>
        </div>
      </div>

      {medicao.avisos.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {medicao.avisos.map((aviso, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-xs text-amber-800"
            >
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Atenção: medição estimada</p>
                <p className="mt-0.5 leading-relaxed">{aviso}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs leading-relaxed text-slate-400">{medicao.disclaimer}</p>
    </Card>
  );
}
