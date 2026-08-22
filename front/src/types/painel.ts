export interface Atividade {
  tipo: "terreno" | "video";
  criado_em: string;
  titulo: string;
  detalhe: string;
}

export interface PainelResumo {
  total_terrenos: number;
  area_total_ha: number;
  total_videos: number;
  videos_processando: number;
  terrenos_7dias: number;
  medicoes_por_dia: Record<string, number>;
  atividades: Atividade[];
  total_clientes: number;
  receitas_pagas_mes: number;
  despesas_pagas_mes: number;
  a_receber_mes: number;
  a_pagar_mes: number;
}
