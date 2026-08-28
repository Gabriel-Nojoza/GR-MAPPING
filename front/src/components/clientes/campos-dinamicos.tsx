"use client";

import type { CampoCliente } from "@/lib/ramos";

const CONTRATO_OPCOES = [
  { valor: "", rotulo: "Sem contrato" },
  { valor: "a_gerar", rotulo: "Gerar contrato ao fechar negócio" },
  { valor: "gerado", rotulo: "Contrato já gerado" },
];

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
      {campos.map((campo) => {
        const valor = valores[campo.key] ?? "";
        if (campo.tipo === "contrato") {
          return (
            <select
              key={campo.key}
              value={valor}
              onChange={(e) => onChange(campo.key, e.target.value)}
              className="rounded-lg border border-slate-200 p-2.5 text-sm"
              aria-label={campo.label}
            >
              {CONTRATO_OPCOES.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
              ))}
            </select>
          );
        }
        return (
          <input
            key={campo.key}
            value={valor}
            onChange={(e) => onChange(campo.key, e.target.value)}
            placeholder={campo.label + (campo.obrigatorio ? " *" : "")}
            className="rounded-lg border border-slate-200 p-2.5 text-sm"
          />
        );
      })}
    </>
  );
}

export function contratoRotulo(valor: string | undefined): string {
  return CONTRATO_OPCOES.find((o) => o.valor === (valor ?? ""))?.rotulo ?? "Sem contrato";
}
