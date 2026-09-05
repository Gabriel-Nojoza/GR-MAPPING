import type { RecursoEng } from "@/lib/api";

/**
 * Catálogo dos módulos do ramo engenharia.
 *
 * Cada módulo (obra, equipamento, material, medição, monitoramento) descreve
 * aqui os campos do formulário, as colunas da tabela e os indicadores do topo.
 * A UII é montada genericamente pelo <RecursoCrud>. Para um módulo novo, basta
 * acrescentar uma entrada — nenhuma migração de banco é necessária.
 */

export type CampoTipo = "texto" | "numero" | "moeda" | "textarea" | "data" | "select" | "obra";

export type CampoEng = {
  key: string;
  label: string;
  tipo: CampoTipo;
  opcoes?: string[];
  placeholder?: string;
  col?: 1 | 2 | 3;
};

export type Ctx = { obraNome: (id: string) => string };

export type ColunaEng = {
  label: string;
  tipo?: "texto" | "moeda" | "badge" | "progresso";
  valor: (r: RecursoEng, ctx: Ctx) => string;
};

export type ResumoEng = {
  label: string;
  cor?: "primary" | "emerald" | "amber";
  valor: (rs: RecursoEng[], ctx: Ctx) => string;
};

export type ModuloEng = {
  tipo: string;
  titulo: string;
  descricao: string;
  nomeLabel: string;
  nomePlaceholder: string;
  imagemDestaque?: boolean;
  etiquetaQr?: boolean;
  campos: CampoEng[];
  colunas: ColunaEng[];
  resumo: ResumoEng[];
};

// ---- helpers -------------------------------------------------------------
const n = (r: RecursoEng, k: string) => Number(r.dados[k] ?? 0) || 0;
const t = (r: RecursoEng, k: string) => r.dados[k] || "—";
export const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const soma = (rs: RecursoEng[], f: (r: RecursoEng) => number) => rs.reduce((s, r) => s + f(r), 0);
const dataBr = (r: RecursoEng, k: string) => {
  const v = r.dados[k];
  return v ? new Date(v + "T00:00:00").toLocaleDateString("pt-BR") : "—";
};

const CAMPO_OBSERVACOES: CampoEng = { key: "observacoes", label: "Observações", tipo: "textarea", col: 3 };

