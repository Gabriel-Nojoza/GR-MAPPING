"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as L from "leaflet";

export type PontoMapa = { lat: number; lon: number; cor?: string; titulo?: string };
export type SegmentoMapa = { a: PontoMapa; b: PontoMapa; cor?: string; tracejado?: boolean };

const CENTRO_PADRAO: [number, number] = [-14.2, -51.9]; // centro do Brasil
const ZOOM_BRASIL = 4;

export function Mapa({
  center,
  zoom = 16,
  linha,
  linhaEditavel = false,
  onLinhaChange,
  pontos = [],
  segmentos = [],
  onClique,
  busca = false,
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
  busca?: boolean;
  altura?: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const [termo, setTermo] = useState("");
  const [buscando, setBuscando] = useState(false);
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
      const map = leaflet.map(divRef.current, {
        center: center ?? CENTRO_PADRAO,
        zoom: center ? zoom : ZOOM_BRASIL,
        worldCopyJump: true,
      });
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

  async function geocodificar(e: React.FormEvent) {
    e.preventDefault();
    if (!termo.trim() || !mapRef.current) return;
    try {
      setBuscando(true);
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(termo)}`,
        { headers: { "Accept-Language": "pt-BR" } },
      );
      const dados = await r.json();
      if (dados[0]) {
        mapRef.current.setView([Number(dados[0].lat), Number(dados[0].lon)], 17);
      }
    } catch {
      /* silencioso */
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="relative w-full">
      {busca && (
        <form onSubmit={geocodificar} className="absolute left-2 right-2 top-2 z-[500] flex gap-2 sm:left-14 sm:right-auto sm:w-80">
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar endereço / cidade da obra"
            className="w-full rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-sm shadow-sm outline-none focus:border-primary"
          />
          <button type="submit" disabled={buscando} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60">
            {buscando ? "…" : "Ir"}
          </button>
        </form>
      )}
      <div ref={divRef} style={{ height: altura }} className="w-full overflow-hidden rounded-xl border border-slate-200" />
    </div>
  );
}
