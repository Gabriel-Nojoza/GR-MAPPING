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
  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    const detalhe = erro?.detail;
    const mensagem = Array.isArray(detalhe)
      ? detalhe.map((item) => item.msg ?? "Dados inválidos").join(". ")
      : detalhe ?? "Erro ao processar a solicitação";
    throw new Error(mensagem);
  }
  return res.json();
}

export async function getFinanceiro(mes: string) { return financeiroResposta(await fetch(`${API_URL}/financeiro?mes=${mes}`, { cache: "no-store" })) as Promise<LancamentoFinanceiro[]>; }
export async function getResumoFinanceiro(mes: string) { return financeiroResposta(await fetch(`${API_URL}/financeiro/resumo?mes=${mes}`, { cache: "no-store" })) as Promise<ResumoFinanceiro>; }
export async function criarLancamento(dados: { tipo: "receita" | "despesa"; descricao: string; categoria: string; valor_centavos: number; vencimento: string; observacao?: string }) { return financeiroResposta(await fetch(`${API_URL}/financeiro`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) })); }
export async function marcarLancamento(id: string, status: "pendente" | "pago") { return financeiroResposta(await fetch(`${API_URL}/financeiro/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })); }
export async function excluirLancamento(id: string) { return financeiroResposta(await fetch(`${API_URL}/financeiro/${id}`, { method: "DELETE" })); }

export type Cliente = { id: string; criado_em: string; nome: string; contato?: string | null; email?: string | null; whatsapp_cobranca_ativo: boolean; dados?: Record<string, string> };
export async function getClientes(busca = "") { const res = await fetch(`${API_URL}/clientes?busca=${encodeURIComponent(busca)}`, { cache: "no-store" }); return financeiroResposta(res) as Promise<Cliente[]>; }
export async function criarCliente(dados: { nome: string; contato?: string; email?: string; whatsapp_cobranca_ativo?: boolean; dados?: Record<string, string> }) { const token = sessionStorage.getItem("medicao-terreno:token"); return financeiroResposta(await fetch(`${API_URL}/clientes`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify(dados) })); }
export async function atualizarWhatsappCobrancaCliente(id: string, ativo: boolean) { return financeiroResposta(await fetch(`${API_URL}/clientes/${id}/whatsapp-cobranca`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ whatsapp_cobranca_ativo: ativo }) })); }
export async function excluirCliente(id: string) { return financeiroResposta(await fetch(`${API_URL}/clientes/${id}`, { method: "DELETE" })); }

export type RecursoEng = {
  id: string; criado_em: string; tipo: string; nome: string; tem_foto: boolean;
  dados: Record<string, string>;
};
function authHeaders() { const token = sessionStorage.getItem("medicao-terreno:token"); return { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }; }
export async function getRecursosEng(tipo: string, busca = "") { return financeiroResposta(await fetch(`${API_URL}/eng/recursos/${tipo}?busca=${encodeURIComponent(busca)}`, { headers: authHeaders(), cache: "no-store" })) as Promise<RecursoEng[]>; }
export async function criarRecursoEng(tipo: string, dados: { nome: string; dados: Record<string, string> }) { return financeiroResposta(await fetch(`${API_URL}/eng/recursos/${tipo}`, { method: "POST", headers: authHeaders(), body: JSON.stringify(dados) })) as Promise<RecursoEng>; }
export async function enviarFotoRecursoEng(tipo: string, id: string, foto: File) { const form = new FormData(); form.append("foto", foto); return financeiroResposta(await fetch(`${API_URL}/eng/recursos/${tipo}/${id}/foto`, { method: "POST", body: form })); }
export async function excluirRecursoEng(tipo: string, id: string) { return financeiroResposta(await fetch(`${API_URL}/eng/recursos/${tipo}/${id}`, { method: "DELETE" })); }
export function recursoEngFotoUrl(tipo: string, id: string) { return `${API_URL}/eng/recursos/${tipo}/${id}/foto`; }

// ---- monitoramento de produtividade por voo de drone --------------------
export type Frente = { id: string; obra_id: string; nome: string; geojson: GeoLineString | null; extensao_prevista_m: number };
export type GeoLineString = { type: "LineString"; coordinates: [number, number][] };
export type Voo = {
  id: string; criado_em: string; obra_id: string; data: string; turno: string; observacao?: string | null;
  operador_id?: string | null; operador_nome?: string | null; operador_drone?: string | null;
  criado_por?: string | null;
  total_fotos: number; total_deteccoes: number; fotos_com_gps: number;
  fotos?: VooFoto[]; deteccoes?: Deteccao[];
  pessoas_por_cor?: Record<string, number>; pessoas_total_estimado?: number;
};
export type VooFoto = { id: string; nome_arquivo: string; mime?: string | null; gps_lat: number | null; gps_lon: number | null; altitude_m: number | null; tirada_em: string | null; tem_qr: number; contar_pessoas?: number; pessoas?: Record<string, number> | null };
export type Deteccao = { id: string; voo_id: string; foto_id: string | null; maquina_id: string; frente_id: string | null; lat: number | null; lon: number | null; progressiva_m: number | null; metodo: string; status_maquina: string | null; foto_tirada_em?: string | null };
export type Comparacao = {
  voo_a: Voo; voo_b: Voo;
  maquinas: {
    maquina_id: string; maquina_nome: string;
    pos_a: { lat: number | null; lon: number | null; progressiva_m: number | null } | null;
    pos_b: { lat: number | null; lon: number | null; progressiva_m: number | null } | null;
    avanco_m: number | null; parada: boolean; horas: number; custo: number; custo_por_metro: number | null;
  }[];
  avanco_total_m: number; custo_total: number; custo_por_metro: number | null;
};

export async function getFrentes(obraId: string) { return financeiroResposta(await fetch(`${API_URL}/eng/frentes?obra_id=${obraId}`, { headers: authHeaders(), cache: "no-store" })) as Promise<Frente[]>; }
export async function criarFrente(d: { obra_id: string; nome: string; geojson?: GeoLineString | null; extensao_prevista_m?: number }) { return financeiroResposta(await fetch(`${API_URL}/eng/frentes`, { method: "POST", headers: authHeaders(), body: JSON.stringify(d) })) as Promise<Frente>; }
export async function atualizarFrente(id: string, d: { obra_id: string; nome: string; geojson?: GeoLineString | null; extensao_prevista_m?: number }) { return financeiroResposta(await fetch(`${API_URL}/eng/frentes/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(d) })); }
export async function excluirFrente(id: string) { return financeiroResposta(await fetch(`${API_URL}/eng/frentes/${id}`, { method: "DELETE" })); }

