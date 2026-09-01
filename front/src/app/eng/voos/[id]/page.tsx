"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImagePlus, MapPin, Trash2, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Mapa } from "@/components/eng/mapa";
import {
  atualizarDeteccao, criarDeteccao, enviarFotosVoo, excluirDeteccao, fotoVooUrl,
  getFrentes, getRecursosEng, getVoo,
  type Deteccao, type Frente, type RecursoEng, type Voo,
} from "@/lib/api";

export default function VooDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [voo, setVoo] = useState<Voo | null>(null);
  const [maquinas, setMaquinas] = useState<RecursoEng[]>([]);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [frenteId, setFrenteId] = useState("");
  const [maquinaSel, setMaquinaSel] = useState("");
  const [subindo, setSubindo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const v = await getVoo(id);
      setVoo(v);
      const [m, f] = await Promise.all([getRecursosEng("equipamento"), getFrentes(v.obra_id)]);
      setMaquinas(m); setFrentes(f);
      setFrenteId((atual) => atual || f[0]?.id || "");
      setMaquinaSel((atual) => atual || m[0]?.id || "");
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao carregar o voo."); }
  }, [id]);
  useEffect(() => { void carregar(); }, [carregar]);

  const maqNome = useMemo(() => new Map(maquinas.map((m) => [m.id, m.nome])), [maquinas]);
  const frente = frentes.find((f) => f.id === frenteId);
  const linha = frente?.geojson?.coordinates ?? null;

  const centro = useMemo((): [number, number] | null => {
    const comGps = voo?.fotos?.find((f) => f.gps_lat != null);
    if (comGps) return [comGps.gps_lat!, comGps.gps_lon!];
    if (linha?.length) return [linha[0][1], linha[0][0]];
    return null;
  }, [voo, linha]);

  const pontos = (voo?.deteccoes ?? []).flatMap((d) =>
    d.lat != null && d.lon != null
      ? [{ lat: d.lat, lon: d.lon, cor: d.status_maquina === "parada" ? "#ef4444" : "#2563eb", titulo: maqNome.get(d.maquina_id) ?? "Máquina" }]
      : [],
  );

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    try {
      setSubindo(true); setErro(""); setAviso("");
      const r = await enviarFotosVoo(id, Array.from(files));
      if (fileRef.current) fileRef.current.value = "";
      setAviso(
        r.qrs_lidos > 0
          ? `${r.adicionadas} foto(s) · ${r.qrs_lidos} máquina(s) identificada(s) pelo QR automaticamente.`
          : r.leitor_ativo
            ? `${r.adicionadas} foto(s) · nenhum QR lido — marque as máquinas no mapa.`
            : `${r.adicionadas} foto(s) enviada(s).`,
      );
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha no upload."); }
    finally { setSubindo(false); }
  }

  async function marcar(lat: number, lon: number) {
    if (!maquinaSel) { setErro("Escolha a máquina antes de clicar no mapa."); return; }
    try {
      const semPos = (voo?.deteccoes ?? []).find((d) => d.maquina_id === maquinaSel && d.lat == null);
      if (semPos) await atualizarDeteccao(semPos.id, { maquina_id: maquinaSel, frente_id: frenteId || undefined, lat, lon });
      else await criarDeteccao(id, { maquina_id: maquinaSel, frente_id: frenteId || undefined, lat, lon });
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível marcar."); }
  }

  async function usarGps(lat: number, lon: number) {
    await marcar(lat, lon);
  }

  async function removerDet(d: Deteccao) {
    await excluirDeteccao(d.id); await carregar();
  }

  if (!voo) return <div className="mx-auto max-w-[100rem] text-sm text-slate-400">Carregando…{erro && <span className="text-red-600"> — {erro}</span>}</div>;

  return (
    <div className="mx-auto max-w-[100rem]">
      <Link href="/eng/voos" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary"><ArrowLeft size={15} /> Voos</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Voo {new Date(voo.data + "T00:00:00").toLocaleDateString("pt-BR")} · {voo.turno}</h1>
          <p className="mt-1 text-sm text-slate-500">{voo.total_fotos} foto(s) · {voo.total_deteccoes} máquina(s) marcada(s)</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card className="p-3">
          {frentes.length > 1 && (
            <select value={frenteId} onChange={(e) => setFrenteId(e.target.value)} className="mb-2 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {frentes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          )}
          <Mapa center={centro} zoom={centro ? 17 : 4} linha={linha} pontos={pontos} onClique={marcar} altura="560px" />
          <p className="mt-2 text-xs text-slate-500">
            {frente ? `Frente: ${frente.nome}. ` : "Sem frente desenhada — o avanço vai sair pela distância GPS. "}
            Escolha a máquina ao lado e clique no mapa onde ela está.
          </p>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800"><Upload size={16} className="text-primary" /> Fotos do voo</h2>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 hover:border-primary hover:text-primary">
              <ImagePlus size={18} />
              {subindo ? "Enviando e lendo os QRs…" : "Selecionar fotos do voo (várias)"}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
            {aviso && <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-primary">{aviso}</p>}
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-slate-800">Marcar máquina</h2>
            <label className="mt-3 block text-xs font-medium text-slate-600">Máquina</label>
            <select value={maquinaSel} onChange={(e) => setMaquinaSel(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
              {maquinas.length === 0 && <option value="">Cadastre máquinas primeiro</option>}
              {maquinas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <p className="mt-2 text-xs text-slate-500">Clique no mapa na posição da máquina.</p>
          </Card>

          {(voo.deteccoes ?? []).length > 0 && (
            <Card className="p-0">
              <div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-800">Marcações deste voo</h2></div>
              <div className="divide-y divide-slate-50">
                {(voo.deteccoes ?? []).map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className={d.lat == null ? "text-amber-500" : d.status_maquina === "parada" ? "text-red-500" : "text-primary"} />
                      <div>
                        <p className="flex items-center gap-1.5 font-medium text-slate-700">
                          {maqNome.get(d.maquina_id) ?? "Máquina"}
                          {d.metodo === "qr" && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">QR</span>}
                        </p>
                        <p className="text-xs text-slate-400">
                          {d.lat == null ? "sem posição — clique no mapa" : d.progressiva_m != null ? `estaca ${d.progressiva_m} m` : `${d.lat.toFixed(5)}, ${d.lon?.toFixed(5)}`}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => removerDet(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {(voo.fotos ?? []).length > 0 && (
        <Card className="mt-5 p-5">
          <h2 className="font-semibold text-slate-800">Fotos ({voo.fotos!.length})</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {voo.fotos!.map((f) => (
              <div key={f.id} className="overflow-hidden rounded-lg border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fotoVooUrl(id, f.id)} alt={f.nome_arquivo} className="h-28 w-full object-cover" />
                <div className="flex items-center justify-between gap-1 p-1.5 text-[11px] text-slate-500">
                  <span className="truncate">{f.gps_lat != null ? "📍 GPS" : "sem GPS"}</span>
                  {f.gps_lat != null && <button onClick={() => usarGps(f.gps_lat!, f.gps_lon!)} className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-primary hover:bg-indigo-100">usar aqui</button>}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">&quot;usar aqui&quot; marca a máquina selecionada na posição GPS daquela foto.</p>
        </Card>
      )}
      {erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
