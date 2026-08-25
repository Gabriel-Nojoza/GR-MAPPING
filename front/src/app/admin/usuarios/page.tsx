"use client";

import { useEffect, useState } from "react";
import { KeyRound, Plus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { criarUsuarioEmpresa, listarEmpresas, listarUsuarios, type Empresa, type UsuarioAdmin } from "@/lib/admin-api";

export default function UsuariosAdmin() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", empresa_id: "" });

  async function carregar() {
    try {
      const [empresasAtuais, usuariosAtuais] = await Promise.all([listarEmpresas(), listarUsuarios()]);
      setEmpresas(empresasAtuais); setUsuarios(usuariosAtuais);
      setForm((atual) => ({ ...atual, empresa_id: atual.empresa_id || empresasAtuais[0]?.id || "" }));
    } catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível carregar os acessos."); }
  }
  useEffect(() => { void carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar() {
    if (!form.nome.trim() || !form.email.trim() || !form.senha || !form.empresa_id) { setErro("Preencha nome, e-mail, senha e imobiliária."); return; }
    try {
      setSalvando(true); setErro("");
      const usuario = await criarUsuarioEmpresa({ ...form, nome: form.nome.trim(), email: form.email.trim() });
      setUsuarios((atuais) => [usuario, ...atuais.filter((item) => item.email !== usuario.email)]);
      setForm((atual) => ({ ...atual, nome: "", email: "", senha: "" }));
    } catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível salvar o acesso."); }
    finally { setSalvando(false); }
  }

  const colaboradores = usuarios.filter((usuario) => usuario.perfil === "imobiliaria");
  return <div className="mx-auto max-w-7xl"><div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-50 p-3 text-primary"><UsersRound size={23} /></div><div><p className="text-sm font-medium text-primary">Administração Master</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">Usuários e acessos</h1><p className="mt-1 text-sm text-slate-500">Cadastre funcionários e vincule cada acesso à imobiliária correta.</p></div></div><Card className="mt-7 p-5"><div className="flex items-center gap-2"><span className="rounded-lg bg-indigo-50 p-2 text-primary"><KeyRound size={18} /></span><div><h2 className="font-semibold text-slate-800">Novo acesso de imobiliária</h2><p className="text-xs text-slate-500">Funcionários da mesma empresa compartilham a mesma carteira de dados.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do funcionário" className="rounded-lg border border-slate-200 p-2.5 text-sm" /><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail de acesso" type="email" className="rounded-lg border border-slate-200 p-2.5 text-sm" /><input value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder="Senha inicial" type="password" className="rounded-lg border border-slate-200 p-2.5 text-sm" /><select value={form.empresa_id} onChange={(e) => setForm({ ...form, empresa_id: e.target.value })} className="rounded-lg border border-slate-200 p-2.5 text-sm"><option value="">Selecione a imobiliária</option>{empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}</select><Button onClick={() => void salvar()} disabled={salvando}><Plus size={16} />{salvando ? "Salvando..." : "Criar acesso"}</Button></div></Card><Card className="mt-5 overflow-hidden p-0"><div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-800">Acessos cadastrados</h2><p className="text-xs text-slate-500">{colaboradores.length} funcionário(s) de imobiliárias</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs text-slate-400"><th className="px-5 py-3">Funcionário</th><th className="px-5 py-3">Imobiliária</th><th className="px-5 py-3">Perfil</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{colaboradores.map((usuario) => <tr key={usuario.id} className="border-b border-slate-50 last:border-0"><td className="px-5 py-4"><p className="font-medium text-slate-700">{usuario.nome || "Sem nome"}</p><p className="text-xs text-slate-400">{usuario.email}</p></td><td className="px-5 py-4 text-slate-600">{usuario.empresa_nome || "Não vinculada"}</td><td className="px-5 py-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-primary">Imobiliária</span></td><td className="px-5 py-4"><span className={usuario.ativo ? "text-emerald-600" : "text-red-600"}>{usuario.ativo ? "Ativo" : "Bloqueado"}</span></td></tr>)}{colaboradores.length === 0 && <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">Nenhum funcionário cadastrado.</td></tr>}</tbody></table></div></Card>{erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}</div>;
}
