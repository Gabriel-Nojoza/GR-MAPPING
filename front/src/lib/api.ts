import type { PainelResumo } from "@/types/painel";
import type { Analise, Medicao, Ponto } from "@/types/medicao";
import type { Terreno } from "@/types/terreno";
import type { EvolucaoStatus, JobResumo, ProjetoStatus } from "@/types/job";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getPainelResumo(): Promise<PainelResumo> {
  const res = await fetch(`${API_URL}/painel/resumo`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Falha ao buscar o painel: ${res.status}`);
  }

  return res.json();
}

export async function analisarFoto(foto: File): Promise<Analise> {
  const formData = new FormData();
  formData.append("foto", foto);

  const res = await fetch(`${API_URL}/analisar`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    throw new Error(erro?.detail ?? `Falha ao analisar a foto: ${res.status}`);
  }

  return res.json();
}

export async function medirTerreno(foto: File, pontos: Ponto[], nome?: string): Promise<Medicao> {
  const formData = new FormData();
  formData.append("foto", foto);
  formData.append("pontos", JSON.stringify(pontos.map((p) => [p.x, p.y])));
  if (nome) formData.append("nome", nome);

  const res = await fetch(`${API_URL}/medir`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    throw new Error(erro?.detail ?? `Falha ao medir o terreno: ${res.status}`);
  }

  return res.json();
}

export async function medirTerrenoManual(
  foto: File,
  pontos: Ponto[],
  referencia: [Ponto, Ponto],
  distanciaReferenciaM: number,
  nome?: string,
): Promise<Medicao> {
  const formData = new FormData();
  formData.append("foto", foto);
  formData.append("pontos", JSON.stringify(pontos.map((p) => [p.x, p.y])));
  formData.append("referencia", JSON.stringify(referencia.map((p) => [p.x, p.y])));
  formData.append("distancia_referencia_m", String(distanciaReferenciaM));
  if (nome) formData.append("nome", nome);

  const res = await fetch(`${API_URL}/medir-manual`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    throw new Error(erro?.detail ?? `Falha ao medir o terreno: ${res.status}`);
  }

  return res.json();
}

export async function medirTerrenoAltura(
  foto: File,
  pontos: Ponto[],
  alturaVooM: number,
  fovHorizontalDeg?: number,
  nome?: string,
): Promise<Medicao> {
  const formData = new FormData();
  formData.append("foto", foto);
  formData.append("pontos", JSON.stringify(pontos.map((p) => [p.x, p.y])));
  formData.append("altura_voo_m", String(alturaVooM));
  if (fovHorizontalDeg) {
    formData.append("fov_horizontal_deg", String(fovHorizontalDeg));
  }
  if (nome) formData.append("nome", nome);

  const res = await fetch(`${API_URL}/medir-altura`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    throw new Error(erro?.detail ?? `Falha ao medir o terreno: ${res.status}`);
  }

  return res.json();
}

export async function getTerrenos(): Promise<Terreno[]> {
  const res = await fetch(`${API_URL}/terrenos`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Falha ao buscar terrenos: ${res.status}`);
  }

  return res.json();
}

export async function getVideos(): Promise<JobResumo[]> {
  const res = await fetch(`${API_URL}/videos`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Falha ao buscar vídeos: ${res.status}`);
  }

  return res.json();
}

export async function gerarProjeto(
  foto: File,
  descricao: string,
  referencia?: File,
  fotosAdicionais: File[] = [],
): Promise<ProjetoStatus> {
  const formData = new FormData();
  formData.append("foto", foto);
  formData.append("descricao", descricao);
  if (referencia) formData.append("referencia", referencia);
  fotosAdicionais.forEach((arquivo) => formData.append("fotos_adicionais", arquivo));

  const res = await fetch(`${API_URL}/gerar-projeto`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    throw new Error(erro?.detail ?? `Falha ao gerar o projeto: ${res.status}`);
  }

  return res.json();
}

export async function statusProjeto(jobId: string): Promise<ProjetoStatus> {
  const res = await fetch(`${API_URL}/gerar-projeto/${jobId}`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Falha ao consultar o job: ${res.status}`);
  }

  return res.json();
}

