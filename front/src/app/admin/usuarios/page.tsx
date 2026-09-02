"use client";

import { useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, Trash2, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  atualizarUsuarioEmpresa, criarUsuarioEmpresa, excluirUsuarioEmpresa,
  listarEmpresas, listarUsuarios, type Empresa, type UsuarioAdmin,
} from "@/lib/admin-api";

const CONTROLE = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";
const RAMO_LABEL: Record<string, string> = { imobiliaria: "Imobiliária", engenharia: "Engenharia" };

type FormAcesso = { nome: string; email: string; senha: string; empresa_id: string; modelo_drone: string };
const vazio = (): FormAcesso => ({ nome: "", email: "", senha: "", empresa_id: "", modelo_drone: "" });

function CamposAcesso({ dados, set, incluirSenha, empresas }: {
  dados: FormAcesso; set: (d: FormAcesso) => void; incluirSenha: boolean; empresas: Empresa[];
}) {
  const ehEng = empresas.find((e) => e.id === dados.empresa_id)?.ramo === "engenharia";
  return (
    <>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-slate-600">Nome do funcionário</label>
        <input value={dados.nome} onChange={(e) => set({ ...dados, nome: e.target.value })} className={CONTROLE} /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-slate-600">E-mail de acesso</label>
        <input value={dados.email} onChange={(e) => set({ ...dados, email: e.target.value })} type="email" className={CONTROLE} /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-slate-600">{incluirSenha ? "Senha inicial" : "Nova senha (opcional)"}</label>
        <input value={dados.senha} onChange={(e) => set({ ...dados, senha: e.target.value })} type="password" className={CONTROLE} /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-slate-600">Empresa</label>
        <select value={dados.empresa_id} onChange={(e) => set({ ...dados, empresa_id: e.target.value })} className={CONTROLE}>
          <option value="">Selecione a empresa</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome} · {RAMO_LABEL[e.ramo] ?? e.ramo}</option>)}
        </select></div>
      {ehEng && (
        <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-slate-600">Modelo do drone <span className="text-slate-400">(operador)</span></label>
          <input value={dados.modelo_drone} onChange={(e) => set({ ...dados, modelo_drone: e.target.value })} placeholder="Ex: DJI Mini 3" className={CONTROLE} /></div>
      )}
    </>
  );
}

