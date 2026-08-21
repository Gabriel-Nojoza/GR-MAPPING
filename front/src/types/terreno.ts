export interface Terreno {
  id: string;
  criado_em: string;
  nome_foto: string | null;
  nome: string | null;
  area_m2: number;
  area_ha: number;
  perimetro_m: number;
  gsd_cm_por_px: number;
  pontos: [number, number][];
}
