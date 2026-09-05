"use client";

import { useEffect, useState } from "react";
import { LifeBuoy, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listarChamadosAdmin, responderChamado, type ChamadoAdmin } from "@/lib/admin-api";

const STATUS_ROTULO: Record<ChamadoAdmin["status"], { texto: string; cor: string }> = {
  aberto: { texto: "aberto", cor: "bg-amber-50 text-amber-700" },
  respondido: { texto: "respondido", cor: "bg-emerald-50 text-emerald-700" },
  fechado: { texto: "encerrado", cor: "bg-slate-100 text-slate-600" },
};

export default function ChamadosAdminPage() {
  const [chamados, setChamados] = useState<ChamadoAdmin[]>([]);
  const [erro, setErro] = useState("");
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | ChamadoAdmin["status"]>("todos");

  async function carregar() {
    try { setChamados(await listarChamadosAdmin()); } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar os chamados."); }
  }
  useEffect(() => { void carregar(); }, []);

  async function responder(c: ChamadoAdmin, status: "respondido" | "fechado") {
    const resposta = (rascunhos[c.id] ?? c.resposta ?? "").trim();
    if (status === "respondido" && !resposta) { setErro("Escreva uma resposta antes de enviar."); return; }
    try {
      setEnviandoId(c.id); setErro("");
      const atualizado = await responderChamado(c.id, { resposta: resposta || c.resposta || "Encerrado.", status });
      setChamados((lista) => lista.map((x) => (x.id === c.id ? atualizado : x)));
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível responder."); }
    finally { setEnviandoId(null); }
  }

  const filtrados = filtro === "todos" ? chamados : chamados.filter((c) => c.status === filtro);
  const abertos = chamados.filter((c) => c.status === "aberto").length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Administração Master</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Chamados</h1>
          <p className="mt-1 text-sm text-slate-500">Pedidos e dúvidas enviados pelas empresas clientes.</p>
        </div>
        <div className="rounded-full bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">{abertos} em aberto</div>
      </div>

      <div className="mt-5 flex gap-2">
        {(["todos", "aberto", "respondido", "fechado"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${filtro === f ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {f === "todos" ? "Todos" : STATUS_ROTULO[f].texto}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtrados.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-400">Nenhum chamado por aqui.</Card>
        ) : filtrados.map((c) => (
          <Card key={c.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-semibold text-slate-800"><LifeBuoy size={15} className="text-primary" /> {c.assunto || "Sem assunto"}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {c.empresa_nome} · {c.usuario_nome || c.usuario_email || "usuário"} · {new Date(c.criado_em).toLocaleString("pt-BR")}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_ROTULO[c.status].cor}`}>{STATUS_ROTULO[c.status].texto}</span>
            </div>
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{c.mensagem}</p>

            {c.status !== "fechado" && (
              <div className="mt-3">
                <textarea
                  value={rascunhos[c.id] ?? c.resposta ?? ""}
                  onChange={(e) => setRascunhos((r) => ({ ...r, [c.id]: e.target.value }))}
                  placeholder="Escreva a resposta..."
                  className="min-h-20 w-full resize-y rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-primary"
                />
                <div className="mt-2 flex gap-2">
                  <Button onClick={() => void responder(c, "respondido")} disabled={enviandoId === c.id}><Send size={14} /> Responder</Button>
                  <Button variant="secondary" onClick={() => void responder(c, "fechado")} disabled={enviandoId === c.id}>Encerrar</Button>
                </div>
              </div>
            )}
            {c.status === "fechado" && c.resposta && (
              <div className="mt-3 rounded-lg bg-emerald-50/50 p-3">
                <p className="text-xs font-medium text-emerald-700">Sua resposta</p>
                <p className="mt-1 text-sm text-slate-700">{c.resposta}</p>
              </div>
            )}
          </Card>
        ))}
      </div>
      {erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
