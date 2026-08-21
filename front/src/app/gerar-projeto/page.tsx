"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { UploadFoto } from "@/components/medir/upload-foto";
import { API_URL, estenderProjeto, gerarProjeto, getTerrenos, statusProjeto } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { Terreno } from "@/types/terreno";

type Status = "idle" | "processando" | "pronto" | "erro";
type Fonte = "upload" | "salvo";

export default function GerarProjeto() {
  const [fonte, setFonte] = useState<Fonte>("upload");
  const [terrenosSalvos, setTerrenosSalvos] = useState<Terreno[]>([]);
  const [terrenoSelecionadoId, setTerrenoSelecionadoId] = useState("");

  const [foto, setFoto] = useState<File | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoAlternativaUrl, setFotoAlternativaUrl] = useState<string | null>(null);
  const [referencia, setReferencia] = useState<File | null>(null);
  const [referenciaUrl, setReferenciaUrl] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [duracaoTotal, setDuracaoTotal] = useState(0);
  const [podeEstender, setPodeEstender] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getTerrenos()
      .then(setTerrenosSalvos)
      .catch(() => {});

    const ultimaDescricao = localStorage.getItem("gerarProjeto:ultimaDescricao");
    if (ultimaDescricao) setDescricao(ultimaDescricao);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function pollar(idJob: string) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      const atual = await statusProjeto(idJob);
      setDuracaoTotal(atual.duracao_total_s);
      setPodeEstender(atual.pode_estender);
      if (atual.status === "pronto" || atual.status === "erro") {
        setStatus(atual.status);
        if (atual.erro) setErro(atual.erro);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 4000);
  }

  function trocarFonte(nova: Fonte) {
    setFonte(nova);
    setFoto(null);
    setFotoUrl(null);
    setFotoAlternativaUrl(null);
    setTerrenoSelecionadoId("");
    setErro(null);
  }

  function aoSelecionarFoto(arquivo: File) {
    if (fonte === "salvo") {
      setFoto(arquivo);
      setFotoAlternativaUrl(URL.createObjectURL(arquivo));
      return;
    }
    setFoto(arquivo);
    setFotoUrl(URL.createObjectURL(arquivo));
  }

  function removerFoto() {
    setFoto(null);
    if (fonte === "salvo" && terrenoSelecionadoId) {
      setFotoAlternativaUrl(null);
      return;
    }
    setFotoUrl(null);
    setTerrenoSelecionadoId("");
  }

  function aoSelecionarReferencia(arquivo: File) {
    setReferencia(arquivo);
    setReferenciaUrl(URL.createObjectURL(arquivo));
  }

  function removerReferencia() {
    setReferencia(null);
    setReferenciaUrl(null);
  }

  function aoSelecionarTerreno(id: string) {
    setTerrenoSelecionadoId(id);
    setFoto(null);
    setFotoAlternativaUrl(null);
    setFotoUrl(id ? `${API_URL}/terrenos/${id}/foto` : null);
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
      return new File([blob], `terreno-${terrenoSelecionadoId}.jpg`, {
        type: blob.type || "image/jpeg",
      });
    } catch {
      setErro(
        "Não consegui carregar a foto desse terreno (ele pode ter sido medido antes desse recurso existir).",
      );
      return null;
    }
  }

  function montarDescricaoFinal(): string {
    if (fonte !== "salvo") return descricao;

    const terreno = terrenosSalvos.find((t) => t.id === terrenoSelecionadoId);
    if (!terreno) return descricao;

    const medidas =
      `Dados reais do terreno: área de ${terreno.area_m2.toFixed(0)} m² ` +
      `(${terreno.area_ha.toFixed(3)} ha), perímetro de ${terreno.perimetro_m.toFixed(1)} m. ` +
      `A construção deve respeitar essas dimensões reais do lote.`;

    return `${descricao.trim()}\n\n${medidas}`;
  }

  async function enviar() {
    if (!descricao.trim()) {
      setErro("Descreva o que você quer construir (casa, apartamento, galpão etc).");
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
      const inicial = await gerarProjeto(arquivo, montarDescricaoFinal(), referencia ?? undefined);
      setJobId(inicial.job_id);
      pollar(inicial.job_id);
    } catch (e) {
      setStatus("erro");
      setErro(e instanceof Error ? e.message : "Erro ao gerar o projeto");
    }
  }

  async function estender() {
    if (!jobId) return;
    setErro(null);
    setStatus("processando");
    try {
      await estenderProjeto(jobId);
      pollar(jobId);
    } catch (e) {
      setStatus("pronto");
      setErro(e instanceof Error ? e.message : "Erro ao estender o vídeo");
    }
  }

  const gerando = status === "processando";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Gerar Projeto IA</h1>
      <p className="mt-1 text-sm text-slate-500">
        Escolha a foto do terreno e descreva o tipo de construção (casa, apartamento, galpão
        etc). A geração leva alguns minutos.
      </p>

      <div className="mt-4 flex gap-4 text-sm">
        <button
          onClick={() => trocarFonte("upload")}
          className={
            fonte === "upload" ? "font-medium text-primary" : "text-slate-500 hover:text-slate-700"
          }
        >
          Nova foto
        </button>
        <button
          onClick={() => trocarFonte("salvo")}
          className={
            fonte === "salvo" ? "font-medium text-primary" : "text-slate-500 hover:text-slate-700"
          }
        >
          Terreno salvo
        </button>
      </div>

      {fonte === "salvo" && (
        <p className="mt-2 text-xs text-slate-400">
          A área e o perímetro reais do terreno escolhido são enviados junto pra IA
          automaticamente — você só descreve o tipo de construção.
        </p>
      )}

      {fonte === "upload" && (
        <div className="mt-4 max-w-md">
          <UploadFoto onSelecionar={aoSelecionarFoto} />
        </div>
      )}

      {fonte === "salvo" && (
        <div className="mt-4 max-w-md">
          <select
            value={terrenoSelecionadoId}
            onChange={(e) => aoSelecionarTerreno(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">Escolha um terreno...</option>
            {terrenosSalvos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome ?? t.nome_foto ?? t.id} — {t.area_ha.toFixed(3)} ha ({t.perimetro_m.toFixed(1)} m perímetro)
              </option>
            ))}
          </select>
          {terrenosSalvos.length === 0 && (
            <p className="mt-2 text-xs text-slate-400">Nenhum terreno salvo ainda.</p>
          )}
        </div>
      )}

      {fonte === "salvo" && terrenoSelecionadoId && (
        <div className="mt-4 max-w-md">
          <label className="block text-xs font-medium text-slate-500">
            Outra foto do mesmo terreno — opcional
          </label>
          <p className="mt-0.5 text-xs text-slate-400">
            Use uma foto inclinada ou tirada da rua. A área e o perímetro continuam vindo do terreno salvo.
          </p>
          <div className="mt-2">
            <UploadFoto
              onSelecionar={aoSelecionarFoto}
              titulo="Adicionar outra foto do mesmo terreno"
              ajuda="PNG ou JPG: use uma foto com boa visão da fachada e da rua"
            />
          </div>
        </div>
      )}

      {fotoUrl && (
        <div className="relative mt-4 max-w-md">
        <img
          src={fotoUrl}
          alt="Foto do terreno"
          className="w-full rounded-2xl border border-slate-200"
          onError={() => setErro("Esse terreno não tem foto salva.")}
        />
          {fonte === "upload" && (
          <button
            type="button"
            onClick={removerFoto}
            aria-label="Remover foto do terreno"
            title="Remover foto"
            className="absolute right-3 top-3 rounded-full bg-slate-900/80 p-2 text-white shadow-sm transition-colors hover:bg-red-600"
          >
            <X size={16} />
          </button>
          )}
        </div>
      )}

      {fotoAlternativaUrl && (
        <div className="relative mt-4 max-w-md">
          <p className="mb-2 text-xs font-medium text-slate-500">
            Foto adicional usada para gerar a fachada
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoAlternativaUrl}
            alt="Outra foto do mesmo terreno"
            className="w-full rounded-2xl border border-indigo-200"
          />
          <button
            type="button"
            onClick={removerFoto}
            aria-label="Remover foto adicional"
            title="Remover foto adicional"
            className="absolute right-3 top-9 rounded-full bg-slate-900/80 p-2 text-white shadow-sm transition-colors hover:bg-red-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mt-4 max-w-md">
        <label className="block text-xs font-medium text-slate-500">
          Foto de referência de estilo — opcional
        </label>
        <p className="mt-0.5 text-xs text-slate-400">
          Uma foto de uma casa pronta que a IA deve usar como inspiração de fachada/acabamento,
          em vez de inventar sozinha.
        </p>

        {!referenciaUrl && (
          <div className="mt-2">
            <UploadFoto
              onSelecionar={aoSelecionarReferencia}
              titulo="Clique ou arraste a foto da casa de referência"
              ajuda="Opcional: PNG ou JPG de uma casa cujo estilo você quer usar"
            />
          </div>
        )}

        {referenciaUrl && (
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={referenciaUrl}
              alt="Referência de estilo"
              className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
            />
            <Button variant="secondary" onClick={removerReferencia}>
              Remover referência
            </Button>
          </div>
        )}
      </div>

      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder='Ex: "casa térrea com piscina e jardim"'
        className="mt-4 w-full max-w-md rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm focus:border-primary focus:outline-none"
        rows={3}
      />

      <div className="mt-3">
        <Button onClick={enviar} disabled={gerando}>
          {gerando && <Loader2 size={16} className="animate-spin" />}
          {gerando ? "Gerando..." : "Gerar projeto"}
        </Button>
      </div>

      {erro && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
      )}

      {status === "processando" && (
        <p className="mt-4 text-sm text-slate-500">
          Processando job {jobId} — isso pode levar alguns minutos.
        </p>
      )}

      {status === "pronto" && jobId && (
        <div className="mt-4 flex flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${API_URL}/gerar-projeto/${jobId}/imagem`}
            alt="Projeto gerado"
            className="max-w-md rounded-2xl border border-slate-200"
          />
          <video
            key={duracaoTotal}
            src={`${API_URL}/gerar-projeto/${jobId}/video?v=${duracaoTotal}`}
            controls
            className="max-w-md rounded-2xl border border-slate-200"
          />
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-400">Duração atual: {duracaoTotal}s</p>
            <a
              href={`${API_URL}/videos-salvos/${jobId}/download`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Download size={16} /> Salvar vídeo
            </a>
            {podeEstender && (
              <Button variant="secondary" onClick={estender} disabled={gerando}>
                {gerando && <Loader2 size={14} className="animate-spin" />}
                {gerando ? "Estendendo..." : "Estender vídeo (+7s)"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
