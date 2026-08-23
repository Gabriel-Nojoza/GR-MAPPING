"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Download, ImageIcon, PlayCircle, Sparkles, Upload } from "lucide-react";
import { API_URL, getVideos, importarVideoExterno } from "@/lib/api";
import { Card } from "@/components/ui/card";
import type { JobResumo } from "@/types/job";

const STATUS = {
  processando: { label: "Processando", className: "bg-amber-50 text-amber-700" },
  pronto: { label: "Pronto", className: "bg-emerald-50 text-emerald-700" },
  erro: { label: "Não gerado", className: "bg-red-50 text-red-700" },
} as const;

function resumo(descricao: string | null) {
  if (!descricao) return "Projeto sem descrição";
  const primeiraFrase = descricao.replace(/\s+/g, " ").split(/[.!?]/)[0].trim();
  return primeiraFrase.length > 150 ? `${primeiraFrase.slice(0, 147)}...` : primeiraFrase;
}

export default function Videos() {
  const [videos, setVideos] = useState<JobResumo[]>([]);
  const [erro, setErro] = useState(false);
  const [enviando, setEnviando] = useState("");

  useEffect(() => {
    getVideos().then(setVideos).catch(() => setErro(true));
  }, []);

  async function importar(id: string, arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      setEnviando(id);
      await importarVideoExterno(id, arquivo);
      window.location.reload();
    } catch {
      setErro(true);
      setEnviando("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Projetos criados</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Visualizações</h1>
          <p className="mt-1 text-sm text-slate-500">Imagens geradas por IA e vídeos montados na VPS.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
          <Sparkles size={15} /> Vídeo econômico ativado
        </div>
      </div>

      {erro && (
        <Card className="mt-6 flex items-center gap-3 border-red-100 bg-red-50 text-sm text-red-700">
          <AlertCircle size={18} /> Não foi possível carregar os projetos agora.
        </Card>
      )}

      {!erro && videos.length === 0 && (
        <Card className="mt-6 py-12 text-center text-sm text-slate-400">Nenhum projeto gerado ainda.</Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {videos.map((video) => {
          const status = STATUS[video.status as keyof typeof STATUS] ?? STATUS.erro;
          return (
            <Card key={video.id} className="flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-800">{resumo(video.descricao)}</p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(video.criado_em).toLocaleString("pt-BR")}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
              </div>

              {video.status === "erro" && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  A geração não foi concluída. Verifique se há crédito para criar a imagem na IA.
                </p>
              )}

              {video.status === "pronto" && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 text-sm">
                  <a href={`${API_URL}/videos-salvos/${video.id}/imagem`} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
                    <ImageIcon size={16} /> Imagem
                  </a>
                  <a href={`${API_URL}/videos-salvos/${video.id}/video`} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
                    <PlayCircle size={16} /> Assistir
                  </a>
                  <a href={`${API_URL}/videos-salvos/${video.id}/download`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 font-medium text-white hover:bg-primary-hover">
                    <Download size={16} /> Baixar MP4
                  </a>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"><Upload size={16} /> {enviando === video.id ? "Importando..." : "Importar MP4 do Flow"}<input type="file" accept="video/mp4,.mp4" disabled={enviando === video.id} className="hidden" onChange={(event) => importar(video.id, event.target.files?.[0])} /></label>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
