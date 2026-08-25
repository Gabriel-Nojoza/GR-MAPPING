import { CreditCard } from "lucide-react";
import { AdminSection } from "@/components/admin/admin-section";

export default function PlanosAdmin() {
  return <AdminSection eyebrow="Administração Master" title="Planos da plataforma" description="Defina a oferta comercial e acompanhe quais planos estão atribuídos às imobiliárias." icon={CreditCard} items={[
    { title: "Teste", description: "Plano inicial para demonstrações e validação da plataforma.", status: "Disponível" },
    { title: "Profissional", description: "Plano para imobiliárias em operação, com medições e gestão de locações.", status: "Disponível" },
    { title: "Assinaturas", description: "Cobrança recorrente e limites por plano serão configurados nesta área.", status: "Planejado" },
  ]} />;
}
