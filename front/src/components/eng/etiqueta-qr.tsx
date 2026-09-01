"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Etiqueta QR pra colar no teto da máquina. O QR carrega o id da máquina;
 * o número grande é pra leitura visual / conferência manual.
 */
export function EtiquetaQr({
  id,
  nome,
  numero,
  onFechar,
}: {
  id: string;
  nome: string;
  numero: string;
  onFechar: () => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);

  function imprimir() {
    const html = areaRef.current?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Etiqueta ${numero}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: system-ui, sans-serif; text-align: center; }
        .num { font-size: 120px; font-weight: 800; letter-spacing: 2px; margin: 8px 0 0; }
        .nome { font-size: 22px; color: #333; }
        svg { width: 90vw; max-width: 700px; height: auto; }
        .aviso { margin-top: 16px; font-size: 13px; color: #666; }
      </style></head><body>${html}
      <p class="aviso">Imprima em tamanho grande (≥ 1 m), material fosco. Fixe no teto da máquina, virado pra cima.</p>
      <script>window.onload = () => { window.print(); }</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">Etiqueta QR</h2>
            <p className="text-xs text-slate-500">Cola no teto da máquina, virada pra cima.</p>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div ref={areaRef} className="mt-4 rounded-xl border border-slate-200 p-6 text-center">
          <QRCodeSVG value={`GRM:${id}`} size={220} level="M" marginSize={2} className="mx-auto" />
          <p className="num" style={{ fontSize: 56, fontWeight: 800, margin: "8px 0 0" }}>{numero}</p>
          <p className="nome" style={{ fontSize: 14, color: "#475569" }}>{nome}</p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onFechar}>Fechar</Button>
          <Button onClick={imprimir}><Printer size={16} /> Imprimir</Button>
        </div>
      </div>
    </div>
  );
}
