"use client";

import { useState } from "react";
import { format, isSameMonth, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { mesAnterior, montarGradeMes, proximoMes } from "@/lib/calendario";
import type { CaptacaoDia } from "@/types/captacao";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

export function CalendarioCaptacoes() {
  const [mes, setMes] = useState(new Date());
  const [captacoes, setCaptacoes] = useState<CaptacaoDia[]>([]);
  const [formAberto, setFormAberto] = useState(false);
  const [data, setData] = useState("");
  const [local, setLocal] = useState("");
  const semanas = montarGradeMes(mes);

  function adicionar() {
    if (!data || !local.trim()) return;
    setCaptacoes((atual) => [...atual, { data, local, status: "pendente" }]);
    setData("");
    setLocal("");
    setFormAberto(false);
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-500">Calendário de Captações</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <button
              onClick={() => setMes(mesAnterior(mes))}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="w-32 text-center font-medium capitalize">
              {format(mes, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <button
              onClick={() => setMes(proximoMes(mes))}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <Button variant="secondary" onClick={() => setFormAberto((v) => !v)}>
            <Plus size={14} /> Nova captação
          </Button>
        </div>
      </div>

      {formAberto && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Local / terreno</label>
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <Button onClick={adicionar}>Adicionar</Button>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        As captações adicionadas ficam só nesta sessão do navegador — ainda não há backend pra
        persistir isso.
      </p>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-400">
        {DIAS_SEMANA.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {semanas.map((semana, i) => (
          <div key={i} className="grid grid-cols-7 gap-2">
            {semana.map((dia) => {
              const chave = format(dia, "yyyy-MM-dd");
              const doDia = captacoes.filter((c) => c.data === chave);
              const foraDoMes = !isSameMonth(dia, mes);

              return (
                <div
                  key={chave}
                  className={`min-h-[90px] rounded-lg border p-2 text-left text-xs ${
                    foraDoMes ? "border-slate-100 opacity-40" : "border-slate-200"
                  } ${isToday(dia) ? "border-primary ring-1 ring-primary/30" : ""}`}
                >
                  <div className="font-semibold text-slate-700">{format(dia, "d")}</div>
                  {doDia.length === 0 ? (
                    <p className="mt-1 text-slate-300">—</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1">
                      {doDia.map((c, idx) => (
                        <li
                          key={idx}
                          className={`truncate rounded px-1 py-0.5 ${
                            c.status === "feita"
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {c.local}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}