export default function UsuariosAdmin() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<FormAcesso>(vazio);
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);
  const [formEdicao, setFormEdicao] = useState<FormAcesso>(vazio);

  async function carregar() {
    try {
      const [e, u] = await Promise.all([listarEmpresas(), listarUsuarios()]);
      setEmpresas(e); setUsuarios(u);
      setForm((a) => ({ ...a, empresa_id: a.empresa_id || e[0]?.id || "" }));
    } catch (c) { setErro(c instanceof Error ? c.message : "Não foi possível carregar os acessos."); }
  }
  useEffect(() => { void carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function criar() {
    if (!form.nome.trim() || !form.email.trim() || !form.senha || !form.empresa_id) { setErro("Preencha nome, e-mail, senha e empresa."); return; }
    try {
      setSalvando(true); setErro("");
      const u = await criarUsuarioEmpresa({ ...form, nome: form.nome.trim(), email: form.email.trim(), modelo_drone: form.modelo_drone.trim() || undefined });
      setUsuarios((atuais) => [u, ...atuais.filter((i) => i.email !== u.email)]);
      setForm((a) => ({ ...vazio(), empresa_id: a.empresa_id }));
    } catch (c) { setErro(c instanceof Error ? c.message : "Não foi possível salvar o acesso."); }
    finally { setSalvando(false); }
  }

  function abrirEdicao(u: UsuarioAdmin) {
    setErro(""); setEditando(u);
    setFormEdicao({ nome: u.nome || "", email: u.email, senha: "", empresa_id: u.empresa_id || "", modelo_drone: "" });
  }

  async function salvarEdicao() {
    if (!editando || !formEdicao.nome.trim() || !formEdicao.email.trim() || !formEdicao.empresa_id) { setErro("Preencha nome, e-mail e empresa."); return; }
    try {
      setSalvando(true); setErro("");
      const u = await atualizarUsuarioEmpresa(editando.id, {
        ...formEdicao, nome: formEdicao.nome.trim(), email: formEdicao.email.trim(),
        senha: formEdicao.senha || undefined, modelo_drone: formEdicao.modelo_drone.trim() || undefined,
      });
      setUsuarios((atuais) => atuais.map((i) => i.id === u.id ? u : i));
      setEditando(null);
    } catch (c) { setErro(c instanceof Error ? c.message : "Não foi possível atualizar o acesso."); }
    finally { setSalvando(false); }
  }

  async function excluir(u: UsuarioAdmin) {
    if (!window.confirm(`Excluir o acesso de ${u.nome || u.email}? O usuário não conseguirá mais entrar.`)) return;
    try {
      setErro(""); await excluirUsuarioEmpresa(u.id);
      setUsuarios((atuais) => atuais.map((i) => i.id === u.id ? { ...i, ativo: false } : i));
    } catch (c) { setErro(c instanceof Error ? c.message : "Não foi possível excluir o acesso."); }
  }

  const colaboradores = usuarios.filter((u) => u.perfil === "imobiliaria");

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-indigo-50 p-3 text-primary"><UsersRound size={23} /></div>
        <div>
          <p className="text-sm font-medium text-primary">Administração Master</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Usuários e acessos</h1>
          <p className="mt-1 text-sm text-slate-500">Cadastre funcionários e vincule cada acesso à empresa correta.</p>
        </div>
      </div>

      <Card className="mt-7 p-6">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-indigo-50 p-2 text-primary"><KeyRound size={18} /></span>
          <div>
            <h2 className="font-semibold text-slate-800">Novo acesso</h2>
            <p className="text-xs text-slate-500">Funcionários da mesma empresa compartilham a mesma carteira de dados.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CamposAcesso dados={form} set={setForm} incluirSenha empresas={empresas} />
        </div>
        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
          <Button onClick={() => void criar()} disabled={salvando}><Plus size={16} />{salvando ? "Salvando..." : "Criar acesso"}</Button>
        </div>
      </Card>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="border-b border-slate-100 p-4">
          <h2 className="font-semibold text-slate-800">Acessos cadastrados</h2>
          <p className="text-xs text-slate-500">{colaboradores.length} funcionário(s)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="px-5 py-3">Funcionário</th><th className="px-5 py-3">Empresa</th><th className="px-5 py-3">Ramo</th>
                <th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-4"><p className="font-medium text-slate-700">{u.nome || "Sem nome"}</p><p className="text-xs text-slate-400">{u.email}</p></td>
                  <td className="px-5 py-4 text-slate-600">{u.empresa_nome || "Não vinculada"}</td>
                  <td className="px-5 py-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-primary">{RAMO_LABEL[u.empresa_ramo ?? ""] ?? "—"}</span></td>
                  <td className="px-5 py-4"><span className={u.ativo ? "text-emerald-600" : "text-red-600"}>{u.ativo ? "Ativo" : "Excluído"}</span></td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => abrirEdicao(u)} className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-primary" title="Editar"><Pencil size={16} /></button>
                      {u.ativo && <button onClick={() => void excluir(u)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir"><Trash2 size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {colaboradores.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">Nenhum funcionário cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {editando && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <Card className="w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Editar acesso</h2>
                <p className="mt-1 text-sm text-slate-500">Deixe a senha vazia para mantê-la como está.</p>
              </div>
              <button onClick={() => setEditando(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <CamposAcesso dados={formEdicao} set={setFormEdicao} incluirSenha={false} empresas={empresas} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button onClick={() => void salvarEdicao()} disabled={salvando}>{salvando ? "Salvando..." : "Salvar alterações"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