export async function getVoos(obraId?: string) { const q = obraId ? `?obra_id=${obraId}` : ""; return financeiroResposta(await fetch(`${API_URL}/eng/voos${q}`, { headers: authHeaders(), cache: "no-store" })) as Promise<Voo[]>; }
export async function getVoo(id: string) { return financeiroResposta(await fetch(`${API_URL}/eng/voos/${id}`, { headers: authHeaders(), cache: "no-store" })) as Promise<Voo>; }
export async function criarVoo(d: { obra_id: string; data: string; turno: string; observacao?: string; operador_id?: string }) { return financeiroResposta(await fetch(`${API_URL}/eng/voos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(d) })) as Promise<Voo>; }

export type EngDashboard = {
  obras_total: number; obras_em_andamento: number; maquinas_total: number;
  trabalhadores_total: number; operadores_total: number; voos_total: number; voos_mes: number;
  avanco_total_m: number;
  dias: { obra: string; data: string; avanco_m: number; paradas: number; maquinas: number }[];
  por_obra: { obra: string; metros: number }[];
  calendario: Record<string, { obra: string; turnos: string[]; operadores: string[] }[]>;
};
export async function getEngDashboard() { return financeiroResposta(await fetch(`${API_URL}/eng/dashboard`, { headers: authHeaders(), cache: "no-store" })) as Promise<EngDashboard>; }
export async function excluirVoo(id: string) { return financeiroResposta(await fetch(`${API_URL}/eng/voos/${id}`, { method: "DELETE" })); }
export async function enviarFotosVoo(id: string, fotos: File[]) { const form = new FormData(); fotos.forEach((f) => form.append("fotos", f)); const token = sessionStorage.getItem("medicao-terreno:token"); return financeiroResposta(await fetch(`${API_URL}/eng/voos/${id}/fotos`, { method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` }, body: form })) as Promise<{ ok: boolean; adicionadas: number; qrs_lidos: number; leitor_ativo: boolean }>; }
export function fotoVooUrl(vooId: string, fotoId: string) { return `${API_URL}/eng/voos/${vooId}/fotos/${fotoId}/imagem`; }
export async function marcarFotoContagem(vooId: string, fotoId: string, incluir: boolean) { return financeiroResposta(await fetch(`${API_URL}/eng/voos/${vooId}/fotos/${fotoId}/contagem`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ incluir }) })); }
export async function criarDeteccao(vooId: string, d: { maquina_id: string; foto_id?: string; frente_id?: string; lat?: number; lon?: number; status_maquina?: string }) { return financeiroResposta(await fetch(`${API_URL}/eng/voos/${vooId}/deteccoes`, { method: "POST", headers: authHeaders(), body: JSON.stringify(d) })) as Promise<Deteccao>; }
export async function atualizarDeteccao(id: string, d: { maquina_id: string; frente_id?: string; lat?: number; lon?: number; status_maquina?: string }) { return financeiroResposta(await fetch(`${API_URL}/eng/deteccoes/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(d) })); }
export async function excluirDeteccao(id: string) { return financeiroResposta(await fetch(`${API_URL}/eng/deteccoes/${id}`, { method: "DELETE" })); }
export async function compararVoos(obraId: string, vooA: string, vooB: string) { return financeiroResposta(await fetch(`${API_URL}/eng/obras/${obraId}/comparar?voo_a=${vooA}&voo_b=${vooB}`, { headers: authHeaders(), cache: "no-store" })) as Promise<Comparacao>; }
export type Consumo = { maquina_id: string; horas: number; custo_hora_centavos: number; data: string; turno: string };
export async function getConsumo(obraId: string, data?: string, turno?: string) { const q = new URLSearchParams({ obra_id: obraId }); if (data) q.set("data", data); if (turno) q.set("turno", turno); return financeiroResposta(await fetch(`${API_URL}/eng/consumo?${q}`, { headers: authHeaders(), cache: "no-store" })) as Promise<Consumo[]>; }
export async function salvarConsumo(d: { obra_id: string; data: string; turno: string; maquina_id: string; horas: number; custo_hora_centavos: number }) { return financeiroResposta(await fetch(`${API_URL}/eng/consumo`, { method: "POST", headers: authHeaders(), body: JSON.stringify(d) })); }

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

// ---- chamados (falar com o dono do sistema) ------------------------------
export type Chamado = {
  id: string; criado_em: string; empresa_id: string; usuario_nome: string | null;
  usuario_email: string | null; assunto: string | null; mensagem: string;
  status: "aberto" | "respondido" | "fechado"; resposta: string | null; respondido_em: string | null;
};
export async function getChamados() { return financeiroResposta(await fetch(`${API_URL}/chamados`, { headers: authHeaders(), cache: "no-store" })) as Promise<Chamado[]>; }
export async function abrirChamado(dados: { assunto?: string; mensagem: string }) { return financeiroResposta(await fetch(`${API_URL}/chamados`, { method: "POST", headers: authHeaders(), body: JSON.stringify(dados) })) as Promise<Chamado>; }
