"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, QrCode, Server, Smartphone } from "lucide-react";
import { API_URL, conectarWhatsapp, getWhatsappStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type StatusWhatsapp = { configurada: boolean; instancia?: string; estado: string; erro?: string };

export default function Configuracoes() {
  const [status, setStatus] = useState<StatusWhatsapp | null>(null);
  const [qrcode, setQrcode] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const conectado = status?.estado === "open";

  async function carregar() {
    try {
      const atual = await getWhatsappStatus();
      setStatus(atual);
      if (atual.estado === "open") setQrcode("");
    } catch {
      setErro("Não foi possível consultar o WhatsApp.");
    }
  }

  useEffect(() => { void carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!qrcode || conectado) return;
    const intervalo = window.setInterval(() => void carregar(), 3000);
    return () => window.clearInterval(intervalo);
  }, [qrcode, conectado]); // eslint-disable-line react-hooks/exhaustive-deps

  async function conectar() {
    setCarregando(true);
    setErro("");
    try {
      const resultado = await conectarWhatsapp();
      setQrcode(resultado.qrcode);
      await carregar();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível gerar o QR Code.");
    } finally {
      setCarregando(false);
    }
  }

  return <div className="mx-auto max-w-3xl">
    <h1 className="text-2xl font-semibold text-slate-900">Configurações</h1>
    <p className="mt-1 text-sm text-slate-500">Integrações e configurações seguras da plataforma.</p>
    <div className="mt-6 flex flex-col gap-4">
      <Card><div className="flex items-center gap-2 text-sm font-medium text-slate-500"><Server size={16} className="text-primary" /> Backend</div><p className="mt-3 text-sm text-slate-700">URL da API: <code className="rounded bg-slate-100 px-1.5 py-0.5">{API_URL}</code></p></Card>
      <Card><div className="flex items-center gap-2 text-sm font-medium text-slate-500"><KeyRound size={16} className="text-primary" /> Chave da IA</div><p className="mt-3 text-sm text-slate-500">A chave Gemini fica somente no servidor e não é exposta nesta tela.</p></Card>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><div className={`rounded-xl p-2.5 ${conectado ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{conectado ? <CheckCircle2 size={20} /> : <Smartphone size={20} />}</div><div><h2 className="font-semibold text-slate-800">WhatsApp da imobiliária</h2><p className="mt-1 text-sm text-slate-500">Usado para lembretes automáticos de cobrança.</p><p className={`mt-2 text-xs font-medium ${conectado ? "text-emerald-700" : "text-amber-700"}`}>{conectado ? "● Conectado e pronto para enviar" : `● ${status?.estado ?? "Verificando..."}`}{status?.instancia ? ` · ${status.instancia}` : ""}</p></div></div><Button onClick={conectar} disabled={carregando || conectado}>{carregando ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}{conectado ? "WhatsApp conectado" : "Conectar WhatsApp"}</Button></div>
        {qrcode && !conectado && <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center"><p className="text-sm font-medium text-slate-700">Escaneie o QR Code no WhatsApp da imobiliária</p><p className="mt-1 text-xs text-slate-500">WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho.</p><p className="mt-3 text-xs text-amber-700">Aguardando confirmação. Esta tela será atualizada automaticamente.</p><img src={qrcode} alt="QR Code para conectar WhatsApp" className="mx-auto mt-4 h-64 w-64 rounded-lg bg-white p-2" /></div>}
        {erro && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      </Card>
    </div>
  </div>;
}
