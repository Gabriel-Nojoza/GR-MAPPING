"use client";

import type { CampoCliente } from "@/lib/ramos";

const CONTRATO_OPCOES = [
  { valor: "", rotulo: "Sem contrato" },
  { valor: "a_gerar", rotulo: "Gerar contrato ao fechar negócio" },
  { valor: "gerado", rotulo: "Contrato já gerado" },
];

const CONTROLE = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15";

export function CamposDinamicos({
  campos,
  valores,
  onChange,
}: {
  campos: CampoCliente[];
  valores: Record<string, string>;
  onChange: (chave: string, valor: string) => void;
}) {
  if (campos.length === 0) return null;

  return (
    <>
      {campos.map((campo) => (
        <div key={campo.key} className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">
            {campo.label}{campo.obrigatorio ? " *" : ""}
          </label>
          {campo.tipo === "contrato" ? (
            <select value={valores[campo.key] ?? ""} onChange={(e) => onChange(campo.key, e.target.value)} className={CONTROLE}>
              {CONTRATO_OPCOES.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
              ))}
            </select>
          ) : (
            <input value={valores[campo.key] ?? ""} onChange={(e) => onChange(campo.key, e.target.value)} placeholder={campo.label} className={CONTROLE} />
          )}
        </div>
      ))}
    </>
  );
}

export function contratoRotulo(valor: string | undefined): string {
  return CONTRATO_OPCOES.find((o) => o.valor === (valor ?? ""))?.rotulo ?? "Sem contrato";
}
