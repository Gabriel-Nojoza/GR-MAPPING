import { EmConstrucao } from "@/components/eng/em-construcao";

export default function ConfiguracoesEngPage() {
  return (
    <EmConstrucao
      titulo="Configurações"
      descricao="Preferências da empresa no ramo de engenharia."
      itens={["Dados da empresa", "Usuários da equipe", "Integrações", "Padrões de obra"]}
    />
  );
}
