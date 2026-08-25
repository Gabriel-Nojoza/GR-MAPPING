import { API_URL } from "@/lib/api";

export type Empresa = {
  id: string;
  criado_em: string;
  nome: string;
  cnpj?: string | null;
  plano: "teste" | "basico" | "profissional" | "premium";
  status: "ativo" | "suspenso";
  total_usuarios: number;
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
}): Promise<Empresa> {
  return respostaAdmin(await fetch(`${API_URL}/admin/empresas`, {
    method: "POST",
    headers: cabecalhos(),
    body: JSON.stringify(dados),
  }));
}
