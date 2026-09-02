"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSignature, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  atualizarContrato, criarContrato, excluirContrato, listarContratos, type Contrato,
} from "@/lib/admin-api";
import { gerarContratoPdf, type Contratada } from "@/components/admin/contrato-pdf";

const CONTROLE = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

type Form = {
  numero: string; contratante_nome: string; contratante_doc: string; contratante_endereco: string;
  servico: string; valor: string; forma_pagamento: string; data_inicio: string; prazo_meses: string;
  observacoes: string; status: Contrato["status"];
};
const vazio = (): Form => ({
  numero: "", contratante_nome: "", contratante_doc: "", contratante_endereco: "",
  servico: "Mapeamento aéreo e acompanhamento de obra por drone (plataforma GR Mapping)",
  valor: "", forma_pagamento: "", data_inicio: "", prazo_meses: "", observacoes: "", status: "rascunho",
});

const CONTRATADA_PADRAO: Contratada = { nome: "GR Mapping", doc: "", endereco: "", cidade: "" };

export default function ContratosAdmin() {
  const [lista, setLista] = useState<Contrato[]>([]);
  const [form, setForm] = useState<Form>(vazio);
  const [editId, setEditId] = useState<string | null>(null);
  const [contratada, setContratada] = useState<Contratada>(CONTRATADA_PADRAO);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [abrirCfg, setAbrirCfg] = useState(false);

  useEffect(() => {
    listarContratos().then(setLista).catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."));
    try {
      const c = JSON.parse(localStorage.getItem("gr:contratada") ?? "null");
      if (c) setContratada({ ...CONTRATADA_PADRAO, ...c });
    } catch { /* ignore */ }
  }, []);

  function salvarContratada(c: Contratada) {
    setContratada(c);
    try { localStorage.setItem("gr:contratada", JSON.stringify(c)); } catch { /* ignore */ }
  }

  const payload = useMemo(() => ({
    numero: form.numero.trim() || null,
    contratante_nome: form.contratante_nome.trim(),
    contratante_doc: form.contratante_doc.trim() || null,
    contratante_endereco: form.contratante_endereco.trim() || null,
    servico: form.servico.trim(),
    valor_centavos: Math.round((Number(form.valor) || 0) * 100),
    forma_pagamento: form.forma_pagamento.trim() || null,
    data_inicio: form.data_inicio || null,
    prazo_meses: form.prazo_meses ? Number(form.prazo_meses) : null,
    observacoes: form.observacoes.trim() || null,
    status: form.status,
  }), [form]);

  async function salvar() {
    if (!form.contratante_nome.trim() || !form.servico.trim()) { setErro("Informe o contratante e o serviço."); return; }
    try {
      setSalvando(true); setErro("");
      const c = editId ? await atualizarContrato(editId, payload) : await criarContrato(payload);
      setLista((atual) => editId ? atual.map((x) => x.id === c.id ? c : x) : [c, ...atual]);
      setForm(vazio()); setEditId(null);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSalvando(false); }
  }

  function editar(c: Contrato) {
    setEditId(c.id);
    setForm({
      numero: c.numero ?? "", contratante_nome: c.contratante_nome, contratante_doc: c.contratante_doc ?? "",
      contratante_endereco: c.contratante_endereco ?? "", servico: c.servico, valor: String(c.valor || ""),
      forma_pagamento: c.forma_pagamento ?? "", data_inicio: c.data_inicio ?? "",
      prazo_meses: c.prazo_meses ? String(c.prazo_meses) : "", observacoes: c.observacoes ?? "", status: c.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function apagar(c: Contrato) {
    if (window.confirm(`Excluir o contrato de ${c.contratante_nome}?`)) {
      await excluirContrato(c.id);
      setLista((atual) => atual.filter((x) => x.id !== c.id));
    }
  }

  function baixarPdf(c: Contrato) {
    if (!contratada.doc || !contratada.cidade) setAbrirCfg(true);
    gerarContratoPdf(c, contratada);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-50 p-3 text-primary"><FileSignature size={23} /></div>
          <div>
            <p className="text-sm font-medium text-primary">Administração Master</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Contratos</h1>
            <p className="mt-1 text-sm text-slate-500">Gere o contrato quando fechar negócio e baixe o PDF.</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setAbrirCfg(true)}>Dados da GR Mapping</Button>
      </div>

      <Card className="mt-6 p-6">
        <h2 className="font-semibold text-slate-800">{editId ? "Editar contrato" : "Novo contrato"}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-slate-600">Nº do contrato</label>
            <input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="ex: 2026-001" className={CONTROLE} /></div>
          <div className="flex flex-col gap-1.5 sm:col-span-2"><label className="text-xs font-medium text-slate-600">Cliente / empresa (contratante)</label>
            <input value={form.contratante_nome} onChange={(e) => setForm({ ...form, contratante_nome: e.target.value })} placeholder="Nome / razão social" className={CONTROLE} /></div>
          <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-slate-600">CNPJ / CPF</label>
            <input value={form.contratante_doc} onChange={(e) => setForm({ ...form, contratante_doc: e.target.value })} className={CONTROLE} /></div>
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4"><label className="text-xs font-medium text-slate-600">Endereço do contratante</label>
            <input value={form.contratante_endereco} onChange={(e) => setForm({ ...form, contratante_endereco: e.target.value })} className={CONTROLE} /></div>
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4"><label className="text-xs font-medium text-slate-600">Serviço (objeto do contrato)</label>
            <textarea value={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.value })} rows={2} className={CONTROLE} /></div>
          <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-slate-600">Valor (R$)</label>
            <input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} type="number" min="0" step="0.01" className={CONTROLE} /></div>
          <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-slate-600">Forma de pagamento</label>
            <input value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} placeholder="ex: mensal, via boleto" className={CONTROLE} /></div>
          <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-slate-600">Início</label>
            <input value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} type="date" className={CONTROLE} /></div>
          <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-slate-600">Prazo (meses)</label>
            <input value={form.prazo_meses} onChange={(e) => setForm({ ...form, prazo_meses: e.target.value })} type="number" min="0" placeholder="vazio = indeterminado" className={CONTROLE} /></div>
          <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-slate-600">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Contrato["status"] })} className={CONTROLE}>
              <option value="rascunho">Rascunho</option><option value="assinado">Assinado</option><option value="encerrado">Encerrado</option>
            </select></div>
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3"><label className="text-xs font-medium text-slate-600">Observações (vira cláusula geral)</label>
            <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className={CONTROLE} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          {editId && <Button variant="secondary" onClick={() => { setForm(vazio()); setEditId(null); }}>Cancelar</Button>}
          <Button onClick={salvar} disabled={salvando}><Plus size={16} />{salvando ? "Salvando..." : editId ? "Salvar" : "Criar contrato"}</Button>
        </div>
      </Card>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-800">Contratos</h2><p className="text-xs text-slate-500">{lista.length} contrato(s)</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="px-5 py-3">Nº</th><th className="px-5 py-3">Contratante</th><th className="px-5 py-3">Serviço</th>
                <th className="px-5 py-3">Valor</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Nenhum contrato ainda.</td></tr>
              ) : lista.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-4 text-slate-500">{c.numero || "—"}</td>
                  <td className="px-5 py-4 font-medium text-slate-700">{c.contratante_nome}</td>
                  <td className="px-5 py-4 max-w-xs truncate text-slate-500">{c.servico}</td>
                  <td className="px-5 py-4 text-slate-600">{brl(c.valor)}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${c.status === "assinado" ? "bg-emerald-50 text-emerald-700" : c.status === "encerrado" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-700"}`}>{c.status}</span></td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => baixarPdf(c)} className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-indigo-100" title="Baixar PDF"><FileText size={14} /> PDF</button>
                      <button onClick={() => editar(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-primary"><Pencil size={15} /></button>
                      <button onClick={() => apagar(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {abrirCfg && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <Card className="w-full max-w-lg p-6">
            <div className="flex items-start justify-between">
              <div><h2 className="text-lg font-semibold text-slate-900">Dados da GR Mapping</h2><p className="mt-1 text-sm text-slate-500">Usados como CONTRATADA no PDF. Fica salvo neste navegador.</p></div>
              <button onClick={() => setAbrirCfg(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="mt-4 grid gap-3">
              <input value={contratada.nome} onChange={(e) => setContratada({ ...contratada, nome: e.target.value })} placeholder="Razão social" className={CONTROLE} />
              <input value={contratada.doc} onChange={(e) => setContratada({ ...contratada, doc: e.target.value })} placeholder="CNPJ" className={CONTROLE} />
              <input value={contratada.endereco} onChange={(e) => setContratada({ ...contratada, endereco: e.target.value })} placeholder="Endereço completo" className={CONTROLE} />
              <input value={contratada.cidade} onChange={(e) => setContratada({ ...contratada, cidade: e.target.value })} placeholder="Cidade (foro)" className={CONTROLE} />
            </div>
            <div className="mt-5 flex justify-end"><Button onClick={() => { salvarContratada(contratada); setAbrirCfg(false); }}>Salvar</Button></div>
          </Card>
        </div>
      )}
    </div>
  );
}