export async function estenderProjeto(jobId: string): Promise<ProjetoStatus> {
  const res = await fetch(`${API_URL}/gerar-projeto/${jobId}/estender`, { method: "POST" });

  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    throw new Error(erro?.detail ?? `Falha ao estender o vídeo: ${res.status}`);
  }

  return res.json();
}

export async function gerarProjetoEvolucao(
  foto: File,
  descricao: string,
  referencia?: File,
): Promise<EvolucaoStatus> {
  const formData = new FormData();
  formData.append("foto", foto);
  formData.append("descricao", descricao);
  if (referencia) formData.append("referencia", referencia);

  const res = await fetch(`${API_URL}/gerar-projeto-evolucao`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    throw new Error(erro?.detail ?? `Falha ao gerar a evolução do projeto: ${res.status}`);
  }

  return res.json();
}

export async function statusEvolucao(grupoId: string): Promise<EvolucaoStatus> {
  const res = await fetch(`${API_URL}/gerar-projeto-evolucao/${grupoId}`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Falha ao consultar o grupo: ${res.status}`);
  }

  return res.json();
}


export async function renomearTerreno(id: string, nome: string, pontos?: [number, number][]): Promise<Terreno> {
  const res = await fetch(`${API_URL}/terrenos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, ...(pontos ? { pontos } : {}) }),
  });

  if (!res.ok) {
    throw new Error(`Falha ao renomear: ${res.status}`);
  }

  return res.json();
}

export async function excluirTerreno(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/terrenos/${id}`, { method: "DELETE" });

  if (!res.ok) {
    throw new Error(`Falha ao excluir: ${res.status}`);
  }
}

export type LancamentoFinanceiro = {
  id: string; tipo: "receita" | "despesa"; descricao: string; categoria: string;
  valor: number; vencimento: string; status: "pendente" | "pago" | "atrasado"; observacao?: string | null;
};

export type ResumoFinanceiro = { receitas_pagas: number; despesas_pagas: number; saldo: number; a_receber: number; a_pagar: number; atrasados: number };

async function financeiroResposta(res: Response) {
  if (!res.ok) { const erro = await res.json().catch(() => null); throw new Error(erro?.detail ?? "Erro financeiro"); }
  return res.json();
}

export async function getFinanceiro(mes: string) { return financeiroResposta(await fetch(`${API_URL}/financeiro?mes=${mes}`, { cache: "no-store" })) as Promise<LancamentoFinanceiro[]>; }
export async function getResumoFinanceiro(mes: string) { return financeiroResposta(await fetch(`${API_URL}/financeiro/resumo?mes=${mes}`, { cache: "no-store" })) as Promise<ResumoFinanceiro>; }
export async function criarLancamento(dados: { tipo: "receita" | "despesa"; descricao: string; categoria: string; valor_centavos: number; vencimento: string; observacao?: string }) { return financeiroResposta(await fetch(`${API_URL}/financeiro`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) })); }
export async function marcarLancamento(id: string, status: "pendente" | "pago") { return financeiroResposta(await fetch(`${API_URL}/financeiro/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })); }
export async function excluirLancamento(id: string) { return financeiroResposta(await fetch(`${API_URL}/financeiro/${id}`, { method: "DELETE" })); }

