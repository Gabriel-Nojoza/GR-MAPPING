"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { atualizarFlagsEmpresa, criarEmpresa, listarEmpresas, type Empresa, type RamoEmpresa } from "@/lib/admin-api";
import { RAMOS } from "@/lib/ramos";

const RAMO_ROTULO: Record<RamoEmpresa, string> = {
  imobiliaria: "Imobiliária",
  engenharia: "Engenharia / Construção civil",
};

const formVazio = {
  nome: "",
  cnpj: "",
  plano: "teste" as Empresa["plano"],
  ramo: "imobiliaria" as RamoEmpresa,
  responsavel_nome: "",
  responsavel_email: "",
  responsavel_senha: "",
};

export default function EmpresasAdmin() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(formVazio);

  async function carregar() {
    try { setEmpresas(await listarEmpresas()); } catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível carregar as empresas."); }
  }
  useEffect(() => { void carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar() {
    if (!form.nome.trim() || !form.responsavel_nome.trim() || !form.responsavel_email.trim() || !form.responsavel_senha) { setErro("Preencha os dados da empresa e do responsável pelo acesso."); return; }
    try {
      setSalvando(true); setErro("");
      const criada = await criarEmpresa({ ...form, nome: form.nome.trim(), cnpj: form.cnpj.trim() || undefined, responsavel_nome: form.responsavel_nome.trim(), responsavel_email: form.responsavel_email.trim() });
      setEmpresas((atual) => [criada, ...atual]);
      setForm(formVazio);
    } catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível cadastrar a empresa."); }
    finally { setSalvando(false); }
  }

  const filtradas = empresas.filter((empresa) => `${empresa.nome} ${empresa.cnpj ?? ""}`.toLowerCase().includes(busca.toLowerCase()));

  async function alternarFlag(empresa: Empresa, campo: "mostrar_operadores" | "mostrar_custos") {
    const atual = { mostrar_operadores: !!empresa.mostrar_operadores, mostrar_custos: !!empresa.mostrar_custos };
    const novo = { ...atual, [campo]: !atual[campo] };
    try {
      const atualizada = await atualizarFlagsEmpresa(empresa.id, novo);
      setEmpresas((lista) => lista.map((e) => (e.id === empresa.id ? atualizada : e)));
    } catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível atualizar."); }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Administração Master</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Empresas</h1>
          <p className="mt-1 text-sm text-slate-500">Cadastre a empresa, escolha o ramo e já entregue o primeiro acesso ao responsável.</p>
        </div>
        <div className="rounded-full bg-indigo-50 px-3 py-2 text-sm font-medium text-primary">{empresas.length} cadastrada(s)</div>
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-50 p-2 text-primary"><Building2 size={18} /></div>
          <div>
            <h2 className="font-semibold text-slate-800">Nova empresa</h2>
            <p className="text-xs text-slate-500">O ramo define a barra lateral e o cenário que o cliente enxerga.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome da empresa" className="rounded-lg border border-slate-200 p-2.5 text-sm" />
          <input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="CNPJ (opcional)" className="rounded-lg border border-slate-200 p-2.5 text-sm" />
          <select value={form.ramo} onChange={(e) => setForm({ ...form, ramo: e.target.value as RamoEmpresa })} className="rounded-lg border border-slate-200 p-2.5 text-sm">
            {RAMOS.map((ramo) => <option key={ramo.slug} value={ramo.slug}>{ramo.label}</option>)}
          </select>
          <select value={form.plano} onChange={(e) => setForm({ ...form, plano: e.target.value as Empresa["plano"] })} className="rounded-lg border border-slate-200 p-2.5 text-sm">
            <option value="teste">Teste</option>
            <option value="basico">Básico</option>
            <option value="profissional">Profissional</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <div className="mt-5 border-t border-slate-100 pt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><UserRound size={16} className="text-primary" />Responsável pelo primeiro acesso</div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <input value={form.responsavel_nome} onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })} placeholder="Nome do responsável" className="rounded-lg border border-slate-200 p-2.5 text-sm" />
            <input value={form.responsavel_email} onChange={(e) => setForm({ ...form, responsavel_email: e.target.value })} placeholder="E-mail de acesso" type="email" className="rounded-lg border border-slate-200 p-2.5 text-sm" />
            <input value={form.responsavel_senha} onChange={(e) => setForm({ ...form, responsavel_senha: e.target.value })} placeholder="Senha inicial (mínimo 8)" type="password" className="rounded-lg border border-slate-200 p-2.5 text-sm" />
            <Button onClick={() => void salvar()} disabled={salvando}><Plus size={16} />{salvando ? "Salvando..." : "Criar empresa"}</Button>
          </div>
        </div>
      </Card>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-semibold text-slate-800">Contas cadastradas</h2>
            <p className="text-xs text-slate-500">{filtradas.length} resultado(s)</p>
          </div>
          <label className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar empresa" className="w-72 max-w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="px-5 py-3">Empresa</th>
                <th className="px-5 py-3">Ramo</th>
                <th className="px-5 py-3">Plano</th>
                <th className="px-5 py-3">Acessos</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Módulos opcionais</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-slate-400">Nenhuma empresa cadastrada.</td></tr>
              ) : filtradas.map((empresa) => (
                <tr key={empresa.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-700">{empresa.nome}</p>
                    <p className="text-xs text-slate-400">{empresa.cnpj || "CNPJ não informado"}</p>
                  </td>
                  <td className="px-5 py-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-primary">{RAMO_ROTULO[empresa.ramo] ?? empresa.ramo}</span></td>
                  <td className="px-5 py-4 capitalize text-slate-600">{empresa.plano}</td>
                  <td className="px-5 py-4 text-slate-600">{empresa.total_usuarios}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${empresa.status === "ativo" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{empresa.status}</span></td>
                  <td className="px-5 py-4">
                    {empresa.ramo !== "engenharia" ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <div className="flex flex-col gap-1.5 text-xs">
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" checked={!!empresa.mostrar_operadores} onChange={() => void alternarFlag(empresa, "mostrar_operadores")} className="accent-primary" />
                          Operadores
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" checked={!!empresa.mostrar_custos} onChange={() => void alternarFlag(empresa, "mostrar_custos")} className="accent-primary" />
                          Custos
                        </label>
                      </div>
                    )}
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
