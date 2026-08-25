"use client";

import { useEffect, useState } from "react";
import { Building2, ExternalLink, MapPin, MessageCircle, Save, Search, SlidersHorizontal, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { criarModeloMensagemLead, excluirModeloMensagemLead, listarModelosMensagemLead, pesquisarLeads, type LeadEncontrado, type ModeloMensagemLead } from "@/lib/admin-api";

const MODELOS_INICIAIS = [
  { id: "apresentacao", titulo: "Apresentação", conteudo: "Olá, {nome}! Tudo bem? Meu nome é [seu nome] e faço parte da GR Mapping. Gostaria de apresentar uma solução para medição de terrenos e visualização de projetos. Podemos conversar?" },
  { id: "parceria", titulo: "Proposta de parceria", conteudo: "Olá, {nome}! Somos a GR Mapping e ajudamos imobiliárias com medição de terrenos e visualizações de projetos. Gostaria de avaliar uma parceria com vocês. Posso apresentar rapidamente?" },
];

function telefoneWhatsApp(telefone?: string | null) { return (telefone || "").replace(/\D/g, ""); }
function aplicarNome(mensagem: string, nome: string) { return mensagem.replaceAll("{nome}", nome); }

export default function LeadsAdmin() {
  const [cidade, setCidade] = useState("Fortaleza");
  const [segmento, setSegmento] = useState("Imobiliárias");
  const [limite, setLimite] = useState(20);
  const [resultados, setResultados] = useState<LeadEncontrado[]>([]);
  const [modelos, setModelos] = useState<ModeloMensagemLead[]>([]);
  const [modeloId, setModeloId] = useState("apresentacao");
  const [tituloModelo, setTituloModelo] = useState("");
  const [mensagem, setMensagem] = useState(MODELOS_INICIAIS[0].conteudo);
  const [carregando, setCarregando] = useState(false);
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => { void carregarModelos(); }, []);
  async function carregarModelos() {
    try { setModelos(await listarModelosMensagemLead()); } catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível carregar os modelos."); }
  }
  const todosModelos = [...MODELOS_INICIAIS, ...modelos];

  function selecionarModelo(id: string) {
    setModeloId(id);
    const modelo = todosModelos.find((item) => item.id === id);
    if (modelo) { setTituloModelo(modelo.titulo); setMensagem(modelo.conteudo); }
  }
  async function buscar() {
    if (!cidade.trim()) { setErro("Informe a cidade ou região."); return; }
    try { setCarregando(true); setErro(""); setResultados(await pesquisarLeads({ cidade: cidade.trim(), segmento: segmento.trim() || "Imobiliárias", limite })); }
    catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível pesquisar os leads."); }
    finally { setCarregando(false); }
  }
  async function salvarModelo() {
    if (!tituloModelo.trim() || !mensagem.trim()) { setErro("Informe título e mensagem para salvar o modelo."); return; }
    try { setSalvandoModelo(true); setErro(""); const modelo = await criarModeloMensagemLead({ titulo: tituloModelo.trim(), conteudo: mensagem.trim() }); setModelos((atuais) => [...atuais, modelo]); setModeloId(modelo.id); }
    catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível salvar o modelo."); }
    finally { setSalvandoModelo(false); }
  }
  async function apagarModelo(id: string) {
    try { setErro(""); await excluirModeloMensagemLead(id); setModelos((atuais) => atuais.filter((modelo) => modelo.id !== id)); selecionarModelo("apresentacao"); }
    catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível excluir o modelo."); }
  }
  function abrirWhatsApp(lead: LeadEncontrado) {
    const telefone = telefoneWhatsApp(lead.telefone);
    if (!telefone) { setErro("Este lead não possui telefone público no Google Places."); return; }
    window.open(`https://wa.me/${telefone}?text=${encodeURIComponent(aplicarNome(mensagem, lead.nome))}`, "_blank", "noopener,noreferrer");
  }

  return <div className="mx-auto max-w-7xl">
    <div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-50 p-3 text-primary"><Target size={23} /></div><div><p className="text-sm font-medium text-primary">Administração Master</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">Leads</h1><p className="mt-1 text-sm text-slate-500">Encontre imobiliárias e organize oportunidades comerciais.</p></div></div>
    <Card className="mt-7 p-5"><div className="flex items-center gap-2"><span className="rounded-lg bg-indigo-50 p-2 text-primary"><Search size={18} /></span><div><h2 className="font-semibold text-slate-800">Pesquisar novos leads</h2><p className="text-xs text-slate-500">Pesquisa oficial pelo Google Places.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto]"><label className="relative"><MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade ou região" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary" /></label><label className="relative"><Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Segmento" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary" /></label><label className="relative"><SlidersHorizontal size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><select value={limite} onChange={(e) => setLimite(Number(e.target.value))} className="w-full appearance-none rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"><option value={20}>Até 20 resultados</option><option value={40}>Até 40 resultados</option><option value={60}>Até 60 resultados</option></select></label><Button onClick={() => void buscar()} disabled={carregando}><Search size={16} />{carregando ? "Pesquisando..." : "Buscar leads"}</Button></div><p className="mt-3 text-xs text-slate-500">A consulta inclui o telefone público quando a empresa o disponibiliza.</p></Card>
    <Card className="mt-5 p-5"><div className="flex items-center gap-2"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><MessageCircle size={18} /></span><div><h2 className="font-semibold text-slate-800">Mensagem de prospecção</h2><p className="text-xs text-slate-500">Use <code>{"{nome}"}</code> para inserir o nome da empresa automaticamente.</p></div></div><div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]"><select value={modeloId} onChange={(e) => selecionarModelo(e.target.value)} className="rounded-lg border border-slate-200 p-2.5 text-sm"><option value="">Mensagem personalizada</option>{todosModelos.map((modelo) => <option key={modelo.id} value={modelo.id}>{modelo.titulo}</option>)}</select><input value={tituloModelo} onChange={(e) => { setTituloModelo(e.target.value); setModeloId(""); }} placeholder="Nome para salvar este modelo" className="rounded-lg border border-slate-200 p-2.5 text-sm" /><Button onClick={() => void salvarModelo()} disabled={salvandoModelo}><Save size={16} />{salvandoModelo ? "Salvando..." : "Salvar modelo"}</Button></div><textarea value={mensagem} onChange={(e) => { setMensagem(e.target.value); setModeloId(""); }} className="mt-3 min-h-28 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-primary" placeholder="Digite a mensagem que será aberta no WhatsApp" />{modelos.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{modelos.map((modelo) => <button key={modelo.id} onClick={() => void apagarModelo(modelo.id)} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-600" title="Excluir modelo salvo">{modelo.titulo}<Trash2 size={12} /></button>)}</div>}</Card>
    <Card className="mt-5 overflow-hidden p-0"><div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-semibold text-slate-800">Resultados</h2><p className="text-xs text-slate-500">Abra o Maps ou inicie a conversa pelo WhatsApp.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{resultados.length} leads</span></div>{resultados.length === 0 ? <div className="grid place-items-center px-6 py-16 text-center"><div className="rounded-full bg-slate-100 p-4 text-slate-400"><Target size={28} /></div><h3 className="mt-4 font-medium text-slate-700">Pronto para iniciar a prospecção</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Pesquise por cidade e segmento para encontrar empresas.</p></div> : <div className="divide-y divide-slate-100">{resultados.map((lead) => <div key={lead.place_id ?? `${lead.nome}-${lead.endereco}`} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="font-medium text-slate-800">{lead.nome}</p><p className="mt-1 flex items-start gap-1 text-sm text-slate-500"><MapPin className="mt-0.5 shrink-0" size={14} />{lead.endereco || "Endereço não informado"}</p>{lead.telefone && <p className="mt-1 text-xs text-slate-400">{lead.telefone}</p>}</div><div className="flex shrink-0 gap-2">{lead.google_maps_url && <a href={lead.google_maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-primary hover:bg-indigo-50">Maps <ExternalLink size={14} /></a>}<Button onClick={() => abrirWhatsApp(lead)} disabled={!lead.telefone} title={lead.telefone ? "Abrir mensagem no WhatsApp" : "Telefone não informado pelo Google"}><MessageCircle size={16} />WhatsApp</Button></div></div>)}</div>}</Card>
    {erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
  </div>;
}
