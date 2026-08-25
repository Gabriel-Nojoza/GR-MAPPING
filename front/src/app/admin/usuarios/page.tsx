"use client";

import { useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, Trash2, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { atualizarUsuarioEmpresa, criarUsuarioEmpresa, excluirUsuarioEmpresa, listarEmpresas, listarUsuarios, type Empresa, type UsuarioAdmin } from "@/lib/admin-api";

type FormAcesso = { nome: string; email: string; senha: string; empresa_id: string };
const vazio = (): FormAcesso => ({ nome: "", email: "", senha: "", empresa_id: "" });

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
      const [empresasAtuais, usuariosAtuais] = await Promise.all([listarEmpresas(), listarUsuarios()]);
      setEmpresas(empresasAtuais); setUsuarios(usuariosAtuais);
      setForm((atual) => ({ ...atual, empresa_id: atual.empresa_id || empresasAtuais[0]?.id || "" }));
    } catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível carregar os acessos."); }
  }
  useEffect(() => { void carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function criar() {
    if (!form.nome.trim() || !form.email.trim() || !form.senha || !form.empresa_id) { setErro("Preencha nome, e-mail, senha e imobiliária."); return; }
    try {
      setSalvando(true); setErro("");
      const usuario = await criarUsuarioEmpresa({ ...form, nome: form.nome.trim(), email: form.email.trim() });
      setUsuarios((atuais) => [usuario, ...atuais.filter((item) => item.email !== usuario.email)]);
      setForm((atual) => ({ ...vazio(), empresa_id: atual.empresa_id }));
    } catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível salvar o acesso."); }
    finally { setSalvando(false); }
  }

  function abrirEdicao(usuario: UsuarioAdmin) {
    setErro(""); setEditando(usuario);
    setFormEdicao({ nome: usuario.nome || "", email: usuario.email, senha: "", empresa_id: usuario.empresa_id || "" });
  }

  async function salvarEdicao() {
    if (!editando || !formEdicao.nome.trim() || !formEdicao.email.trim() || !formEdicao.empresa_id) { setErro("Preencha nome, e-mail e imobiliária."); return; }
    try {
      setSalvando(true); setErro("");
      const usuario = await atualizarUsuarioEmpresa(editando.id, { ...formEdicao, nome: formEdicao.nome.trim(), email: formEdicao.email.trim(), senha: formEdicao.senha || undefined });
      setUsuarios((atuais) => atuais.map((item) => item.id === usuario.id ? usuario : item));
      setEditando(null);
    } catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível atualizar o acesso."); }
    finally { setSalvando(false); }
  }

  async function excluir(usuario: UsuarioAdmin) {
    if (!window.confirm(`Excluir o acesso de ${usuario.nome || usuario.email}? O usuário não conseguirá mais entrar.`)) return;
    try {
      setErro(""); await excluirUsuarioEmpresa(usuario.id);
      setUsuarios((atuais) => atuais.map((item) => item.id === usuario.id ? { ...item, ativo: false } : item));
    } catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível excluir o acesso."); }
  }

  const colaboradores = usuarios.filter((usuario) => usuario.perfil === "imobiliaria");
  const campos = (dados: FormAcesso, setDados: (dados: FormAcesso) => void, incluirSenha: boolean) => <><input value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} placeholder="Nome do funcionário" className="rounded-lg border border-slate-200 p-2.5 text-sm" /><input value={dados.email} onChange={(e) => setDados({ ...dados, email: e.target.value })} placeholder="E-mail de acesso" type="email" className="rounded-lg border border-slate-200 p-2.5 text-sm" /><input value={dados.senha} onChange={(e) => setDados({ ...dados, senha: e.target.value })} placeholder={incluirSenha ? "Senha inicial" : "Nova senha (opcional)"} type="password" className="rounded-lg border border-slate-200 p-2.5 text-sm" /><select value={dados.empresa_id} onChange={(e) => setDados({ ...dados, empresa_id: e.target.value })} className="rounded-lg border border-slate-200 p-2.5 text-sm"><option value="">Selecione a imobiliária</option>{empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}</select></>;

  return <div className="mx-auto max-w-7xl"><div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-50 p-3 text-primary"><UsersRound size={23} /></div><div><p className="text-sm font-medium text-primary">Administração Master</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">Usuários e acessos</h1><p className="mt-1 text-sm text-slate-500">Cadastre funcionários e vincule cada acesso à imobiliária correta.</p></div></div><Card className="mt-7 p-5"><div className="flex items-center gap-2"><span className="rounded-lg bg-indigo-50 p-2 text-primary"><KeyRound size={18} /></span><div><h2 className="font-semibold text-slate-800">Novo acesso de imobiliária</h2><p className="text-xs text-slate-500">Funcionários da mesma empresa compartilham a mesma carteira de dados.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{campos(form, setForm, true)}<Button onClick={() => void criar()} disabled={salvando}><Plus size={16} />{salvando ? "Salvando..." : "Criar acesso"}</Button></div></Card><Card className="mt-5 overflow-hidden p-0"><div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-800">Acessos cadastrados</h2><p className="text-xs text-slate-500">{colaboradores.length} funcionário(s) de imobiliárias</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs text-slate-400"><th className="px-5 py-3">Funcionário</th><th className="px-5 py-3">Imobiliária</th><th className="px-5 py-3">Perfil</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody>{colaboradores.map((usuario) => <tr key={usuario.id} className="border-b border-slate-50 last:border-0"><td className="px-5 py-4"><p className="font-medium text-slate-700">{usuario.nome || "Sem nome"}</p><p className="text-xs text-slate-400">{usuario.email}</p></td><td className="px-5 py-4 text-slate-600">{usuario.empresa_nome || "Não vinculada"}</td><td className="px-5 py-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-primary">Imobiliária</span></td><td className="px-5 py-4"><span className={usuario.ativo ? "text-emerald-600" : "text-red-600"}>{usuario.ativo ? "Ativo" : "Excluído"}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => abrirEdicao(usuario)} className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-primary" title="Editar"><Pencil size={16} /></button>{usuario.ativo && <button onClick={() => void excluir(usuario)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir"><Trash2 size={16} /></button>}</div></td></tr>)}{colaboradores.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">Nenhum funcionário cadastrado.</td></tr>}</tbody></table></div></Card>{erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}{editando && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><Card className="w-full max-w-2xl p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-900">Editar acesso</h2><p className="mt-1 text-sm text-slate-500">Deixe a senha vazia para mantê-la como está.</p></div><button onClick={() => setEditando(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><div className="mt-5 grid gap-3 md:grid-cols-2">{campos(formEdicao, setFormEdicao, false)}</div><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button><Button onClick={() => void salvarEdicao()} disabled={salvando}>{salvando ? "Salvando..." : "Salvar alterações"}</Button></div></Card></div>}</div>;
}
