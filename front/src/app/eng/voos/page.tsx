"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plane, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { criarVoo, excluirVoo, getRecursosEng, getVoos, type RecursoEng, type Voo } from "@/lib/api";

const CONTROLE = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";
const hoje = () => new Date().toISOString().slice(0, 10);

export default function VoosPage() {
  const router = useRouter();
  const [obras, setObras] = useState<RecursoEng[]>([]);
  const [voos, setVoos] = useState<Voo[]>([]);
  const [euNome, setEuNome] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ obra_id: "", data: hoje(), turno: "Manhã", observacao: "" });

  async function carregar() {
    try { setVoos(await getVoos()); } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao carregar voos."); }
  }
  useEffect(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem("medicao-terreno:usuario") ?? "null");
      setEuNome(u?.nome || u?.email || "");
    } catch { /* ignore */ }
    getRecursosEng("obra").then((o) => { setObras(o); setForm((f) => ({ ...f, obra_id: o[0]?.id ?? "" })); }).catch(() => {});
    void carregar();
  }, []);

  const obraNome = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);

  async function criar() {
    if (!form.obra_id) { setErro("Escolha a obra."); return; }
    try {
      setSalvando(true); setErro("");
      const v = await criarVoo(form);
      router.push(`/eng/voos/${v.id}`);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível criar o voo."); setSalvando(false); }
  }

  async function apagar(id: string) {
    if (window.confirm("Excluir este voo e todas as fotos dele?")) { await excluirVoo(id); void carregar(); }
  }

  return (
    <div className="mx-auto max-w-[100rem]">
      <h1 className="text-2xl font-semibold text-slate-900">Voos</h1>
      <p className="mt-1 text-sm text-slate-500">Cada passagem do drone. Suba as fotos e marque onde está cada máquina.</p>

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-primary"><Plane size={18} /></div>
          <div>
            <h2 className="font-semibold text-slate-800">Novo voo</h2>
            <p className="text-xs text-slate-500">Depois de criar, você já cai na tela pra subir as fotos.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">Obra</label>
            <select value={form.obra_id} onChange={(e) => setForm({ ...form, obra_id: e.target.value })} className={CONTROLE}>
              <option value="">Selecione</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">Data</label>
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className={CONTROLE} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">Turno</label>
            <select value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })} className={CONTROLE}>
              <option>Manhã</option><option>Tarde</option><option>Único</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
            <label className="text-xs font-medium text-slate-600">Observação</label>
            <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="opcional" className={CONTROLE} />
          </div>
        </div>
        {euNome && <p className="mt-3 text-xs text-slate-500">O voo fica registrado como criado por <b>{euNome}</b> (quem está logado).</p>}
        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
          <Button onClick={criar} disabled={salvando}><Plus size={16} />{salvando ? "Criando..." : "Criar voo"}</Button>
        </div>
      </Card>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-800">Voos registrados</h2><p className="text-xs text-slate-500">{voos.length} voo(s)</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="px-5 py-3">Data</th><th className="px-5 py-3">Turno</th><th className="px-5 py-3">Obra</th>
                <th className="px-5 py-3">Enviado por</th><th className="px-5 py-3">Fotos</th><th className="px-5 py-3">Máquinas marcadas</th><th className="px-5 py-3" /><th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {voos.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">Nenhum voo ainda.</td></tr>
              ) : voos.map((v) => (
                <tr key={v.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-4"><Link href={`/eng/voos/${v.id}`} className="font-medium text-primary hover:underline">{new Date(v.data + "T00:00:00").toLocaleDateString("pt-BR")}</Link></td>
                  <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{v.turno}</span></td>
                  <td className="px-5 py-4 text-slate-600">{obraNome.get(v.obra_id) ?? "—"}</td>
                  <td className="px-5 py-4 text-slate-500">
                    {v.criado_por ?? v.operador_nome ?? "—"}
                    {v.operador_drone && <span className="block text-xs text-slate-400">{v.operador_drone}</span>}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{v.total_fotos} <span className="text-xs text-slate-400">({v.fotos_com_gps} c/ GPS)</span></td>
                  <td className="px-5 py-4 text-slate-500">{v.total_deteccoes}</td>
                  <td className="px-5 py-4"><Link href={`/eng/voos/${v.id}`} className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-indigo-100">Abrir / subir fotos</Link></td>
                  <td className="px-5 py-4 text-right"><button onClick={() => apagar(v.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
