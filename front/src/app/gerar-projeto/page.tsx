"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, Loader2, Maximize2, Sparkles, X } from "lucide-react";
import { UploadFoto } from "@/components/medir/upload-foto";
import { API_URL, estenderProjeto, gerarProjeto, getTerrenos, statusProjeto } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Terreno } from "@/types/terreno";

type Status = "idle" | "processando" | "pronto" | "erro";
type Fonte = "upload" | "salvo";

export default function GerarProjeto() {
  const [fonte, setFonte] = useState<Fonte>("upload");
  const [terrenosSalvos, setTerrenosSalvos] = useState<Terreno[]>([]);
  const [terrenoSelecionadoId, setTerrenoSelecionadoId] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotosAdicionais, setFotosAdicionais] = useState<File[]>([]);
  const [referencia, setReferencia] = useState<File | null>(null);
  const [referenciaUrl, setReferenciaUrl] = useState<string | null>(null);
  const [imagemAmpliada, setImagemAmpliada] = useState<{ url: string; titulo: string } | null>(null);
  const [descricao, setDescricao] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("gerarProjeto:ultimaDescricao") ?? "",
  );
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [duracaoTotal, setDuracaoTotal] = useState(0);
  const [podeEstender, setPodeEstender] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getTerrenos().then(setTerrenosSalvos).catch(() => {});
  }, []);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  function pollar(idJob: string) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      try {
        const atual = await statusProjeto(idJob);
        setDuracaoTotal(atual.duracao_total_s);
        setPodeEstender(atual.pode_estender);
        if (atual.status === "pronto" || atual.status === "erro") {
          setStatus(atual.status);
          if (atual.erro) setErro(atual.erro);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        setStatus("erro");
        setErro("Não foi possível acompanhar a geração. Tente atualizar a página.");
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 4000);
  }

  function trocarFonte(nova: Fonte) {
    setFonte(nova);
    setFoto(null);
    setFotoUrl(null);
    setFotosAdicionais([]);
    setTerrenoSelecionadoId("");
    setErro(null);
  }

  function aoSelecionarFoto(arquivo: File) {
    setFoto(arquivo);
    setFotoUrl(URL.createObjectURL(arquivo));
  }

  function aoSelecionarTerreno(id: string) {
    setTerrenoSelecionadoId(id);
    setFoto(null);
    setFotoUrl(id ? `${API_URL}/terrenos/${id}/foto` : null);
  }

  function removerFoto() {
    setFoto(null);
    setFotoUrl(null);
    setTerrenoSelecionadoId("");
  }

  function aoSelecionarReferencia(arquivo: File) {
    setReferencia(arquivo);
    setReferenciaUrl(URL.createObjectURL(arquivo));
  }

  function adicionarFotoTerreno(arquivo: File) {
    setFotosAdicionais((atuais) => [...atuais, arquivo].slice(0, 3));
  }

  function removerFotoAdicional(indice: number) {
    setFotosAdicionais((atuais) => atuais.filter((_, atual) => atual !== indice));
  }

  async function obterArquivo(): Promise<File | null> {
    if (fonte === "upload") return foto;
    if (!terrenoSelecionadoId) {
      setErro("Escolha um terreno salvo.");
      return null;
    }
    if (foto) return foto;
    try {
      const res = await fetch(`${API_URL}/terrenos/${terrenoSelecionadoId}/foto`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      return new File([blob], `terreno-${terrenoSelecionadoId}.jpg`, { type: blob.type || "image/jpeg" });
    } catch {
      setErro("Não consegui carregar a foto deste terreno salvo.");
      return null;
    }
  }

  function montarDescricaoFinal() {
    const terreno = terrenosSalvos.find((item) => item.id === terrenoSelecionadoId);
    if (fonte !== "salvo" || !terreno) return descricao.trim();
    return `${descricao.trim()}\n\nDados reais do terreno: área de ${terreno.area_m2.toFixed(0)} m² (${terreno.area_ha.toFixed(3)} ha) e perímetro de ${terreno.perimetro_m.toFixed(1)} m. A construção deve respeitar essas dimensões e os limites do lote.`;
  }

  async function enviar() {
    if (!descricao.trim()) {
      setErro("Descreva o que você quer construir.");
      return;
    }
    localStorage.setItem("gerarProjeto:ultimaDescricao", descricao);
    const arquivo = await obterArquivo();
    if (!arquivo) return;

    setErro(null);
    setStatus("processando");
    setJobId(null);
    setDuracaoTotal(0);
    setPodeEstender(false);
    try {
      const inicial = await gerarProjeto(
        arquivo,
        montarDescricaoFinal(),
        referencia ?? undefined,
        fotosAdicionais,
      );
      setJobId(inicial.job_id);
      pollar(inicial.job_id);
    } catch (causa) {
      setStatus("erro");
      setErro(causa instanceof Error ? causa.message : "Erro ao gerar o projeto.");
    }
  }

  async function estender() {
    if (!jobId) return;
    setStatus("processando");
    try {
      await estenderProjeto(jobId);
      pollar(jobId);
    } catch (causa) {
      setStatus("pronto");
      setErro(causa instanceof Error ? causa.message : "Erro ao estender o vídeo.");
    }
  }

  const gerando = status === "processando";
  const terrenoAtual = terrenosSalvos.find((item) => item.id === terrenoSelecionadoId);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Criação assistida</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Gerar projeto IA</h1>
          <p className="mt-1 text-sm text-slate-500">Gere uma visualização imobiliária em vídeo real com IA, a partir da foto do terreno.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
          <Sparkles size={15} /> Vídeo real com IA
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Card className="p-5 sm:p-6">
          <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
            <button onClick={() => trocarFonte("upload")} className={`flex-1 rounded-lg px-3 py-2 transition ${fonte === "upload" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}>Nova foto</button>
            <button onClick={() => trocarFonte("salvo")} className={`flex-1 rounded-lg px-3 py-2 transition ${fonte === "salvo" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}>Terreno salvo</button>
          </div>

          <div className="mt-5">
            {fonte === "upload" ? (
              <UploadFoto onSelecionar={aoSelecionarFoto} compacto />
            ) : (
              <>
                <label className="text-sm font-medium text-slate-700">Escolha o terreno medido</label>
                <select value={terrenoSelecionadoId} onChange={(event) => aoSelecionarTerreno(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-primary">
                  <option value="">Selecionar terreno...</option>
                  {terrenosSalvos.map((item) => <option key={item.id} value={item.id}>{item.nome ?? item.nome_foto ?? item.id} — {item.area_m2.toFixed(0)} m²</option>)}
                </select>
                {terrenoAtual && <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">Área: {terrenoAtual.area_m2.toFixed(0)} m² · Perímetro: {terrenoAtual.perimetro_m.toFixed(1)} m. Essas medidas serão enviadas à IA.</p>}
              </>
            )}
          </div>

          {fotoUrl && <div className="relative mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoUrl} alt="Foto do terreno" className="h-64 w-full object-cover" onError={() => setErro("Este terreno não tem uma foto disponível.")} />
            <div className="absolute right-3 top-3 flex gap-2">
              <button type="button" onClick={() => setImagemAmpliada({ url: fotoUrl, titulo: "Foto principal do terreno" })} className="inline-flex items-center gap-1 rounded-lg bg-slate-900/80 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-900"><Maximize2 size={14} /> Ampliar</button>
              <button type="button" onClick={removerFoto} aria-label="Remover foto" className="rounded-lg bg-slate-900/80 p-1.5 text-white hover:bg-red-600"><X size={16} /></button>
            </div>
          </div>}

          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="text-sm font-medium text-slate-700">Mais fotos do terreno <span className="font-normal text-slate-400">(opcional)</span></p>
            <p className="mt-1 text-xs text-slate-500">Adicione até 3 ângulos extras da rua, laterais ou fundo. A IA usará todas para entender melhor o lote.</p>
            {fotosAdicionais.length > 0 && <div className="mt-3 grid grid-cols-3 gap-3">
              {fotosAdicionais.map((arquivo, indice) => <div key={`${arquivo.name}-${indice}`} className="relative overflow-hidden rounded-lg border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(arquivo)} alt={`Foto adicional ${indice + 1}`} className="h-20 w-full object-cover" />
                <div className="absolute right-1 top-1 flex gap-1"><button type="button" onClick={() => setImagemAmpliada({ url: URL.createObjectURL(arquivo), titulo: `Foto adicional ${indice + 1}` })} aria-label={`Ampliar foto adicional ${indice + 1}`} className="rounded bg-slate-900/80 p-1 text-white"><Maximize2 size={13} /></button><button type="button" onClick={() => removerFotoAdicional(indice)} aria-label={`Remover foto adicional ${indice + 1}`} className="rounded bg-slate-900/80 p-1 text-white hover:bg-red-600"><X size={13} /></button></div>
              </div>)}
            </div>}
            {fotosAdicionais.length < 3 && <div className="mt-3"><UploadFoto onSelecionar={adicionarFotoTerreno} titulo={`Adicionar foto do terreno (${fotosAdicionais.length}/3)`} ajuda="Foto da rua, lateral ou fundo do mesmo lote" compacto /></div>}
          </div>

          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="text-sm font-medium text-slate-700">Foto de referência de estilo <span className="font-normal text-slate-400">(opcional)</span></p>
            <p className="mt-1 text-xs text-slate-500">Envie uma casa de referência para inspirar fachada, cores e acabamento.</p>
            {!referenciaUrl ? <div className="mt-3"><UploadFoto onSelecionar={aoSelecionarReferencia} titulo="Adicionar referência de estilo" ajuda="PNG ou JPG de uma casa pronta" compacto /></div> : <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={referenciaUrl} alt="Referência de estilo" className="h-16 w-20 rounded-lg object-cover" />
              <span className="flex-1 text-sm text-slate-600">Referência adicionada</span>
              <Button variant="secondary" onClick={() => setImagemAmpliada({ url: referenciaUrl, titulo: "Referência de estilo" })}><Maximize2 size={15} /> Ampliar</Button>
              <Button variant="secondary" onClick={() => { setReferencia(null); setReferenciaUrl(null); }}>Remover</Button>
            </div>}
          </div>
        </Card>

        <Card className="flex flex-col p-5 sm:p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-primary"><ImagePlus size={20} /></div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Descreva o projeto</h2>
          <p className="mt-1 text-sm text-slate-500">Informe a construção, acabamentos e ambientes desejados. Quanto mais direto, melhor.</p>
          <textarea value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Ex.: Casa contemporânea de dois pavimentos, piscina, garagem para dois carros, jardim e fachada em concreto e vidro." className="mt-5 min-h-48 w-full resize-y rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 outline-none focus:border-primary" />
          <p className="mt-2 text-xs text-slate-400">A foto do terreno continua sendo a referência principal de posição e proporção.</p>
          <Button onClick={enviar} disabled={gerando} className="mt-5 w-full">
            {gerando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {gerando ? "Gerando vídeo real..." : "Gerar vídeo"}
          </Button>
          {status === "processando" && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">A IA está criando o vídeo. Esse processo pode levar alguns minutos.</p>}
          {erro && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        </Card>
      </div>

      {status === "pronto" && jobId && <Card className="mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Vídeo pronto</h2><p className="text-sm text-slate-500">Visualização em vídeo real gerada por IA ({duracaoTotal}s).</p></div><a href={`${API_URL}/videos-salvos/${jobId}/download`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover"><Download size={16} /> Baixar MP4</a></div>
        <video key={duracaoTotal} src={`${API_URL}/gerar-projeto/${jobId}/video?v=${duracaoTotal}`} controls className="mt-5 w-full rounded-xl border border-slate-200" />
        {podeEstender && <Button variant="secondary" onClick={estender} className="mt-5">Estender vídeo (+7s)</Button>}
      </Card>}

      {imagemAmpliada && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label={imagemAmpliada.titulo} onClick={() => setImagemAmpliada(null)}>
        <div className="relative max-h-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
          <p className="mb-2 text-sm font-medium text-white">{imagemAmpliada.titulo}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagemAmpliada.url} alt={imagemAmpliada.titulo} className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl" />
          <button type="button" onClick={() => setImagemAmpliada(null)} className="absolute right-2 top-8 rounded-full bg-slate-950/80 p-2 text-white hover:bg-red-600" aria-label="Fechar imagem ampliada"><X size={18} /></button>
        </div>
      </div>}
    </div>
  );
}