export type Cliente = { id: string; criado_em: string; nome: string; contato?: string | null; email?: string | null };
export async function getClientes(busca = "") { const res = await fetch(`${API_URL}/clientes?busca=${encodeURIComponent(busca)}`, { cache: "no-store" }); return financeiroResposta(res) as Promise<Cliente[]>; }
export async function criarCliente(dados: { nome: string; contato?: string; email?: string }) { return financeiroResposta(await fetch(`${API_URL}/clientes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) })); }
export async function excluirCliente(id: string) { return financeiroResposta(await fetch(`${API_URL}/clientes/${id}`, { method: "DELETE" })); }

export type Documento = { id: string; criado_em: string; titulo: string; categoria: string; nome_arquivo: string; mime?: string | null; tamanho_bytes: number };
export async function getDocumentos(busca = "") { const res = await fetch(`${API_URL}/documentos?busca=${encodeURIComponent(busca)}`, { cache: "no-store" }); return financeiroResposta(res) as Promise<Documento[]>; }
export async function enviarDocumento(arquivo: File, titulo: string, categoria: string) { const dados = new FormData(); dados.append("arquivo", arquivo); dados.append("titulo", titulo); dados.append("categoria", categoria); return financeiroResposta(await fetch(`${API_URL}/documentos`, { method: "POST", body: dados })); }
export async function excluirDocumento(id: string) { return financeiroResposta(await fetch(`${API_URL}/documentos/${id}`, { method: "DELETE" })); }

export async function getWhatsappStatus() { return financeiroResposta(await fetch(`${API_URL}/whatsapp/status`, { cache: "no-store" })) as Promise<{ configurada: boolean; instancia?: string; estado: string; erro?: string }>; }
export async function conectarWhatsapp() { return financeiroResposta(await fetch(`${API_URL}/whatsapp/conectar`, { method: "POST" })) as Promise<{ qrcode: string; instancia: string }>; }

export type Imovel = {
  id: string; criado_em: string; titulo: string; tipo: string; endereco?: string | null;
  descricao?: string | null; valor_aluguel: number; taxa_condominio: number;
  status: "disponivel" | "alugado"; cliente_id?: string | null; cliente_nome?: string | null;
  dia_vencimento?: number | null; foto_nome?: string | null;
};
export type Cobranca = {
  id: string; competencia: string; vencimento: string; valor: number;
  status: "pendente" | "pago" | "atrasado"; imovel_id: string; cliente_id: string;
  imovel_titulo: string; cliente_nome: string; cliente_contato?: string | null;
  lembrete_enviado_em?: string | null;
};
export async function getImoveis(busca = "") { return financeiroResposta(await fetch(`${API_URL}/imoveis?busca=${encodeURIComponent(busca)}`, { cache: "no-store" })) as Promise<Imovel[]>; }
export async function criarImovel(dados: { titulo: string; tipo: string; endereco?: string; descricao?: string; valor_aluguel_centavos: number; taxa_condominio_centavos: number; cliente_id?: string; dia_vencimento?: number }) { return financeiroResposta(await fetch(`${API_URL}/imoveis`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) })) as Promise<Imovel>; }
export async function enviarFotoImovel(id: string, foto: File) { const form = new FormData(); form.append("foto", foto); return financeiroResposta(await fetch(`${API_URL}/imoveis/${id}/foto`, { method: "POST", body: form })); }
export async function excluirImovel(id: string) { return financeiroResposta(await fetch(`${API_URL}/imoveis/${id}`, { method: "DELETE" })); }
export async function getCobrancas(mes: string) { return financeiroResposta(await fetch(`${API_URL}/cobrancas?mes=${mes}`, { cache: "no-store" })) as Promise<Cobranca[]>; }
export async function criarCobranca(dados: { imovel_id: string; competencia: string; vencimento: string; valor_centavos?: number }) { return financeiroResposta(await fetch(`${API_URL}/cobrancas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) })); }
export async function marcarCobranca(id: string, status: "pendente" | "pago") { return financeiroResposta(await fetch(`${API_URL}/cobrancas/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })); }
export async function enviarLembreteCobranca(id: string) { return financeiroResposta(await fetch(`${API_URL}/cobrancas/${id}/enviar-lembrete`, { method: "POST" })); }