// ---- catálogo -----------------------------------------------------------
export const MODULOS: Record<string, ModuloEng> = {
  obra: {
    tipo: "obra",
    titulo: "Obras",
    descricao: "Cadastro e acompanhamento das obras da empresa.",
    nomeLabel: "Nome da obra",
    nomePlaceholder: "Ex: Adutora Setor Norte",
    campos: [
      { key: "cliente", label: "Cliente", tipo: "texto", col: 1 },
      { key: "localizacao", label: "Localização / cidade", tipo: "texto", col: 2 },
      { key: "status", label: "Status", tipo: "select", col: 1, opcoes: ["Planejamento", "Em andamento", "Paralisada", "Concluída"] },
      { key: "data_inicio", label: "Início", tipo: "data", col: 1 },
      { key: "previsao_termino", label: "Previsão de término", tipo: "data", col: 1 },
      { key: "valor_contrato", label: "Valor do contrato (R$)", tipo: "moeda", col: 1 },
      { key: "preco_medicao", label: "Preço de medição (R$/m)", tipo: "moeda", col: 1 },
      { key: "contrato", label: "Contrato", tipo: "select", col: 1, opcoes: ["Sem contrato", "A gerar ao fechar", "Gerado"] },
      CAMPO_OBSERVACOES,
    ],
    colunas: [
      { label: "Cliente", valor: (r) => t(r, "cliente") },
      { label: "Localização", valor: (r) => t(r, "localizacao") },
      { label: "Status", tipo: "badge", valor: (r) => t(r, "status") },
      { label: "Início", valor: (r) => dataBr(r, "data_inicio") },
      { label: "Previsão", valor: (r) => dataBr(r, "previsao_termino") },
      { label: "Valor", tipo: "moeda", valor: (r) => brl(n(r, "valor_contrato")) },
      { label: "R$/m", tipo: "moeda", valor: (r) => (n(r, "preco_medicao") ? brl(n(r, "preco_medicao")) : "—") },
      { label: "Contrato", tipo: "badge", valor: (r) => t(r, "contrato") },
    ],
    resumo: [
      { label: "obra(s)", valor: (rs) => String(rs.length) },
      { label: "em andamento", valor: (rs) => String(rs.filter((r) => r.dados.status === "Em andamento").length) },
      { label: "em contrato", cor: "emerald", valor: (rs) => brl(soma(rs, (r) => n(r, "valor_contrato"))) },
    ],
  },

  equipamento: {
    tipo: "equipamento",
    titulo: "Máquinas",
    descricao: "Máquinas da obra — cada uma com uma etiqueta QR pro drone identificar.",
    nomeLabel: "Máquina",
    nomePlaceholder: "Ex: Escavadeira CAT 320",
    etiquetaQr: true,
    campos: [
      { key: "tipo_equip", label: "Tipo", tipo: "select", col: 1, opcoes: ["Escavadeira", "Retroescavadeira", "Motoniveladora", "Rolo compactador", "Caminhão", "Trator", "Betoneira", "Outro"] },
      { key: "obra", label: "Obra", tipo: "obra", col: 1 },
      { key: "status", label: "Status", tipo: "select", col: 1, opcoes: ["Em campo", "Disponível", "Manutenção"] },
      { key: "quantidade", label: "Quantidade", tipo: "numero", col: 1 },
      { key: "custo_mensal", label: "Custo mensal (R$)", tipo: "moeda", col: 1, placeholder: "Valor pago por mês por essa máquina (aluguel/diesel/operador)" },
    ],
    colunas: [
      { label: "Tipo", valor: (r) => t(r, "tipo_equip") },
      { label: "Obra", valor: (r, c) => c.obraNome(r.dados.obra) },
      { label: "Qtd", valor: (r) => String(n(r, "quantidade") || "—") },
      { label: "Custo/mês", tipo: "moeda", valor: (r) => brl(n(r, "custo_mensal")) },
      { label: "Status", tipo: "badge", valor: (r) => t(r, "status") },
    ],
    resumo: [
      { label: "equipamento(s)", valor: (rs) => String(rs.length) },
      { label: "custo mensal total", cor: "emerald", valor: (rs) => brl(soma(rs, (r) => n(r, "custo_mensal"))) },
    ],
  },

  material: {
    tipo: "material",
    titulo: "Materiais",
    descricao: "Controle de materiais previstos e consumidos na obra.",
    nomeLabel: "Material",
    nomePlaceholder: "Ex: Tubo PVC DEFOFO 100mm",
    campos: [
      { key: "categoria", label: "Categoria", tipo: "select", col: 1, opcoes: ["Tubulação", "Conexão", "Outro"] },
      { key: "obra", label: "Obra", tipo: "obra", col: 1 },
      { key: "unidade", label: "Unidade", tipo: "texto", col: 1, placeholder: "m, un, kg..." },
      { key: "quantidade_prevista", label: "Quantidade prevista", tipo: "numero", col: 1 },
      { key: "quantidade_consumida", label: "Quantidade consumida", tipo: "numero", col: 1 },
      { key: "custo_unitario", label: "Custo unitário (R$)", tipo: "moeda", col: 1 },
    ],
    colunas: [
      { label: "Categoria", valor: (r) => t(r, "categoria") },
      { label: "Obra", valor: (r, c) => c.obraNome(r.dados.obra) },
      { label: "Previsto × Consumido", tipo: "progresso", valor: (r) => `${n(r, "quantidade_consumida")}|${n(r, "quantidade_prevista")}|${r.dados.unidade || ""}` },
      { label: "Custo unit.", tipo: "moeda", valor: (r) => brl(n(r, "custo_unitario")) },
      { label: "Custo consumido", tipo: "moeda", valor: (r) => brl(n(r, "quantidade_consumida") * n(r, "custo_unitario")) },
    ],
    resumo: [
      { label: "item(ns)", valor: (rs) => String(rs.length) },
      { label: "custo consumido", cor: "emerald", valor: (rs) => brl(soma(rs, (r) => n(r, "quantidade_consumida") * n(r, "custo_unitario"))) },
    ],
  },

  medicao: {
    tipo: "medicao",
    titulo: "Medições",
    descricao: "Apontamento de campo por voo / trecho: metros executados, equipe e máquinas.",
    nomeLabel: "Identificação do apontamento",
    nomePlaceholder: "Ex: Voo 12/08 tarde — Trecho EST 0+500",
    campos: [
      { key: "obra", label: "Obra", tipo: "obra", col: 1 },
      { key: "trecho", label: "Trecho / estaca", tipo: "texto", col: 1 },
      { key: "data", label: "Data", tipo: "data", col: 1 },
      { key: "turno", label: "Turno", tipo: "select", col: 1, opcoes: ["Manhã", "Tarde", "Dia inteiro"] },
      { key: "colaboradores", label: "Colaboradores em campo", tipo: "numero", col: 1 },
      { key: "maquinas_campo", label: "Máquinas em campo", tipo: "numero", col: 1 },
      { key: "quantidade", label: "Metros executados (m)", tipo: "numero", col: 1 },
      { key: "responsavel", label: "Responsável", tipo: "texto", col: 1 },
      CAMPO_OBSERVACOES,
    ],
    colunas: [
      { label: "Obra", valor: (r, c) => c.obraNome(r.dados.obra) },
      { label: "Trecho", valor: (r) => t(r, "trecho") },
      { label: "Data", valor: (r) => dataBr(r, "data") },
      { label: "Turno", tipo: "badge", valor: (r) => t(r, "turno") },
      { label: "Equipe", valor: (r) => String(n(r, "colaboradores") || "—") },
      { label: "Máquinas", valor: (r) => String(n(r, "maquinas_campo") || "—") },
      { label: "Executado", tipo: "moeda", valor: (r) => `${n(r, "quantidade")} m` },
    ],
    resumo: [
      { label: "apontamento(s)", valor: (rs) => String(rs.length) },
      { label: "m executados", cor: "primary", valor: (rs) => String(soma(rs, (r) => n(r, "quantidade"))) },
      { label: "média de equipe", cor: "amber", valor: (rs) => (rs.length ? String(Math.round(soma(rs, (r) => n(r, "colaboradores")) / rs.length)) : "0") },
    ],
  },

  operador: {
    tipo: "operador",
    titulo: "Operadores",
    descricao: "Quem pilota os drones. Cada voo é vinculado a um operador.",
    nomeLabel: "Nome do operador",
    nomePlaceholder: "Ex: Ruan Gusmão",
    campos: [
      { key: "modelo_drone", label: "Modelo do drone", tipo: "texto", col: 1, placeholder: "Ex: DJI Mini 3" },
      { key: "email", label: "E-mail de acesso", tipo: "texto", col: 1, placeholder: "o mesmo do login" },
      { key: "telefone", label: "Telefone", tipo: "texto", col: 1 },
      { key: "registro_anac", label: "Registro ANAC (SISANT)", tipo: "texto", col: 1 },
    ],
    colunas: [
      { label: "Drone", valor: (r) => t(r, "modelo_drone") },
      { label: "E-mail", valor: (r) => t(r, "email") },
      { label: "Telefone", valor: (r) => t(r, "telefone") },
    ],
    resumo: [
      { label: "operador(es)", valor: (rs) => String(rs.length) },
    ],
  },

  trabalhador: {
    tipo: "trabalhador",
    titulo: "Trabalhadores",
    descricao: "Equipe de campo — identificada pela cor do capacete quando o drone passa.",
    nomeLabel: "Nome do trabalhador",
    nomePlaceholder: "Ex: José da Silva",
    campos: [
      { key: "funcao", label: "Função", tipo: "select", col: 1, opcoes: ["Engenheiro", "Encarregado", "Operador", "Ajudante", "Topógrafo", "Motorista", "Outro"] },
      { key: "cor_capacete", label: "Cor do capacete", tipo: "select", col: 1, opcoes: ["Branco", "Azul", "Amarelo", "Verde", "Vermelho", "Laranja"] },
      { key: "obra", label: "Obra", tipo: "obra", col: 1 },
      { key: "telefone", label: "Telefone", tipo: "texto", col: 1 },
    ],
    colunas: [
      { label: "Função", tipo: "badge", valor: (r) => t(r, "funcao") },
      { label: "Capacete", tipo: "badge", valor: (r) => t(r, "cor_capacete") },
      { label: "Obra", valor: (r, c) => c.obraNome(r.dados.obra) },
      { label: "Telefone", valor: (r) => t(r, "telefone") },
    ],
    resumo: [
      { label: "trabalhador(es)", valor: (rs) => String(rs.length) },
      { label: "operadores", cor: "amber", valor: (rs) => String(rs.filter((r) => r.dados.funcao === "Operador").length) },
    ],
  },

  custo: {
    tipo: "custo",
    titulo: "Custos",
    descricao: "Lançamentos de custo e análise por obra e por trecho.",
    nomeLabel: "Descrição do custo",
    nomePlaceholder: "Ex: Equipe de assentamento — semana 12",
    campos: [
      { key: "categoria", label: "Categoria", tipo: "select", col: 1, opcoes: ["Mão de obra", "Serviços terceirizados", "Combustível", "Locação", "Outros"] },
      { key: "obra", label: "Obra", tipo: "obra", col: 1 },
      { key: "trecho", label: "Trecho / estaca", tipo: "texto", col: 1 },
      { key: "data", label: "Data", tipo: "data", col: 1 },
      { key: "valor", label: "Valor (R$)", tipo: "moeda", col: 1 },
    ],
    colunas: [
      { label: "Categoria", tipo: "badge", valor: (r) => t(r, "categoria") },
      { label: "Obra", valor: (r, c) => c.obraNome(r.dados.obra) },
      { label: "Trecho", valor: (r) => t(r, "trecho") },
      { label: "Data", valor: (r) => dataBr(r, "data") },
      { label: "Valor", tipo: "moeda", valor: (r) => brl(n(r, "valor")) },
    ],
    resumo: [
      { label: "lançamento(s)", valor: (rs) => String(rs.length) },
      { label: "lançado", cor: "emerald", valor: (rs) => brl(soma(rs, (r) => n(r, "valor"))) },
    ],
  },

  monitoramento: {
    tipo: "monitoramento",
    titulo: "Monitoramento",
    descricao: "Acompanhamento aéreo da obra: voos, imagens e mapeamento.",
    nomeLabel: "Título do registro",
    nomePlaceholder: "Ex: Voo semanal — Trecho 3",
    imagemDestaque: true,
    campos: [
      { key: "obra", label: "Obra", tipo: "obra", col: 1 },
      { key: "data", label: "Data", tipo: "data", col: 1 },
      { key: "tipo_registro", label: "Tipo", tipo: "select", col: 1, opcoes: ["Voo", "Mapeamento", "Inspeção", "Ortomosaico"] },
      { key: "area_ha", label: "Área coberta (ha)", tipo: "numero", col: 1 },
      CAMPO_OBSERVACOES,
    ],
    colunas: [
      { label: "Obra", valor: (r, c) => c.obraNome(r.dados.obra) },
      { label: "Data", valor: (r) => dataBr(r, "data") },
      { label: "Tipo", tipo: "badge", valor: (r) => t(r, "tipo_registro") },
      { label: "Área (ha)", valor: (r) => String(n(r, "area_ha") || "—") },
    ],
    resumo: [
      { label: "registro(s)", valor: (rs) => String(rs.length) },
      { label: "área coberta", cor: "amber", valor: (rs) => `${soma(rs, (r) => n(r, "area_ha"))} ha` },
    ],
  },
};

