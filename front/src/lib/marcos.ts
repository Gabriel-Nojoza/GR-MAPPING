// Tipos de "marco" (ponto de referência solto no traçado, tipo o que o KMZ
// já traz — travessia, reservatório, ETA...) compartilhado entre a tela de
// edição da rota e a tela de progresso da obra.
export type Marco = { nome: string; lat: number; lon: number; tipo: string };

export const TIPOS_MARCO: { valor: string; label: string; cor: string }[] = [
  { valor: "travessia", label: "Travessia", cor: "#f59e0b" },
  { valor: "reservatorio", label: "Reservatório", cor: "#0ea5e9" },
  { valor: "eta", label: "ETA / estação de tratamento", cor: "#4f46e5" },
  { valor: "booster", label: "Booster (bombeamento)", cor: "#8b5cf6" },
  { valor: "interligacao", label: "Interligação", cor: "#ef4444" },
  { valor: "canteiro", label: "Canteiro de obras", cor: "#64748b" },
  { valor: "outro", label: "Outro", cor: "#94a3b8" },
];

export function corDoMarco(tipo: string): string {
  return TIPOS_MARCO.find((t) => t.valor === tipo)?.cor ?? "#94a3b8";
}

export function marcosDaObra(dados: Record<string, string> | undefined): Marco[] {
  try {
    const lista = JSON.parse(dados?.marcos_kmz || "[]");
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}
