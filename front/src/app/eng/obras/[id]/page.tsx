"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, CalendarClock, CloudRain, FileUp, Map as MapIcon, Plane, Ruler, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mapa, type PontoMapa, type SegmentoMapa } from "@/components/eng/mapa";
import { RotaObra } from "@/components/eng/rota-obra";
import {
  getAvancoLinear, getFrentes, getRecursosEng, getVoos, importarRotaKmz,
  type AvancoLinear, type Frente, type RecursoEng, type Voo,
} from "@/lib/api";
import { pontoNaLinha, segmentosExecutados, segmentosLinha } from "@/lib/geo";
import { corDoMarco, marcosDaObra } from "@/lib/marcos";

// uma cor por trecho, pra diferenciar os alinhamentos no mapa (e nas estacas de cada um)
const PALETA_TRECHOS = ["#ef4444", "#8b5cf6", "#f97316", "#0ea5e9", "#eab308", "#ec4899", "#14b8a6"];
const corDoTrecho = (i: number) => PALETA_TRECHOS[i % PALETA_TRECHOS.length];

export default function ObraProgresso() {
  const { id } = useParams<{ id: string }>();
  const [obra, setObra] = useState<RecursoEng | null>(null);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [voos, setVoos] = useState<Voo[]>([]);
  const [avanco, setAvanco] = useState<AvancoLinear | null>(null);
  const [mostrarRota, setMostrarRota] = useState(false);
  const [subindoKmz, setSubindoKmz] = useState(false);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const kmzRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const [obras, f, v, a] = await Promise.all([
        getRecursosEng("obra"), getFrentes(id), getVoos(id), getAvancoLinear(id),
      ]);
      setObra(obras.find((o) => o.id === id) ?? null);
      setFrentes(f);
      setVoos(v);
      setAvanco(a);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao carregar a obra."); }
  }, [id]);
  useEffect(() => { void carregar(); }, [carregar]);

  const executadoPorFrente = useMemo(
    () => new Map((avanco?.trechos ?? []).map((t) => [t.id, t.executado_m])),
    [avanco],
  );

  const segmentos = useMemo((): SegmentoMapa[] => {
    const saida: SegmentoMapa[] = [];
    frentes.forEach((f, i) => {
      const coords = (f.geojson?.coordinates ?? []) as [number, number][];
      if (coords.length < 2) return;
      saida.push(...segmentosLinha(coords, corDoTrecho(i)));
      const exec = executadoPorFrente.get(f.id) ?? 0;
      if (exec > 0) saida.push(...segmentosExecutados(coords, exec, "#10b981"));
    });
    return saida;
  }, [frentes, executadoPorFrente]);

  const pontosEstacas = useMemo((): PontoMapa[] => {
    const saida: PontoMapa[] = [];
    frentes.forEach((f, i) => {
      const cor = corDoTrecho(i);
      (f.estacas ?? []).forEach((e) => {
        saida.push({
          lat: e.lat, lon: e.lon, cor, raio: 3, rotulo: e.codigo,
          titulo: `${e.codigo}${e.progressiva_m != null ? ` · ${Math.round(e.progressiva_m)} m` : ""}`
            + (e.profundidade_m != null ? ` · prof. ${e.profundidade_m} m` : ""),
        });
      });
    });
    return saida;
  }, [frentes]);

  // marcos soltos do KMZ (travessia, reservatório, ETA, booster, canteiro...)
  const pontosMarcos = useMemo((): PontoMapa[] => {
    return marcosDaObra(obra?.dados).map((m) => ({ lat: m.lat, lon: m.lon, cor: corDoMarco(m.tipo), raio: 6, titulo: m.nome }));
  }, [obra]);

  // marca no mapa, com o número em metros, até onde cada trecho já avançou
  const pontosProgresso = useMemo((): PontoMapa[] => {
    const saida: PontoMapa[] = [];
    frentes.forEach((f) => {
      const coords = (f.geojson?.coordinates ?? []) as [number, number][];
      const exec = executadoPorFrente.get(f.id) ?? 0;
      if (coords.length < 2 || exec <= 0) return;
      const ponto = pontoNaLinha(coords, exec);
      if (!ponto) return;
      saida.push({
        lat: ponto.lat, lon: ponto.lon, cor: "#10b981", raio: 6,
        rotulo: `${Math.round(exec)} m`,
        titulo: `${f.nome} — ${Math.round(exec)} m executados`,
      });
    });
    return saida;
  }, [frentes, executadoPorFrente]);

  const center = useMemo((): [number, number] | null => {
    const primeiro = frentes.find((f) => (f.geojson?.coordinates?.length ?? 0) > 0);
    if (primeiro) {
      const [lon, lat] = primeiro.geojson!.coordinates[0];
      return [lat, lon];
    }
    const lat = Number(obra?.dados.localizacao_lat);
    const lon = Number(obra?.dados.localizacao_lon);
    if (obra && Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon)) return [lat, lon];
    return null;
  }, [frentes, obra]);

  async function importarKmz(files: FileList | null) {
    const arquivo = files?.[0];
    if (!arquivo) return;
    try {
      setSubindoKmz(true); setErro(""); setMsg("");
      const r = await importarRotaKmz(id, arquivo);
      setMsg(`${r.trechos_importados} trecho(s) importado(s) — ${Math.round(r.extensao_total_m)} m no total.`);
      if (kmzRef.current) kmzRef.current.value = "";
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível importar o arquivo."); }
    finally { setSubindoKmz(false); }
  }

  if (!obra || !avanco) {
    return <div className="mx-auto max-w-[100rem] text-sm text-slate-400">Carregando…{erro && <span className="text-red-600"> — {erro}</span>}</div>;
  }

  const produtividade = avanco.produtividade;
  const impactoChuva = produtividade.media_dia_seco_m_dia && produtividade.media_dia_chuvoso_m_dia
    ? Math.round(100 * (1 - produtividade.media_dia_chuvoso_m_dia / produtividade.media_dia_seco_m_dia))
    : null;

  const prazo = avanco.status_prazo;
  const prazoTexto = prazo.situacao === "atrasada" ? `${Math.abs(prazo.dias_diferenca ?? 0)} dia(s) atrasada`
    : prazo.situacao === "adiantada" ? `${Math.abs(prazo.dias_diferenca ?? 0)} dia(s) adiantada`
    : prazo.situacao === "no_prazo" ? "no prazo"
    : prazo.previsao_termino_planejada ? "ainda sem dados suficientes" : "sem previsão de término cadastrada";
  const prazoCor = prazo.situacao === "atrasada" ? "text-red-600" : prazo.situacao === "adiantada" ? "text-emerald-600" : "text-slate-900";

  const kpis = [
    { icon: Ruler, label: "Extensão total", valor: `${Math.round(avanco.extensao_total_m)} m`, nota: `${frentes.length} trecho(s)` },
    { icon: TrendingUp, label: "Executado", valor: `${Math.round(avanco.executado_m)} m`, nota: avanco.percentual != null ? `${avanco.percentual}% concluído` : "—" },
    { icon: Plane, label: "Produtividade média", valor: produtividade.media_geral_m_dia != null ? `${produtividade.media_geral_m_dia} m/dia` : "—", nota: `${produtividade.dias_com_historico} dia(s) com captura` },
    { icon: CloudRain, label: "Impacto da chuva", valor: impactoChuva != null ? `-${impactoChuva}%` : "—", nota: avanco.clima_disponivel ? "produtividade em dia de chuva" : "sem localização p/ clima" },
    { icon: CalendarClock, label: "Situação do prazo", valor: prazoTexto, nota: prazo.previsao_termino_planejada ? `previsto pra ${new Date(prazo.previsao_termino_planejada + "T00:00:00").toLocaleDateString("pt-BR")}` : "cadastre a previsão de término na obra", cor: prazoCor },
  ];

  return (
    <div className="mx-auto max-w-[100rem]">
      <Link href="/eng/obras" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary"><ArrowLeft size={15} /> Obras</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{obra.nome}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {avanco.previsao
              ? `Previsão de conclusão: ${new Date(avanco.previsao.data_prevista + "T00:00:00").toLocaleDateString("pt-BR")} (${avanco.previsao.dias_restantes} dia(s))`
              : "Sem histórico suficiente pra prever a conclusão ainda."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-primary hover:text-primary">
            <FileUp size={15} /> {subindoKmz ? "Importando…" : "Importar KMZ/KML"}
            <input ref={kmzRef} type="file" accept=".kmz,.kml" className="hidden" onChange={(e) => importarKmz(e.target.files)} />
          </label>
          <Button variant="secondary" onClick={() => setMostrarRota(true)}><MapIcon size={15} /> Editar rota / marcos</Button>
        </div>
      </div>

      {msg && <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{msg}</p>}
      {erro && <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</p>}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <k.icon className={k.cor ?? "text-primary"} size={20} />
            <p className="mt-3 text-sm text-slate-500">{k.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${k.cor ?? "text-slate-900"}`}>{k.valor}</p>
            <p className="mt-1 text-xs text-slate-400">{k.nota}</p>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card className="p-3">
          <Mapa center={center} zoom={center ? 15 : 4} busca segmentos={segmentos} pontos={[...pontosMarcos, ...pontosEstacas, ...pontosProgresso]} altura="480px" />
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {frentes.map((f, i) => (
              <span key={f.id} className="inline-flex items-center gap-1">
                <span className="inline-block h-1 w-4 rounded" style={{ backgroundColor: corDoTrecho(i) }} />
                {f.nome}
              </span>
            ))}
            <span className="inline-flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-emerald-500" /> executado</span>
            {pontosMarcos.length > 0 && (
              <span className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-slate-400" /> {pontosMarcos.length} marco(s) do projeto (travessias, reservatório...)</span>
            )}
          </p>
        </Card>

        <div className="space-y-4">
          <Card className="p-0">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-semibold text-slate-800">Trechos</h2>
            </div>
            {frentes.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">Nenhum trecho ainda. Importe um KMZ ou desenhe a rota manualmente.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {avanco.trechos.map((t, i) => (
                  <div key={t.id} className="p-3">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <p className="flex min-w-0 items-center gap-1.5 truncate font-medium text-slate-700">
                        <span className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundColor: corDoTrecho(i) }} />
                        <span className="truncate">{t.nome}</span>
                      </p>
                      <p className="shrink-0 text-xs text-slate-400">{t.diametro_mm ? `DN${t.diametro_mm}` : ""}{t.material ? ` · ${t.material}` : ""}</p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, t.percentual ?? 0)}%` }} />
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">{Math.round(t.executado_m)}/{Math.round(t.extensao_m)} m</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-0">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-semibold text-slate-800">Capturas ({voos.length})</h2>
            </div>
            <div className="max-h-64 divide-y divide-slate-50 overflow-y-auto">
              {voos.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">Nenhuma captura ainda.</p>
              ) : voos.map((v) => (
                <Link key={v.id} href={`/eng/voos/${v.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-slate-50">
                  <span className="text-slate-700">{new Date(v.data + "T00:00:00").toLocaleDateString("pt-BR")} · {v.turno}</span>
                  <span className="text-xs text-slate-400">{v.total_fotos} arquivo(s)</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-medium text-slate-600">Produtividade diária</h2>
        <p className="mt-0.5 text-xs text-slate-400">Metros executados por dia — barras em azul-escuro marcam dias de chuva</p>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={avanco.historico_diario}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="data" fontSize={11} stroke="#94a3b8"
                     tickFormatter={(v) => new Date(v + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} />
              <YAxis fontSize={11} stroke="#94a3b8" width={36} unit="m" />
              <Tooltip
                labelFormatter={(v) => new Date(v + "T00:00:00").toLocaleDateString("pt-BR")}
                formatter={(v, n) => [n === "avanco_dia_m" ? `${v} m` : v, n === "avanco_dia_m" ? "Avanço" : n]}
              />
              <Bar dataKey="avanco_dia_m" radius={[5, 5, 0, 0]} maxBarSize={26}>
                {avanco.historico_diario.map((h, i) => <Cell key={i} fill={h.choveu ? "#1e3a8a" : "#4f46e5"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {avanco.historico_diario.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">Sem capturas com posição na rota ainda.</p>
        )}
      </Card>

      {mostrarRota && (
        <RotaObra obra={obra} onFechar={() => setMostrarRota(false)} onMudou={() => void carregar()} />
      )}
    </div>
  );
}
