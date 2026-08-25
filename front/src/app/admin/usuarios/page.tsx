import { UsersRound } from "lucide-react";
import { AdminSection } from "@/components/admin/admin-section";

export default function UsuariosAdmin() {
  return <AdminSection eyebrow="Administração Master" title="Usuários e acessos" description="Controle os acessos administrativos e os logins de cada imobiliária." icon={UsersRound} items={[
    { title: "Administradores master", description: "Contas com acesso total à gestão da plataforma.", status: "Em breve" },
    { title: "Acessos de imobiliárias", description: "Um login por imobiliária, vinculado à sua empresa e ao respectivo plano.", status: "Em breve" },
    { title: "Segurança", description: "Troca de senha, bloqueio de conta e registro das últimas atividades.", status: "Planejado" },
  ]} />;
}
