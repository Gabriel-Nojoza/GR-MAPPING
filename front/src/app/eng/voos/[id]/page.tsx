"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImagePlus, MapPin, Trash2, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Mapa } from "@/components/eng/mapa";
import {
  atualizarDeteccao, enviarFotosVoo, excluirDeteccao, fotoVooUrl,
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
  const [scanPreviews, setScanPreviews] = useState<{ url: string; video: boolean }[]>([]);
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
  const semGps = !!voo && voo.total_fotos > 0 && voo.fotos_com_gps === 0;

  const centro = useMemo((): [number, number] | null => {
    const comGps = voo?.fotos?.find((f) => f.gps_lat != null);
    if (comGps) return [comGps.gps_lat!, comGps.gps_lon!];
    return null;
  }, [voo]);

  const pontosMaquinas = (voo?.deteccoes ?? []).flatMap((d) =>
    d.lat != null && d.lon != null
      ? [{ lat: d.lat, lon: d.lon, cor: d.status_maquina === "parada" ? "#ef4444" : "#2563eb", titulo: maqNome.get(d.maquina_id) ?? "Máquina" }]
      : [],
  );
  // fotos com GPS que não têm máquina identificada — mostra um ponto cinza
  // discreto, só pra confirmar onde a foto foi tirada (senão o mapa centraliza
  // ali mas não deixa nada marcado, o que confunde).
  const pontosFotos = (voo?.fotos ?? []).flatMap((f) =>
    f.gps_lat != null && f.gps_lon != null
      ? [{ lat: f.gps_lat, lon: f.gps_lon, cor: "#94a3b8", raio: 5, titulo: `Foto: ${f.nome_arquivo}` }]
      : [],
  );
  const pontos = [...pontosMaquinas, ...pontosFotos];

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const arr = Array.from(files);
    const previews = arr.slice(0, 6).map((f) => ({ url: URL.createObjectURL(f), video: f.type.startsWith("video/") }));
    setScanPreviews(previews);
    try {
      setSubindo(true); setErro(""); setAviso("");
      const r = await enviarFotosVoo(id, arr);
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
    finally {
      setSubindo(false);
      setTimeout(() => { previews.forEach((p) => URL.revokeObjectURL(p.url)); setScanPreviews([]); }, 600);
    }
  }

  async function marcar(lat: number, lon: number) {
    const semPos = (voo?.deteccoes ?? []).find(
      (d) => d.lat == null && (maquinaSel ? d.maquina_id === maquinaSel : true),
    );
    if (!semPos) {
      setAviso('Clique em "posicionar" numa máquina sem posição antes de marcar no mapa.');
      return;
    }
    try {
      await atualizarDeteccao(semPos.id, { maquina_id: semPos.maquina_id, lat, lon });
      setMaquinaSel(""); setAviso("");
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
          <p className="mt-1 text-sm text-slate-500">
            {voo.criado_por ? `Enviado por ${voo.criado_por}` : ""}
            {voo.operador_drone ? ` · ${voo.operador_drone}` : ""}
            {voo.criado_por ? " · " : ""}{voo.total_fotos} foto(s) · {voo.total_deteccoes} máquina(s) marcada(s)
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card className="p-3">
          <Mapa center={centro} zoom={centro ? 17 : 4} busca pontos={pontos} onClique={marcar} altura="560px" />
          <p className="mt-2 text-xs text-slate-500">
            <span className="mr-3 inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full bg-slate-400" /> foto sem máquina</span>
            <span className="mr-3 inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full bg-blue-600" /> máquina em campo</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full bg-red-500" /> máquina parada</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Fotos com GPS posicionam a máquina sozinhas. Se alguma ficou &quot;sem posição&quot;, clique em <b>posicionar</b> ao lado e depois no mapa.
          </p>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800"><Upload size={16} className="text-primary" /> Fotos e vídeos do voo</h2>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 hover:border-primary hover:text-primary">
              <ImagePlus size={18} />
              {subindo ? "Lendo os QRs…" : "Selecionar fotos e vídeos do voo (vários)"}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
            <p className="mt-1.5 text-xs text-slate-400">O QR só é lido nas fotos. Os vídeos ficam guardados junto, como registro do voo.</p>

            {scanPreviews.length > 0 && (
              <div className="mt-3">
                <div className="grid grid-cols-3 gap-2">
                  {scanPreviews.map((p, i) => (
                    <div key={i} className={`aspect-square rounded-lg border border-sky-300 bg-slate-900 ${subindo ? "qr-scanning" : ""}`}>
                      {p.video ? (
                        <video src={p.url} muted preload="metadata" className="h-full w-full rounded-lg object-cover opacity-90" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.url} alt="" className="h-full w-full rounded-lg object-cover opacity-90" />
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-sky-600">
                  <span className={`inline-block size-1.5 rounded-full bg-sky-500 ${subindo ? "animate-ping" : ""}`} />
                  {subindo ? "Procurando os QR codes nas fotos…" : "Leitura concluída."}
                </p>
              </div>
            )}

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
              <p className="p-4 text-sm text-slate-400">Nenhuma ainda. Suba as fotos do voo — o QR é lido automaticamente.</p>
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
        </div>
      </div>

      {(voo.fotos ?? []).length > 0 && (
        <Card className="mt-5 p-5">
          <h2 className="font-semibold text-slate-800">Fotos e vídeos ({voo.fotos!.length})</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {voo.fotos!.map((f) => {
              const eVideo = (f.mime ?? "").startsWith("video/");
              return (
              <div key={f.id} className="overflow-hidden rounded-lg border border-slate-200">
                {eVideo ? (
                  <video src={fotoVooUrl(id, f.id)} controls preload="metadata" className="h-28 w-full bg-slate-900 object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoVooUrl(id, f.id)} alt={f.nome_arquivo} className="h-28 w-full object-cover" />
                )}
                <div className="flex items-center justify-between gap-1 p-1.5 text-[11px] text-slate-500">
                  <span className="truncate">{eVideo ? "🎬 vídeo" : f.gps_lat != null ? "📍 GPS" : "sem GPS"}</span>
                  {!eVideo && f.gps_lat != null && <button onClick={() => usarGps(f.gps_lat!, f.gps_lon!)} className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-primary hover:bg-indigo-100">usar aqui</button>}
                </div>
              </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">&quot;usar aqui&quot; marca a máquina selecionada na posição GPS daquela foto.</p>
        </Card>
      )}
      {erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
