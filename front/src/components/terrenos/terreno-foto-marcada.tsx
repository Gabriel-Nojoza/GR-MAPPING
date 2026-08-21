"use client";

import { useState } from "react";
import type { Terreno } from "@/types/terreno";
import { API_URL } from "@/lib/api";

export function TerrenoFotoMarcada({ terreno }: { terreno: Terreno }) {
  const [fotoComErro, setFotoComErro] = useState(false);
  const [dimensoes, setDimensoes] = useState<{ largura: number; altura: number } | null>(null);
  const temMarcacao = terreno.pontos.length >= 3;

  if (fotoComErro) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
        Sem foto salva para este terreno.
      </p>
    );
  }

  return (
    <div className="mt-3 inline-block max-w-full">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${API_URL}/terrenos/${terreno.id}/foto`}
          alt="Foto do terreno com a área marcada"
          className="block max-h-72 max-w-full rounded-xl border border-slate-200 object-contain"
          onError={() => setFotoComErro(true)}
          onLoad={(event) => setDimensoes({
            largura: event.currentTarget.naturalWidth,
            altura: event.currentTarget.naturalHeight,
          })}
        />

        {temMarcacao && dimensoes && (
          <svg
            className="pointer-events-none absolute inset-0 size-full"
            viewBox={`0 0 ${dimensoes.largura} ${dimensoes.altura}`}
            preserveAspectRatio="none"
            aria-label="Área do terreno marcada"
          >
            <polygon
              points={terreno.pontos.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="rgba(37, 99, 235, 0.22)"
              stroke="#2563eb"
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
            />
            {terreno.pontos.map(([x, y], indice) => (
              <circle key={indice} cx={x} cy={y} r="6" fill="#2563eb" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
        )}

        <div className="absolute left-3 top-3 rounded-lg bg-slate-950/80 px-3 py-2 text-xs font-medium text-white shadow-sm">
          {terreno.area_ha.toFixed(3)} ha · {terreno.area_m2.toFixed(0)} m²
          <span className="ml-2 text-slate-300">{terreno.perimetro_m.toFixed(1)} m</span>
        </div>
      </div>

      {!temMarcacao && (
        <p className="mt-2 text-xs text-slate-400">A marcação não está disponível para medições antigas.</p>
      )}
    </div>
  );
}
