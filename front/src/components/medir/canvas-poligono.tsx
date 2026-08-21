"use client";

import { useEffect, useRef } from "react";
import type { Ponto } from "@/types/medicao";

export function CanvasPoligono({
  imagemUrl,
  pontos,
  pontosReferencia = [],
  onAdicionarPonto,
}: {
  imagemUrl: string;
  pontos: Ponto[];
  pontosReferencia?: Ponto[];
  onAdicionarPonto: (ponto: Ponto) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagemRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = imagemUrl;
    img.onload = () => {
      imagemRef.current = img;
      desenhar();
    };
  }, [imagemUrl]);

  useEffect(() => {
    desenhar();
  }, [pontos, pontosReferencia]);

  function desenhar() {
    const canvas = canvasRef.current;
    const img = imagemRef.current;
    if (!canvas || !img) return;

    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);

    // linha de referência (distância conhecida), em laranja
    if (pontosReferencia.length > 0) {
      ctx.strokeStyle = "#ea580c";
      ctx.fillStyle = "#ea580c";
      ctx.lineWidth = 3;

      if (pontosReferencia.length === 2) {
        ctx.beginPath();
        ctx.moveTo(pontosReferencia[0].x, pontosReferencia[0].y);
        ctx.lineTo(pontosReferencia[1].x, pontosReferencia[1].y);
        ctx.stroke();
      }

      pontosReferencia.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // polígono do terreno, em azul
    if (pontos.length > 0) {
      ctx.strokeStyle = "#2563eb";
      ctx.fillStyle = "#2563eb";
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(pontos[0].x, pontos[0].y);
      pontos.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      if (pontos.length > 2) ctx.closePath();
      ctx.stroke();

      pontos.forEach((p, indice) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "bold 16px Arial";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.strokeText(`P${indice + 1}`, p.x + 10, p.y - 10);
        ctx.fillStyle = "#0f172a";
        ctx.fillText(`P${indice + 1}`, p.x + 10, p.y - 10);
        ctx.fillStyle = "#2563eb";
      });
    }
  }

  function aoClicar(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const escalaX = canvas.width / rect.width;
    const escalaY = canvas.height / rect.height;

    onAdicionarPonto({
      x: (e.clientX - rect.left) * escalaX,
      y: (e.clientY - rect.top) * escalaY,
    });
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={aoClicar}
      className="max-w-full cursor-crosshair rounded-2xl border border-slate-200 shadow-sm"
    />
  );
}
