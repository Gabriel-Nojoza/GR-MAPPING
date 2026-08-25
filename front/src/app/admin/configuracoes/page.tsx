import { Settings } from "lucide-react";
import { AdminSection } from "@/components/admin/admin-section";

export default function ConfiguracoesAdmin() {
  return <AdminSection eyebrow="Administração Master" title="Configurações da plataforma" description="Central de configurações globais do GR Mapping." icon={Settings} items={[
    { title: "Identidade da plataforma", description: "Nome, logo e informações de contato exibidas para as imobiliárias.", status: "Planejado" },
    { title: "Integrações", description: "Acompanhe o status das integrações de IA, banco de dados e WhatsApp.", status: "Planejado" },
    { title: "Políticas e segurança", description: "Defina regras de acesso e preparação para auditoria de operações.", status: "Planejado" },
  ]} />;
}
