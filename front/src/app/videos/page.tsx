import { ImageIcon, PlayCircle } from "lucide-react";
import { API_URL, getVideos } from "@/lib/api";
import { Card } from "@/components/ui/card";

const STATUS_LABEL: Record<string, string> = {
  processando: "Processando",
  pronto: "Pronto",
  erro: "Erro",
};

const STATUS_CLASS: Record<string, string> = {
  processando: "bg-amber-50 text-amber-700",
  pronto: "bg-green-50 text-green-700",
  erro: "bg-red-50 text-red-700",
};

export default async function Videos() {
  let videos;
  try {
    videos = await getVideos();
  } catch {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Visualizações (vídeos)</h1>
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          Não consegui falar com a API. Confirme que ela está rodando em{" "}
          <code>uvicorn app.main:app --reload</code>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Visualizações (vídeos)</h1>
      <p className="mt-1 text-sm text-slate-500">Projetos gerados por IA a partir das fotos.</p>

      <div className="mt-6 flex flex-col gap-3">
        {videos.length === 0 && (
          <Card className="text-sm text-slate-400">Nenhum projeto gerado ainda.</Card>
        )}
        {videos.map((v) => (
          <Card key={v.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">{v.descricao ?? "Sem descrição"}</p>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(v.criado_em).toLocaleString("pt-BR")}
              </p>
              {v.status === "erro" && v.erro && (
                <p className="mt-1 text-xs text-red-600">{v.erro}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[v.status]}`}
              >
                {STATUS_LABEL[v.status] ?? v.status}
              </span>
              {v.status === "pronto" && (
                <div className="flex gap-2 text-xs">
                  <a
                    href={`${API_URL}/videos-salvos/${v.id}/imagem`}
                    target="_blank"
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"
                  >
                    <ImageIcon size={14} /> Imagem
                  </a>
                  <a
                    href={`${API_URL}/videos-salvos/${v.id}/video`}
                    target="_blank"
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"
                  >
                    <PlayCircle size={14} /> Vídeo
                  </a>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
