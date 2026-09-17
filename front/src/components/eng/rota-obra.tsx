"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mapa, type PontoMapa } from "@/components/eng/mapa";
import {
  atualizarFrente, atualizarRecursoEng, criarFrente, excluirFrente, getFrentes,
  type Frente, type RecursoEng,
} from "@/lib/api";
import { comprimentoLinha } from "@/lib/geo";
import { corDoMarco, marcosDaObra, TIPOS_MARCO, type Marco } from "@/lib/marcos";

/** Desenha (ou importa por KMZ, noutra tela) o traçado de um trecho da obra —
 * alternativa manual ao KMZ, útil pra testar rápido ou ajustar um trecho. */
export function RotaObra({
  obra,
  onFechar,
  onMudou,
}: {
  obra: RecursoEng;
  onFechar: () => void;
  onMudou: () => void;
}) {
  const [modo, setModo] = useState<"trecho" | "marco">("trecho");
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [editando, setEditando] = useState<Frente | null>(null);
  const [pontos, setPontos] = useState<[number, number][]>([]);
  const [nome, setNome] = useState("");
  const [diametro, setDiametro] = useState("");
  const [material, setMaterial] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  const marcos = useMemo(() => marcosDaObra(obra.dados), [obra]);
  const [adicionandoMarco, setAdicionandoMarco] = useState(false);
  const [pendente, setPendente] = useState<{ lat: number; lon: number } | null>(null);
  const [marcoNome, setMarcoNome] = useState("");
  const [marcoTipo, setMarcoTipo] = useState(TIPOS_MARCO[0].valor);
  const [salvandoMarco, setSalvandoMarco] = useState(false);

  const lat = Number(obra.dados.localizacao_lat);
  const lon = Number(obra.dados.localizacao_lon);
  const center: [number, number] | null = pontos.length
    ? [pontos[0][1], pontos[0][0]]
    : Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon)
      ? [lat, lon]
      : null;

  function carregar() {
    getFrentes(obra.id).then(setFrentes).catch(() => {});
  }
  useEffect(carregar, [obra.id]);

  function novoTrecho() {
    setEditando(null);
    setPontos([]);
    setNome(`Trecho ${frentes.length + 1}`);
    setDiametro("");
    setMaterial("");
    setErro(""); setMsg("");
  }
  useEffect(novoTrecho, []); // eslint-disable-line react-hooks/exhaustive-deps

  function editar(f: Frente) {
    setEditando(f);
    setPontos((f.geojson?.coordinates ?? []) as [number, number][]);
    setNome(f.nome);
    setDiametro(f.diametro_mm ? String(f.diametro_mm) : "");
    setMaterial(f.material ?? "");
    setErro(""); setMsg("");
  }

  async function excluir(f: Frente) {
    if (!confirm(`Excluir o trecho "${f.nome}"?`)) return;
    await excluirFrente(f.id);
    if (editando?.id === f.id) novoTrecho();
    carregar();
    onMudou();
  }

  async function salvar() {
    if (pontos.length < 2) { setErro("Marque pelo menos 2 pontos no mapa antes de salvar."); return; }
    if (!nome.trim()) { setErro("Dê um nome pro trecho."); return; }
    try {
      setSalvando(true); setErro(""); setMsg("");
      const extensao = comprimentoLinha(pontos);
      const corpo = {
        obra_id: obra.id,
        nome: nome.trim(),
        geojson: { type: "LineString" as const, coordinates: pontos },
        extensao_prevista_m: Math.round(extensao * 10) / 10,
        diametro_mm: diametro.trim() ? Number(diametro) : null,
        material: material.trim() || null,
      };
      if (editando) await atualizarFrente(editando.id, corpo);
      else await criarFrente(corpo);
      setMsg(`Trecho salvo: ${Math.round(extensao)} m.`);
      carregar();
      onMudou();
      if (!editando) novoTrecho();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o trecho.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarMarcos(lista: Marco[]) {
    await atualizarRecursoEng("obra", obra.id, {
      nome: obra.nome,
      dados: { ...obra.dados, marcos_kmz: JSON.stringify(lista) },
    });
    onMudou();
  }

  function cliqueNoMapa(lat: number, lon: number) {
    if (modo !== "marco" || !adicionandoMarco) return;
    setPendente({ lat, lon });
    setMarcoNome("");
    setMarcoTipo(TIPOS_MARCO[0].valor);
  }

  async function confirmarMarco() {
    if (!pendente || !marcoNome.trim()) { setErro("Dê um nome pro marco."); return; }
    try {
      setSalvandoMarco(true); setErro("");
      await salvarMarcos([...marcos, { nome: marcoNome.trim(), lat: pendente.lat, lon: pendente.lon, tipo: marcoTipo }]);
      setPendente(null);
      setAdicionandoMarco(false);
      setMsg("Marco salvo.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o marco.");
    } finally {
      setSalvandoMarco(false);
    }
  }

  async function excluirMarco(indice: number) {
    if (!confirm(`Excluir o marco "${marcos[indice].nome}"?`)) return;
    await salvarMarcos(marcos.filter((_, i) => i !== indice));
  }

  const pontosMarcosMapa: PontoMapa[] = [
    ...marcos.map((m) => ({ lat: m.lat, lon: m.lon, cor: corDoMarco(m.tipo), raio: 6, titulo: m.nome })),
    ...(pendente ? [{ lat: pendente.lat, lon: pendente.lon, cor: "#0f172a", raio: 8, titulo: "novo marco (não salvo)" }] : []),
  ];

  const extensaoAtual = comprimentoLinha(pontos);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">Rota da obra — {obra.nome}</h2>
            <p className="text-xs text-slate-500">
              {modo === "trecho"
                ? <>Clica no mapa marcando o traçado do trecho, em sequência.
                  {pontos.length > 0 && ` ${pontos.length} ponto(s) · ≈ ${Math.round(extensaoAtual)} m marcados.`}</>
                : "Marque pontos de referência que não fazem parte do traçado — travessia, reservatório, ETA, canteiro..."}
            </p>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="mt-3 flex gap-1 border-b border-slate-100">
          <button
            onClick={() => setModo("trecho")}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${modo === "trecho" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >Trechos</button>
          <button
            onClick={() => setModo("marco")}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${modo === "marco" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >Marcos{marcos.length > 0 ? ` (${marcos.length})` : ""}</button>
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_260px]">
          <div>
            <Mapa
              center={center}
              zoom={center ? 16 : 4}
              busca
              linhaEditavel={modo === "trecho"}
              linha={modo === "trecho" ? pontos : null}
              onLinhaChange={modo === "trecho" ? setPontos : undefined}
              onClique={modo === "marco" ? cliqueNoMapa : undefined}
              pontos={modo === "marco" ? pontosMarcosMapa : []}
              altura="440px"
            />
            {modo === "marco" && (
              <p className="mt-2 text-xs text-slate-500">
                {adicionandoMarco ? "Clique no mapa onde fica o marco." : 'Clique em "+ novo marco" e depois clique no mapa.'}
              </p>
            )}
          </div>

          {modo === "trecho" ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Nome do trecho</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)}
                       className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-500">Diâmetro (mm)</label>
                  <input value={diametro} onChange={(e) => setDiametro(e.target.value)} placeholder="ex: 600"
                         className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Material</label>
                  <input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="ex: PVC"
                         className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPontos((p) => p.slice(0, -1))} disabled={!pontos.length}>
                  <Undo2 size={15} /> Desfazer
                </Button>
                <Button variant="secondary" onClick={() => setPontos([])} disabled={!pontos.length}>
                  <Trash2 size={15} /> Limpar
                </Button>
              </div>
              <Button onClick={salvar} disabled={salvando}>
                <Save size={15} /> {salvando ? "Salvando..." : editando ? "Salvar trecho" : "Adicionar trecho"}
              </Button>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              {msg && <p className="text-sm text-emerald-600">{msg}</p>}

              <div className="mt-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">Trechos da obra</p>
                  <button onClick={novoTrecho} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <Plus size={13} /> novo
                  </button>
                </div>
                <div className="mt-2 flex max-h-52 flex-col gap-1.5 overflow-y-auto">
                  {frentes.length === 0 && <p className="text-xs text-slate-400">Nenhum trecho ainda. Assim que subir fotos/vídeos com GPS num voo, a rota é traçada aqui sozinha — só desenhe na mão se quiser ajustar ou não usar GPS.</p>}
                  {frentes.map((f) => (
                    <div key={f.id} className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${editando?.id === f.id ? "border-primary bg-indigo-50/60" : "border-slate-200"}`}>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-700">{f.nome}</p>
                        <p className="text-slate-400">{Math.round(f.extensao_prevista_m)} m{f.diametro_mm ? ` · DN${f.diametro_mm}` : ""}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => editar(f)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary"><Pencil size={13} /></button>
                        <button onClick={() => excluir(f)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Marcos da obra</p>
                <button
                  onClick={() => { setAdicionandoMarco(true); setPendente(null); setErro(""); setMsg(""); }}
                  disabled={adicionandoMarco}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                ><Plus size={13} /> novo marco</button>
              </div>

              {pendente && (
                <div className="rounded-lg border border-slate-200 p-3">
                  <label className="text-xs font-medium text-slate-500">Nome do marco</label>
                  <input value={marcoNome} onChange={(e) => setMarcoNome(e.target.value)} placeholder="ex: Travessia da BR-020"
                         className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary" />
                  <label className="mt-2 block text-xs font-medium text-slate-500">Tipo</label>
                  <select value={marcoTipo} onChange={(e) => setMarcoTipo(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary">
                    {TIPOS_MARCO.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
                  </select>
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" onClick={() => { setPendente(null); setAdicionandoMarco(false); }}>Cancelar</Button>
                    <Button onClick={confirmarMarco} disabled={salvandoMarco}><Save size={14} /> {salvandoMarco ? "Salvando..." : "Salvar marco"}</Button>
                  </div>
                </div>
              )}
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              {msg && <p className="text-sm text-emerald-600">{msg}</p>}

              <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                {marcos.length === 0 && <p className="text-xs text-slate-400">Nenhum marco ainda.</p>}
                {marcos.map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundColor: corDoMarco(m.tipo) }} />
                      <span className="truncate font-medium text-slate-700">{m.nome}</span>
                    </div>
                    <button onClick={() => excluirMarco(i)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
