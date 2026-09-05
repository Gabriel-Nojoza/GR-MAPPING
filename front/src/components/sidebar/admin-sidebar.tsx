"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Building2, CreditCard, FileSignature, LayoutDashboard, LifeBuoy, LogOut, Search, Settings, ShieldCheck, UsersRound } from "lucide-react";
import { SidebarContainer, SidebarFooter, SidebarHeader, SidebarItem, SidebarNav } from "./sidebar.styled";

const ITENS_ADMIN = [
  { href: "/admin", icon: LayoutDashboard, label: "Visão geral" },
  { href: "/admin/empresas", icon: Building2, label: "Empresas" },
  { href: "/admin/leads", icon: Search, label: "Leads" },
  { href: "/admin/usuarios", icon: UsersRound, label: "Usuários e acessos" },
  { href: "/admin/contratos", icon: FileSignature, label: "Contratos" },
  { href: "/admin/chamados", icon: LifeBuoy, label: "Chamados" },
  { href: "/admin/planos", icon: CreditCard, label: "Planos" },
  { href: "/admin/relatorios", icon: BarChart3, label: "Relatórios" },
  { href: "/admin/configuracoes", icon: Settings, label: "Configurações" },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function sair() {
    sessionStorage.removeItem("medicao-terreno:acesso");
    sessionStorage.removeItem("medicao-terreno:token");
    sessionStorage.removeItem("medicao-terreno:usuario");
    router.replace("/login");
  }

  return <SidebarContainer>
    <SidebarHeader><div className="sidebar-logo-wrap"><Image src="/logo.png" alt="GR Mapping" width={128} height={128} priority className="sidebar-logo h-auto w-32 object-contain" /></div></SidebarHeader>
    <div className="border-b border-white/10 px-5 py-4"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-300"><ShieldCheck size={15} /> Administração Master</p><p className="mt-1 text-xs text-white/50">Gestão da plataforma</p></div>
    <SidebarNav>
      <p className="px-5 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Gestão</p>
      {ITENS_ADMIN.slice(0, 6).map((item) => <SidebarItem key={item.href} href={item.href} icon={<item.icon size={18} strokeWidth={2} />} label={item.label} active={pathname === item.href} />)}
      <p className="px-5 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Plataforma</p>
      {ITENS_ADMIN.slice(6).map((item) => <SidebarItem key={item.href} href={item.href} icon={<item.icon size={18} strokeWidth={2} />} label={item.label} active={pathname === item.href} />)}
    </SidebarNav>
    <SidebarFooter><button type="button" onClick={sair} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-red-500/10 hover:text-red-300"><LogOut size={18} strokeWidth={2} />Sair</button></SidebarFooter>
  </SidebarContainer>;
}
