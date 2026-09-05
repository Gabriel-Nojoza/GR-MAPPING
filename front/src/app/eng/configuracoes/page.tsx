"use client";

import { useEffect, useState } from "react";
import { LifeBuoy, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { abrirChamado, getChamados, type Chamado } from "@/lib/api";

const STATUS_ROTULO: Record<Chamado["status"], { texto: string; cor: string }> = {
  aberto: { texto: "aguardando resposta", cor: "bg-amber-50 text-amber-700" },
  respondido: { texto: "respondido", cor: "bg-emerald-50 text-emerald-700" },
  fechado: { texto: "encerrado", cor: "bg-slate-100 text-slate-600" },
};

export default function ConfiguracoesEngPage() {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  async function carregar() {
    try { setChamados(await getChamados()); } catch { /* silencioso */ }
  }
  useEffect(() => { void carregar(); }, []);

  async function enviar() {
    if (!mensagem.trim()) { setErro("Escreva a mensagem do chamado."); return; }
    try {
      setEnviando(true); setErro(""); setAviso("");
      await abrirChamado({ assunto: assunto.trim() || undefined, mensagem: mensagem.trim() });
      setAssunto(""); setMensagem("");
      setAviso("Chamado enviado! O administrador do sistema vai responder por aqui.");
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível enviar o chamado."); }
    finally { setEnviando(false); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-900">Configurações</h1>
      <p className="mt-1 text-sm text-slate-500">Precisa de algo verificado, ajustado ou adicionado no sistema? Fale direto com o administrador.</p>

      <Card className="mt-6 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800"><LifeBuoy size={18} className="text-primary" /> Abrir chamado</h2>
        <div className="mt-4 space-y-3">
          <input
            value={assunto} onChange={(e) => setAssunto(e.target.value)}
            placeholder="Assunto (opcional)"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <textarea
            value={mensagem} onChange={(e) => setMensagem(e.target.value)}
            placeholder="Descreva o que precisa — um ajuste, uma dúvida, algo pra verificar..."
            className="min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 outline-none focus:border-primary"
          />
          <Button onClick={() => void enviar()} disabled={enviando}><Send size={15} />{enviando ? "Enviando..." : "Enviar chamado"}</Button>
        </div>
        {aviso && <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-primary">{aviso}</p>}
        {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      </Card>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-800">Seus chamados</h2></div>
        {chamados.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">Nenhum chamado ainda.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {chamados.map((c) => (
              <div key={c.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-700">{c.assunto || "Sem assunto"}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_ROTULO[c.status].cor}`}>{STATUS_ROTULO[c.status].texto}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{new Date(c.criado_em).toLocaleString("pt-BR")}</p>
                <p className="mt-2 text-sm text-slate-600">{c.mensagem}</p>
                {c.resposta && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Resposta do administrador</p>
                    <p className="mt-1 text-sm text-slate-700">{c.resposta}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
