import { API_URL } from "@/lib/api";

export type RamoEmpresa = "imobiliaria" | "engenharia";

export type Empresa = {
  id: string;
  criado_em: string;
  nome: string;
  cnpj?: string | null;
  plano: "teste" | "basico" | "profissional" | "premium";
  status: "ativo" | "suspenso";
  ramo: RamoEmpresa;
  total_usuarios: number;
};

export type UsuarioAdmin = {
  id: string;
  criado_em: string;
  nome?: string | null;
  email: string;
  ativo: boolean;
  perfil: "superadmin" | "imobiliaria";
  empresa_id?: string | null;
  empresa_nome?: string | null;
  empresa_ramo?: RamoEmpresa | null;
};

function cabecalhos() {
  const token = sessionStorage.getItem("medicao-terreno:token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token ?? ""}`,
  };
}

async function respostaAdmin(resposta: Response) {
  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => null);
    throw new Error(erro?.detail ?? "Não foi possível concluir a ação.");
  }
  return resposta.json();
}

export async function listarEmpresas(): Promise<Empresa[]> {
  return respostaAdmin(await fetch(`${API_URL}/admin/empresas`, {
    headers: cabecalhos(),
    cache: "no-store",
  }));
}

export async function criarEmpresa(dados: {
  nome: string;
  cnpj?: string;
  plano: Empresa["plano"];
  ramo: RamoEmpresa;
  responsavel_nome?: string;
  responsavel_email?: string;
  responsavel_senha?: string;
}): Promise<Empresa> {
  return respostaAdmin(await fetch(`${API_URL}/admin/empresas`, {
    method: "POST",
    headers: cabecalhos(),
    body: JSON.stringify(dados),
  }));
}

export async function listarUsuarios(): Promise<UsuarioAdmin[]> {
  return respostaAdmin(await fetch(`${API_URL}/admin/usuarios`, {
    headers: cabecalhos(),
    cache: "no-store",
  }));
}

export async function criarUsuarioEmpresa(dados: { nome: string; email: string; senha: string; empresa_id: string; modelo_drone?: string }): Promise<UsuarioAdmin> {
  return respostaAdmin(await fetch(`${API_URL}/admin/usuarios`, {
    method: "POST",
    headers: cabecalhos(),
    body: JSON.stringify(dados),
  }));
}

export async function atualizarUsuarioEmpresa(id: string, dados: { nome: string; email: string; empresa_id: string; senha?: string; modelo_drone?: string }): Promise<UsuarioAdmin> {
  return respostaAdmin(await fetch(`${API_URL}/admin/usuarios/${id}`, {
    method: "PATCH",
    headers: cabecalhos(),
    body: JSON.stringify(dados),
  }));
}

export async function excluirUsuarioEmpresa(id: string): Promise<void> {
  await respostaAdmin(await fetch(`${API_URL}/admin/usuarios/${id}`, {
    method: "DELETE",
    headers: cabecalhos(),
  }));
}

export type LeadEncontrado = { place_id?: string; nome: string; endereco?: string | null; telefone?: string | null; tipo?: string | null; situacao?: string | null; google_maps_url?: string | null; };
export async function pesquisarLeads(dados: { cidade: string; segmento: string; limite?: number }): Promise<LeadEncontrado[]> {
  return respostaAdmin(await fetch(`${API_URL}/admin/leads/pesquisar`, { method: "POST", headers: cabecalhos(), body: JSON.stringify(dados) }));
}

export type ModeloMensagemLead = { id: string; criado_em: string; titulo: string; conteudo: string; };
export async function listarModelosMensagemLead(): Promise<ModeloMensagemLead[]> { return respostaAdmin(await fetch(`${API_URL}/admin/leads/modelos`, { headers: cabecalhos(), cache: "no-store" })); }
export async function criarModeloMensagemLead(dados: { titulo: string; conteudo: string }): Promise<ModeloMensagemLead> { return respostaAdmin(await fetch(`${API_URL}/admin/leads/modelos`, { method: "POST", headers: cabecalhos(), body: JSON.stringify(dados) })); }
export async function excluirModeloMensagemLead(id: string): Promise<void> { await respostaAdmin(await fetch(`${API_URL}/admin/leads/modelos/${id}`, { method: "DELETE", headers: cabecalhos() })); }
