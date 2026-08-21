"use client";

import { useState } from "react";
import { Gauge, Plane, Ruler } from "lucide-react";
import { UploadFoto } from "@/components/medir/upload-foto";
import { CanvasPoligono } from "@/components/medir/canvas-poligono";
import { ResultadoMedicao } from "@/components/medir/resultado-medicao";
import {
  analisarFoto,
  medirTerreno,
  medirTerrenoAltura,
  medirTerrenoManual,
} from "@/lib/api";
import type { Analise, Medicao, Ponto } from "@/types/medicao";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Modo = "auto" | "altura" | "referencia";

export default function MedirTerreno() {
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [medicao, setMedicao] = useState<Medicao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nomeTerreno, setNomeTerreno] = useState("");
  const [modo, setModo] = useState<Modo>("auto");
  const [alturaVoo, setAlturaVoo] = useState("");
  const [fov, setFov] = useState("");
  const [referenciaPontos, setReferenciaPontos] = useState<Ponto[]>([]);
  const [distanciaReferencia, setDistanciaReferencia] = useState("");

  async function aoSelecionarFoto(arquivo: File) {
    setErro(null);
    setMedicao(null);
    setAnalise(null);
    setPontos([]);
    setReferenciaPontos([]);
    setDistanciaReferencia("");
    setAlturaVoo("");
    setFov("");
    setNomeTerreno("");
    setModo("auto");
    setFoto(arquivo);
    setFotoUrl(URL.createObjectURL(arquivo));
    setCarregando(true);

    try {
      const resultado = await analisarFoto(arquivo);
      setAnalise(resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao analisar a foto");
    } finally {
      setCarregando(false);
    }
  }

  function aoClicarCanvas(p: Ponto) {
    if (modo === "referencia" && referenciaPontos.length < 2) {
      setReferenciaPontos((atual) => [...atual, p]);
      return;
    }
    setPontos((atual) => [...atual, p]);
  }

  function limparPontos() {
    setPontos([]);
    setReferenciaPontos([]);
  }

  async function calcularArea() {
    if (!foto || pontos.length < 3) {
      setErro("Marque pelo menos 3 pontos no terreno");
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      let resultado: Medicao;

      if (modo === "altura") {
        const altura = Number(alturaVoo.replace(",", "."));
        if (!altura || altura <= 0) {
          setErro("Informe a altura de voo em metros");
          return;
        }
        const fovNum = fov ? Number(fov.replace(",", ".")) : undefined;
        resultado = await medirTerrenoAltura(foto, pontos, altura, fovNum, nomeTerreno || undefined);
      } else if (modo === "referencia") {
        const distancia = Number(distanciaReferencia.replace(",", "."));
        if (referenciaPontos.length < 2) {
          setErro("Marque os 2 pontos de referência antes do polígono");
          return;
        }
        if (!distancia || distancia <= 0) {
          setErro("Informe a distância de referência em metros");
          return;
        }
        resultado = await medirTerrenoManual(
          foto,
          pontos,
          [referenciaPontos[0], referenciaPontos[1]],
          distancia,
          nomeTerreno || undefined,
        );
      } else {
        resultado = await medirTerreno(foto, pontos, nomeTerreno || undefined);
      }

      setMedicao(resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao medir o terreno");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Medir terreno</h1>
      <p className="mt-1 text-sm text-slate-500">
        Envie a foto aérea, marque o polígono do terreno e calcule a área.
      </p>

      {!fotoUrl && (
        <div className="mt-6 max-w-md">
          <UploadFoto onSelecionar={aoSelecionarFoto} />
        </div>
      )}

      {fotoUrl && (
        <div className="mt-4 max-w-sm">
          <label className="block text-xs font-medium text-slate-500">
            Nome / local do terreno — opcional
          </label>
          <input
            value={nomeTerreno}
            onChange={(e) => setNomeTerreno(e.target.value)}
            placeholder="ex: Sítio da esquina, R. Francisco Janes"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      )}

      {erro && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <p>{erro}</p>
          {modo === "auto" && fotoUrl && !analise && (
            <div className="mt-2 flex gap-4 text-sm font-medium">
              <button onClick={() => setModo("altura")} className="underline underline-offset-2">
                Usar altura de voo
              </button>
              <button
                onClick={() => setModo("referencia")}
                className="underline underline-offset-2"
              >
                Usar referência de distância
              </button>
            </div>
          )}
        </div>
      )}

      {modo === "altura" && (
        <Card className="mt-4 flex flex-wrap items-end gap-3 border-indigo-200 bg-indigo-50/50">
          <div className="flex items-start gap-2 text-sm text-indigo-900">
            <Plane size={16} className="mt-0.5 shrink-0" />
            <p>
              Digite a altura em que o drone estava ao tirar a foto (lida na tela do app durante
              o voo). Depois marque o polígono do terreno normalmente.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-indigo-900">
              Altura de voo (m)
            </label>
            <input
              value={alturaVoo}
              onChange={(e) => setAlturaVoo(e.target.value)}
              placeholder="ex: 45"
              className="mt-1 w-28 rounded-lg border border-indigo-200 bg-white p-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-indigo-900">
              Campo de visão (°) — opcional
            </label>
            <input
              value={fov}
              onChange={(e) => setFov(e.target.value)}
              placeholder="padrão: 82"
              className="mt-1 w-32 rounded-lg border border-indigo-200 bg-white p-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </Card>
      )}

      {modo === "referencia" && (
        <Card className="mt-4 flex flex-wrap items-end gap-3 border-orange-200 bg-orange-50/50">
          <div className="flex items-start gap-2 text-sm text-orange-800">
            <Ruler size={16} className="mt-0.5 shrink-0" />
            <p>
              Marque <strong>2 pontos</strong> na foto que representem uma distância que você já
              sabe (ex: a largura de um muro medida com trena) e digite essa distância. Só depois
              marque o polígono do terreno.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-orange-800">
              Distância de referência (m)
            </label>
            <input
              value={distanciaReferencia}
              onChange={(e) => setDistanciaReferencia(e.target.value)}
              placeholder="ex: 5.5"
              className="mt-1 w-32 rounded-lg border border-orange-200 bg-white p-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </Card>
      )}

      {fotoUrl && (
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CanvasPoligono
              imagemUrl={fotoUrl}
              pontos={pontos}
              pontosReferencia={referenciaPontos}
              onAdicionarPonto={aoClicarCanvas}
            />
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={limparPontos}>
                Limpar pontos
              </Button>
              <Button onClick={calcularArea} disabled={carregando || pontos.length < 3}>
                {carregando ? "Calculando..." : "Calcular área"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {analise && (
              <Card className="flex flex-col gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Gauge size={16} className="text-primary" />
                  <span>GSD: {analise.gsd_cm_por_px} cm/px</span>
                </div>
                <div className="flex items-center gap-2">
                  <Plane size={16} className="text-primary" />
                  <span>Altura do voo: {analise.altura_voo_m ?? "—"} m</span>
                </div>
              </Card>
            )}
            {medicao && <ResultadoMedicao medicao={medicao} />}
          </div>
        </div>
      )}
    </div>
  );
}
