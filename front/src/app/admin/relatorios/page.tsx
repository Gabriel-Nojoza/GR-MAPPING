import { BarChart3 } from "lucide-react";
import { AdminSection } from "@/components/admin/admin-section";

export default function RelatoriosAdmin() {
  return <AdminSection eyebrow="Administração Master" title="Relatórios" description="Acompanhe o crescimento da plataforma e a utilização por imobiliária." icon={BarChart3} items={[
    { title: "Uso da plataforma", description: "Medições, imóveis e documentos gerados por período.", status: "Planejado" },
    { title: "Atividade por imobiliária", description: "Indicadores individuais para entender quais contas estão ativas.", status: "Planejado" },
    { title: "Exportação", description: "Relatórios consolidados em CSV e PDF para acompanhamento comercial.", status: "Planejado" },
  ]} />;
}
