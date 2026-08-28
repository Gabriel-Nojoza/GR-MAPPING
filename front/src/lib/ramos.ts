import { API_URL } from "@/lib/api";

export type RamoSlug = "imobiliaria" | "engenharia";

export type CampoCliente = {
  key: string;
  label: string;
  tipo: "texto" | "contrato";
  obrigatorio: boolean;
};

export type RamoConfig = {
  ramo: RamoSlug;
  label: string;
  rota_inicial: string;
  sidebar: string[];
  campos_cliente: CampoCliente[];
};

export const RAMOS: { slug: RamoSlug; label: string }[] = [
  { slug: "imobiliaria", label: "Imobiliária" },
  { slug: "engenharia", label: "Engenharia / Construção civil" },
];

export const CONFIG_PADRAO: RamoConfig = {
  ramo: "imobiliaria",
  label: "Imobiliária",
  rota_inicial: "/",
  sidebar: [
    "dashboard", "medir", "terrenos", "videos", "clientes",
    "imoveis", "financeiro", "cobrancas", "documentos",
    "gerar_projeto", "configuracoes",
  ],
  campos_cliente: [],
};

/** Área de rota (prefixo) que cada ramo controla. */
export function areaDoRamo(ramo: RamoSlug | undefined | null): "eng" | "imob" {
  return ramo === "engenharia" ? "eng" : "imob";
}

/** True quando a rota pertence à área de engenharia. */
export function rotaEhEngenharia(pathname: string): boolean {
  return pathname === "/eng" || pathname.startsWith("/eng/");
}

export async function getRamoConfig(): Promise<RamoConfig> {
  const token = sessionStorage.getItem("medicao-terreno:token");
  const res = await fetch(`${API_URL}/config/ramo`, {
    headers: { Authorization: `Bearer ${token ?? ""}` },
    cache: "no-store",
  });
  if (!res.ok) return CONFIG_PADRAO;
  return res.json();
}
