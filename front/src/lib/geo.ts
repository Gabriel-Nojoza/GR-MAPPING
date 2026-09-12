// Matemática geo compartilhada no front: distância entre pontos GPS e o
// corte de uma linha em "até onde já foi executado", pro mapa da obra.
import type { PontoMapa, SegmentoMapa } from "@/components/eng/mapa";

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function comprimentoLinha(coords: [number, number][]): number {
  // coords em [lon, lat]
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineM(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return total;
}

/** Corta a linha (lon,lat) em segmentos coloridos, um por trecho de ~20-200m,
 * parando exatamente em `executadoM` metros do início (interpola o ponto de
 * corte no meio do segmento que cruza esse valor). Usado pra desenhar a
 * parte já feita (verde) por cima da rota planejada inteira (cinza/azul). */
export function segmentosExecutados(
  coords: [number, number][],
  executadoM: number,
  cor: string,
): SegmentoMapa[] {
  const segmentos: SegmentoMapa[] = [];
  let acumulado = 0;
  for (let i = 1; i < coords.length; i++) {
    if (acumulado >= executadoM) break;
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    const segM = haversineM(lat1, lon1, lat2, lon2);
    if (segM <= 0) continue;
    if (acumulado + segM <= executadoM) {
      segmentos.push({ a: { lat: lat1, lon: lon1 }, b: { lat: lat2, lon: lon2 }, cor });
    } else {
      const t = (executadoM - acumulado) / segM;
      const latCorte = lat1 + t * (lat2 - lat1);
      const lonCorte = lon1 + t * (lon2 - lon1);
      segmentos.push({ a: { lat: lat1, lon: lon1 }, b: { lat: latCorte, lon: lonCorte }, cor });
    }
    acumulado += segM;
  }
  return segmentos;
}

/** Linha completa (planejada) como segmentos, todos da mesma cor — usado
 * junto com `segmentosExecutados` quando a obra tem mais de um trecho (o
 * componente Mapa só desenha uma `linha` por vez, mas vários `segmentos`). */
export function segmentosLinha(coords: [number, number][], cor: string, tracejado = false): SegmentoMapa[] {
  const segmentos: SegmentoMapa[] = [];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    segmentos.push({ a: { lat: lat1, lon: lon1 }, b: { lat: lat2, lon: lon2 }, cor, tracejado });
  }
  return segmentos;
}
