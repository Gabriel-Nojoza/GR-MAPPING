"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, MapPin, Phone, Plus, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { criarCliente, excluirCliente, getClientes, type Cliente } from "@/lib/api";
import { getRamoConfig, type CampoCliente } from "@/lib/ramos";
import { CamposDinamicos, contratoRotulo } from "@/components/clientes/campos-dinamicos";

const nucleoVazio = { nome: "", contato: "", email: "" };
const CONTROLE = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15";

export default function ClientesEngenharia() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [campos, setCampos] = useState<CampoCliente[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<typeof nucleoVazio>(nucleoVazio);
  const [extras, setExtras] = useState<Record<string, string>>({});

  async function carregar() {
    try { setClientes(await getClientes()); } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar clientes."); }
  }
  useEffect(() => {
    void carregar();
    getRamoConfig().then((cfg) => setCampos(cfg.campos_cliente)).catch(() => setCampos([]));
  }, []);

  const filtrados = useMemo(() => {
    const t = busca.toLowerCase();
    return clientes.filter((c) => [c.nome, c.contato, c.email].some((v) => v?.toLowerCase().includes(t)));
  }, [busca, clientes]);

  async function adicionar() {
    if (!form.nome.trim()) { setErro("Informe o nome do cliente."); return; }
    try {
      setSalvando(true); setErro("");
      await criarCliente({ ...form, dados: extras });
      setForm(nucleoVazio); setExtras({});
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível cadastrar."); }
    finally { setSalvando(false); }
  }

  async function apagar(id: string) {
    if (window.confirm("Excluir este cliente?")) { await excluirCliente(id); void carregar(); }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">Construtoras, prefeituras e concessionárias atendidas pela empresa.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-2 text-sm font-medium text-primary">
          <Users size={16} /> {clientes.length} cliente{clientes.length === 1 ? "" : "s"}
        </div>
      </div>

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-primary"><Plus size={18} /></div>
          <div>
            <h2 className="font-semibold text-slate-800">Novo cliente</h2>
            <p className="text-xs text-slate-500">O contrato é gerado pela GR Mapping quando o negócio fecha.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
            <label className="text-xs font-medium text-slate-600">Nome / razão social</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Construtora Marquise S/A" className={CONTROLE} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">WhatsApp com DDD</label>
            <input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} placeholder="(85) 99999-9999" className={CONTROLE} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">E-mail</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@empresa.com" className={CONTROLE} />
          </div>
          <CamposDinamicos campos={campos} valores={extras} onChange={(k, v) => setExtras((atual) => ({ ...atual, [k]: v }))} />
        </div>
        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
          <Button onClick={adicionar} disabled={salvando}><Plus size={16} />{salvando ? "Salvando..." : "Adicionar cliente"}</Button>
        </div>
      </Card>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-semibold text-slate-800">Lista de clientes</h2>
            <p className="text-xs text-slate-500">{filtrados.length} resultado(s)</p>
          </div>
          <label className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar cliente" className="w-72 max-w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Contato</th>
                <th className="px-5 py-3">Endereço</th>
                <th className="px-5 py-3">Contrato</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">Nenhum cliente encontrado.</td></tr>
              ) : filtrados.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-4 font-medium text-slate-700">{c.nome}</td>
                  <td className="px-5 py-4 text-slate-500">
                    <div className="space-y-1">
                      {c.contato && <p className="flex items-center gap-2"><Phone size={14} />{c.contato}</p>}
                      {c.email && <p className="flex items-center gap-2"><Mail size={14} />{c.email}</p>}
                      {!c.contato && !c.email && "—"}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {c.dados?.endereco ? <span className="flex items-center gap-2"><MapPin size={14} />{c.dados.endereco}</span> : "—"}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{contratoRotulo(c.dados?.contrato)}</td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => apagar(c.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={17} /></button>
                  </td>
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
