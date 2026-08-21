export interface JobResumo {
  id: string;
  criado_em: string;
  atualizado_em: string;
  status: "processando" | "pronto" | "erro";
  descricao: string | null;
  erro: string | null;
}

export interface ProjetoStatus {
  job_id: string;
  status: "processando" | "pronto" | "erro";
  erro: string | null;
  duracao_total_s: number;
  pode_estender: boolean;
}

export interface EtapaStatus {
  etapa: string;
  rotulo: string;
  job_id: string;
  status: "processando" | "pronto" | "erro";
  erro: string | null;
  duracao_total_s: number;
  pode_estender: boolean;
}

export interface EvolucaoStatus {
  grupo_id: string;
  etapas: EtapaStatus[];
}
