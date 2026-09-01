"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, ImageIcon, Plus, QrCode, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EtiquetaQr } from "@/components/eng/etiqueta-qr";
import {
  criarRecursoEng, enviarFotoRecursoEng, excluirRecursoEng, getRecursosEng,
  recursoEngFotoUrl, type RecursoEng,
} from "@/lib/api";
import { BADGE_CORES, MODULOS, type CampoEng, type Ctx } from "@/lib/eng-recursos";

const CONTROLE = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15";
const spanClasse = (c?: 1 | 2 | 3) => (c === 3 ? "sm:col-span-2 lg:col-span-3 2xl:col-span-4" : c === 2 ? "sm:col-span-2" : "");

function Campo({ label, span, children }: { label: string; span?: 1 | 2 | 3; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${spanClasse(span)}`}>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

export function RecursoCrud({ tipo, topo }: { tipo: string; topo?: React.ReactNode }) {
  const modulo = MODULOS[tipo];
  const [lista, setLista] = useState<RecursoEng[]>([]);
  const [obras, setObras] = useState<RecursoEng[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState("");
  const [dados, setDados] = useState<Record<string, string>>({});
  const [imagem, setImagem] = useState<File | null>(null);
  const [etiqueta, setEtiqueta] = useState<{ id: string; nome: string; numero: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const usaObra = useMemo(() => modulo.campos.some((c) => c.tipo === "obra"), [modulo]);

  async function carregar() {
    try {
      setLista(await getRecursosEng(tipo));
      if (usaObra && tipo !== "obra") setObras(await getRecursosEng("obra"));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os registros.");
    }
  }
  useEffect(() => { void carregar(); }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx: Ctx = useMemo(() => {
    const mapa = new Map(obras.map((o) => [o.id, o.nome]));
    return { obraNome: (id: string) => (id ? mapa.get(id) ?? "—" : "—") };
  }, [obras]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return lista.filter((r) => r.nome.toLowerCase().includes(q));
  }, [busca, lista]);

  const resumo = modulo.resumo.map((chip) => ({
    label: chip.label,
    cor: chip.cor ?? "primary",
    texto: chip.valor(lista, ctx),
  }));

  function setCampo(k: string, v: string) {
    setDados((atual) => ({ ...atual, [k]: v }));
  }

  function limpar() {
    setNome(""); setDados({}); setImagem(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function adicionar() {
    if (!nome.trim()) { setErro(`Informe ${modulo.nomeLabel.toLowerCase()}.`); return; }
    try {
      setSalvando(true); setErro("");
      const limpos = Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== "" && v != null));
      const criado = await criarRecursoEng(tipo, { nome: nome.trim(), dados: limpos });
      if (imagem) await enviarFotoRecursoEng(tipo, criado.id, imagem);
      limpar();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o registro.");
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(id: string) {
    if (window.confirm("Excluir este registro?")) { await excluirRecursoEng(tipo, id); void carregar(); }
  }

  function renderCampo(campo: CampoEng) {
    const valor = dados[campo.key] ?? "";
    const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setCampo(campo.key, e.target.value);
    let control: React.ReactNode;

    if (campo.tipo === "textarea") {
      control = <textarea value={valor} onChange={onChange} placeholder={campo.placeholder ?? ""} rows={2} className={CONTROLE} />;
    } else if (campo.tipo === "select") {
      control = (
        <select value={valor} onChange={onChange} className={CONTROLE}>
          <option value="">Selecione</option>
          {campo.opcoes?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    } else if (campo.tipo === "obra") {
      control = (
        <select value={valor} onChange={onChange} className={CONTROLE} disabled={obras.length === 0}>
          <option value="">{obras.length === 0 ? "Cadastre uma obra primeiro" : "Vincular a uma obra"}</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      );
    } else {
      const inputTipo = campo.tipo === "data" ? "date" : campo.tipo === "texto" ? "text" : "number";
      const step = campo.tipo === "moeda" ? "0.01" : campo.tipo === "numero" ? "any" : undefined;
      control = (
        <input
          type={inputTipo}
          step={step}
          min={campo.tipo === "moeda" || campo.tipo === "numero" ? "0" : undefined}
          value={valor}
          onChange={onChange}
          placeholder={campo.placeholder ?? ""}
          className={CONTROLE}
        />
      );
    }
    return <Campo key={campo.key} label={campo.label} span={campo.col}>{control}</Campo>;
  }

  function renderCelula(r: RecursoEng, texto: string, tipoCol?: string) {
    if (tipoCol === "badge") {
      if (texto === "—") return <span className="text-slate-400">—</span>;
      return <span className={`rounded-full px-2.5 py-1 text-xs ${BADGE_CORES[texto] ?? "bg-slate-100 text-slate-600"}`}>{texto}</span>;
    }
    if (tipoCol === "progresso") {
      const [cons, prev, un] = texto.split("|");
      const c = Number(cons) || 0, p = Number(prev) || 0;
      const pct = p ? Math.round((c / p) * 1000) / 10 : 0;
      return (
        <div className="min-w-40">
          <div className="flex justify-between text-xs">
            <span>{c} / {p} {un}</span>
            <span className={pct > 100 ? "text-red-600" : "text-slate-400"}>{pct}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${pct > 100 ? "bg-red-500" : "bg-primary"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
      );
    }
    return <span className={tipoCol === "moeda" ? "font-medium text-slate-700" : "text-slate-500"}>{texto}</span>;
  }

  return (
    <div className="mx-auto max-w-[100rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{modulo.titulo}</h1>
          <p className="mt-1 text-sm text-slate-500">{modulo.descricao}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {resumo.map((chip) => (
            <div key={chip.label} className={`rounded-full px-3 py-2 text-sm font-medium ${chip.cor === "emerald" ? "bg-emerald-50 text-emerald-700" : chip.cor === "amber" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-primary"}`}>
              {chip.texto} {chip.label}
            </div>
          ))}
        </div>
      </div>

      {topo}

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-primary"><Plus size={18} /></div>
          <div>
            <h2 className="font-semibold text-slate-800">Novo registro</h2>
            <p className="text-xs text-slate-500">{modulo.imagemDestaque ? "Anexe a imagem do voo / mapeamento." : "A imagem é opcional."}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <Campo label={modulo.nomeLabel} span={3}>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={modulo.nomePlaceholder} className={CONTROLE} />
          </Campo>
          {modulo.campos.map(renderCampo)}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm hover:border-primary hover:text-primary ${modulo.imagemDestaque ? "border-primary/50 text-primary" : "border-slate-300 text-slate-600"}`}>
            <ImagePlus size={16} />
            {imagem ? imagem.name : modulo.imagemDestaque ? "Adicionar imagem" : "Adicionar imagem (opcional)"}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setImagem(e.target.files?.[0] ?? null)} />
          </label>
          {imagem && <button type="button" onClick={() => { setImagem(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-xs text-slate-400 hover:text-red-600">remover</button>}
          <Button onClick={adicionar} disabled={salvando} className="ml-auto"><Plus size={16} />{salvando ? "Salvando..." : "Adicionar"}</Button>
        </div>
      </Card>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-semibold text-slate-800">{modulo.titulo} cadastrado(s)</h2>
            <p className="text-xs text-slate-500">{filtrados.length} resultado(s)</p>
          </div>
          <label className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" className="w-72 max-w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="px-5 py-3">{modulo.nomeLabel}</th>
                {modulo.colunas.map((c) => <th key={c.label} className="px-5 py-3">{c.label}</th>)}
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={modulo.colunas.length + 2} className="px-5 py-12 text-center text-slate-400">Nenhum registro cadastrado.</td></tr>
              ) : filtrados.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {r.tem_foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={recursoEngFotoUrl(tipo, r.id)} alt={r.nome} className="size-11 rounded-lg object-cover" />
                      ) : (
                        <span className="grid size-11 place-items-center rounded-lg bg-slate-100 text-slate-400"><ImageIcon size={16} /></span>
                      )}
                      <span className="font-medium text-slate-700">{r.nome}</span>
                    </div>
                  </td>
                  {modulo.colunas.map((c) => (
                    <td key={c.label} className="px-5 py-4">{renderCelula(r, c.valor(r, ctx), c.tipo)}</td>
                  ))}
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {modulo.etiquetaQr && (
                        <button
                          onClick={() => setEtiqueta({ id: r.id, nome: r.nome, numero: String(lista.length - lista.indexOf(r)).padStart(2, "0") })}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-primary"
                          title="Etiqueta QR"
                        ><QrCode size={17} /></button>
                      )}
                      <button onClick={() => apagar(r.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir"><Trash2 size={17} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {etiqueta && <EtiquetaQr {...etiqueta} onFechar={() => setEtiqueta(null)} />}
    </div>
  );
}