export const BADGE_CORES: Record<string, string> = {
  "Em andamento": "bg-emerald-50 text-emerald-700",
  "Em campo": "bg-emerald-50 text-emerald-700",
  Concluída: "bg-slate-100 text-slate-600",
  Disponível: "bg-slate-100 text-slate-600",
  Planejamento: "bg-indigo-50 text-indigo-700",
  Paralisada: "bg-red-50 text-red-700",
  Manutenção: "bg-amber-50 text-amber-700",
  "A gerar ao fechar": "bg-amber-50 text-amber-700",
  Gerado: "bg-emerald-50 text-emerald-700",
  "Sem contrato": "bg-slate-100 text-slate-500",
  "Mão de obra": "bg-indigo-50 text-indigo-700",
  "Serviços terceirizados": "bg-sky-50 text-sky-700",
  Combustível: "bg-amber-50 text-amber-700",
  Locação: "bg-violet-50 text-violet-700",
  Outros: "bg-slate-100 text-slate-600",
  Branco: "bg-slate-100 text-slate-700 ring-1 ring-slate-300",
  Azul: "bg-blue-100 text-blue-700",
  Amarelo: "bg-yellow-100 text-yellow-800",
  Verde: "bg-emerald-100 text-emerald-700",
  Vermelho: "bg-red-100 text-red-700",
  Laranja: "bg-orange-100 text-orange-700",
  Engenheiro: "bg-indigo-50 text-indigo-700",
  Encarregado: "bg-sky-50 text-sky-700",
  Operador: "bg-amber-50 text-amber-700",
};

// ---- agregações (usadas em Custos e no Dashboard) ----------------------
// dias úteis considerados num mês, pra ratear o custo mensal por dia/turno
export const DIAS_UTEIS_MES = 26;
export const custoEquipamento = (r: RecursoEng) => n(r, "custo_mensal");
export const custoDiarioEquipamento = (r: RecursoEng) => n(r, "custo_mensal") / DIAS_UTEIS_MES;
export const custoMaterial = (r: RecursoEng) => n(r, "quantidade_consumida") * n(r, "custo_unitario");
export const valorNum = n;
export const metrosMedicao = (r: RecursoEng) => n(r, "quantidade");
export const precoMedicaoObra = (r: RecursoEng) => n(r, "preco_medicao");
