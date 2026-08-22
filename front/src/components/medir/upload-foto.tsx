"use client";

import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, UploadCloud } from "lucide-react";

export function UploadFoto({
  onSelecionar,
  titulo = "Clique ou arraste a foto do terreno",
  ajuda = "PNG ou JPG, foto original do drone",
  compacto = false,
}: {
  onSelecionar: (arquivo: File) => void;
  titulo?: string;
  ajuda?: string;
  compacto?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  function tratarArquivo(arquivo: File | undefined) {
    if (arquivo) onSelecionar(arquivo);
  }

  function aoSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    tratarArquivo(e.dataTransfer.files?.[0]);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={aoSoltar}
      className={`group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center transition-colors ${compacto ? "h-28" : "h-52"} ${
        arrastando
          ? "border-primary bg-indigo-50"
          : "border-slate-300 bg-white hover:border-primary hover:bg-indigo-50/40"
      }`}
    >
      <div className={`flex items-center justify-center rounded-full bg-indigo-50 text-primary transition-colors group-hover:bg-indigo-100 ${compacto ? "h-9 w-9" : "h-12 w-12"}`}>
        {arrastando ? <ImagePlus size={compacto ? 18 : 22} /> : <UploadCloud size={compacto ? 18 : 22} />}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">{titulo}</p>
        <p className="mt-1 text-xs text-slate-400">{ajuda}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => tratarArquivo(e.target.files?.[0])}
      />
    </div>
  );
}
