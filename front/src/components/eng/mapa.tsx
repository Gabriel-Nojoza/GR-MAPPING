"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as L from "leaflet";

export type PontoMapa = { lat: number; lon: number; cor?: string; titulo?: string };
export type SegmentoMapa = { a: PontoMapa; b: PontoMapa; cor?: string; tracejado?: boolean };

const CENTRO_PADRAO: [number, number] = [-15.78, -47.93];

export function Mapa({
  center,
  zoom = 16,
  linha,
  linhaEditavel = false,
  onLinhaChange,
  pontos = [],
  segmentos = [],
  onClique,
  altura = "440px",
}: {
  center?: [number, number] | null;
  zoom?: number;
  linha?: [number, number][] | null;
  linhaEditavel?: boolean;
  onLinhaChange?: (coords: [number, number][]) => void;
  pontos?: PontoMapa[];
  segmentos?: SegmentoMapa[];
  onClique?: (lat: number, lon: number) => void;
  altura?: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const grupoRef = useRef<L.LayerGroup | null>(null);
  const editRef = useRef<[number, number][]>(linha ?? []);
  const [pronto, setPronto] = useState(false);

  // callbacks e props "vivas" pro handler de clique do mapa
  const vivo = useRef({ onClique, onLinhaChange, linhaEditavel });
  useEffect(() => { vivo.current = { onClique, onLinhaChange, linhaEditavel }; });

  const linhaKey = JSON.stringify(linha ?? null);
  const pontosKey = JSON.stringify(pontos);
  const segmentosKey = JSON.stringify(segmentos);

  function desenhar() {
    const leaflet = leafletRef.current;
    const grupo = grupoRef.current;
    if (!leaflet || !grupo) return;
    grupo.clearLayers();

    const coords = linhaEditavel ? editRef.current : (linha ?? []);
    if (coords.length >= 2) {
      leaflet.polyline(coords.map(([lon, lat]) => [lat, lon]) as [number, number][], { color: "#38bdf8", weight: 4 }).addTo(grupo);
    }
    coords.forEach(([lon, lat], i) => {
      leaflet.circleMarker([lat, lon], { radius: 4, color: "#38bdf8", fillColor: "#0ea5e9", fillOpacity: 1 })
        .bindTooltip(i === 0 ? "início" : i === coords.length - 1 ? "fim" : `${i}`).addTo(grupo);
    });
    segmentos.forEach((s) => {
      leaflet.polyline([[s.a.lat, s.a.lon], [s.b.lat, s.b.lon]], {
        color: s.cor ?? "#f59e0b", weight: 3, dashArray: s.tracejado ? "6 5" : undefined,
      }).addTo(grupo);
    });
    pontos.forEach((p) => {
      const m = leaflet.circleMarker([p.lat, p.lon], {
        radius: 7, color: "#fff", weight: 2, fillColor: p.cor ?? "#2563eb", fillOpacity: 1,
      }).addTo(grupo);
      if (p.titulo) m.bindTooltip(p.titulo);
    });
  }

  // init único
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const mod = await import("leaflet");
      const leaflet = (mod.default ?? mod) as unknown as typeof L;
      if (cancelado || mapRef.current || !divRef.current) return;
      leafletRef.current = leaflet;
      const map = leaflet.map(divRef.current, { center: center ?? CENTRO_PADRAO, zoom });
      leaflet.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20, attribution: "Esri" },
      ).addTo(map);
      grupoRef.current = leaflet.layerGroup().addTo(map);
      map.on("click", (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        if (vivo.current.linhaEditavel) {
          editRef.current = [...editRef.current, [lng, lat]];
          vivo.current.onLinhaChange?.(editRef.current);
          desenhar();
        } else {
          vivo.current.onClique?.(lat, lng);
        }
      });
      mapRef.current = map;
      setPronto(true);
    })();
    return () => { cancelado = true; mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redesenha quando muda a data
  useEffect(() => {
    if (linha) editRef.current = linha;
    desenhar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, linhaKey, pontosKey, segmentosKey, linhaEditavel]);

  // recentraliza
  useEffect(() => {
    if (mapRef.current && center) mapRef.current.setView(center, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]]);

  return <div ref={divRef} style={{ height: altura }} className="w-full overflow-hidden rounded-xl border border-slate-200" />;
}
