"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImagePlus, MapPin, Trash2, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Mapa } from "@/components/eng/mapa";
import {
  atualizarDeteccao, criarDeteccao, enviarFotosVoo, excluirDeteccao, fotoVooUrl,
  getRecursosEng, getVoo,
  type Deteccao, type RecursoEng, type Voo,
} from "@/lib/api";

export default function VooDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [voo, setVoo] = useState<Voo | null>(null);
  const [maquinas, setMaquinas] = useState<RecursoEng[]>([]);
  const [maquinaSel, setMaquinaSel] = useState("");
  const [subindo, setSubindo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const v = await getVoo(id);
      setVoo(v);
      const m = await getRecursosEng("equipamento");
      setMaquinas(m);
      setMaquinaSel((atual) => atual || m[0]?.id || "");
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao carregar o voo."); }
  }, [id]);
  useEffect(() => { void carregar(); }, [carregar]);

  const maqNome = useMemo(() => new Map(maquinas.map((m) => [m.id, m.nome])), [maquinas]);
  const qrDets = (voo?.deteccoes ?? []).filter((d) => d.metodo === "qr");
  const manuaisDets = (voo?.deteccoes ?? []).filter((d) => d.metodo !== "qr");
  const semGps = !!voo && voo.total_fotos > 0 && voo.fotos_com_gps === 0;

  const centro = useMemo((): [number, number] | null => {
    const comGps = voo?.fotos?.find((f) => f.gps_lat != null);
    if (comGps) return [comGps.gps_lat!, comGps.gps_lon!];
    return null;
  }, [voo]);

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
      if (semPos) await atualizarDeteccao(semPos.id, { maquina_id: maquinaSel, lat, lon });
      else await criarDeteccao(id, { maquina_id: maquinaSel, lat, lon });
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
          <Mapa center={centro} zoom={centro ? 17 : 4} busca pontos={pontos} onClique={marcar} altura="560px" />
          <p className="mt-2 text-xs text-slate-500">
            Fotos com GPS posicionam a máquina sozinhas. Pra ajustar ou marcar as que faltam: escolha a máquina ao lado e clique no mapa.
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
            {semGps && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Nenhuma foto tem GPS. Screenshots e frames de vídeo perdem o GPS — use os arquivos originais <b>.JPG</b> do cartão SD. Sem GPS, posicione as máquinas clicando no mapa.
              </p>
            )}
          </Card>

          <Card className="p-0">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-semibold text-slate-800">Máquinas identificadas pelo QR</h2>
              <p className="text-xs text-slate-500">{qrDets.length} lida(s) automaticamente</p>
            </div>
            {qrDets.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">Nenhuma ainda. Suba as fotos ou marque na mão abaixo.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {qrDets.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                    <div className="flex items-center gap-2.5">
                      <MapPin size={15} className={d.lat == null ? "text-amber-500" : "text-emerald-600"} />
                      <div>
                        <p className="font-medium text-slate-700">{maqNome.get(d.maquina_id) ?? "Máquina"}</p>
                        <p className="text-xs text-slate-400">
                          {d.foto_tirada_em ? new Date(d.foto_tirada_em).toLocaleString("pt-BR") + " · " : ""}
                          {d.lat == null
                            ? <span className="text-amber-600">sem posição</span>
                            : d.progressiva_m != null ? `estaca ${d.progressiva_m} m` : "posicionada"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {d.lat == null && (
                        <button onClick={() => { setMaquinaSel(d.maquina_id); setAviso("Agora clique no mapa onde a máquina estava."); }} className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-primary hover:bg-indigo-100">posicionar</button>
                      )}
                      <button onClick={() => removerDet(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-slate-800">Marcar na mão</h2>
            <p className="text-xs text-slate-500">Pra máquina que o QR não pegou.</p>
            <label className="mt-3 block text-xs font-medium text-slate-600">Máquina</label>
            <select value={maquinaSel} onChange={(e) => setMaquinaSel(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
              {maquinas.length === 0 && <option value="">Cadastre máquinas primeiro</option>}
              {maquinas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <p className="mt-2 text-xs text-slate-500">Selecione e clique no mapa na posição da máquina.</p>
            {manuaisDets.length > 0 && (
              <div className="mt-3 divide-y divide-slate-50 border-t border-slate-100">
                {manuaisDets.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-slate-600">{maqNome.get(d.maquina_id) ?? "Máquina"} · <span className="text-xs text-slate-400">{d.progressiva_m != null ? `estaca ${d.progressiva_m} m` : "no mapa"}</span></span>
                    <button onClick={() => removerDet(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
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
