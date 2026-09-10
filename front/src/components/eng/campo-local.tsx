"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";

const CONTROLE = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary";

type Sugestao = { nome: string; lat: number; lon: number };

/** aceita "3°50'37.8\"S 38°39'28.9\"W", "-3.844, -38.657", "3.844 S 38.657 W" */
export function parseCoord(txt: string): { lat: number; lon: number } | null {
  const t = txt.trim();
  const dms = /(\d+)\s*°\s*(\d+)\s*['′]\s*([\d.]+)\s*["″]?\s*([NSLOWnslow])/g;
  const achados = [...t.matchAll(dms)];
  if (achados.length === 2) {
    const conv = (m: RegExpMatchArray) => {
      const v = Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600;
      const h = m[4].toUpperCase();
      return h === "S" || h === "W" || h === "O" ? -v : v;
    };
    const a = conv(achados[0]);
    const b = conv(achados[1]);
    // o primeiro que tem N/S é latitude
    const h0 = achados[0][4].toUpperCase();
    const [lat, lon] = h0 === "N" || h0 === "S" ? [a, b] : [b, a];
    return { lat, lon };
  }
  const dec = t.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (dec) {
    const lat = Number(dec[1]);
    const lon = Number(dec[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
  }
  return null;
}

export function CampoLocal({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (texto: string, lat: number | null, lon: number | null) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setTexto(valor); }, [valor]);

  const coord = parseCoord(texto);

  function digitou(v: string) {
    setTexto(v);
    const c = parseCoord(v);
    onChange(v, c?.lat ?? null, c?.lon ?? null);
    if (timer.current) clearTimeout(timer.current);
    if (c || v.trim().length < 3) { setSugestoes([]); setAberto(false); return; }
    timer.current = setTimeout(() => void buscar(v), 450);
  }

  async function buscar(q: string) {
    try {
      setBuscando(true);
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=br&addressdetails=0&q=${encodeURIComponent(q)}`,
        { headers: { "Accept-Language": "pt-BR" } },
      );
      const dados = await r.json();
      setSugestoes((dados ?? []).map((d: { display_name: string; lat: string; lon: string }) => ({
        nome: d.display_name, lat: Number(d.lat), lon: Number(d.lon),
      })));
      setAberto(true);
    } catch { /* silencioso */ }
    finally { setBuscando(false); }
  }

  function escolher(s: Sugestao) {
    setTexto(s.nome);
    onChange(s.nome, s.lat, s.lon);
    setAberto(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={texto}
          onChange={(e) => digitou(e.target.value)}
          onFocus={() => sugestoes.length && setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder='Rua, bairro, cidade…  ou  3°50&apos;37.8"S 38°39&apos;28.9"W'
          className={`${CONTROLE} pl-8`}
        />
      </div>
      {coord && (
        <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
          <MapPin size={12} /> {coord.lat.toFixed(5)}, {coord.lon.toFixed(5)}
        </p>
      )}
      {buscando && <p className="mt-1 text-xs text-slate-400">buscando…</p>}
      {aberto && sugestoes.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-lg">
          {sugestoes.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); escolher(s); }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50"
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                <span className="text-slate-700">{s.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
