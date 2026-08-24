"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Ruler,
  Map,
  Video,
  Users,
  Building2,
  WalletCards,
  ReceiptText,
  FolderArchive,
  Sparkles,
  Settings,
  LogOut,
} from "lucide-react";
import {
  SidebarContainer,
  SidebarHeader,
  SidebarItem,
  SidebarNav,
  SidebarFooter,
} from "./sidebar.styled";

const ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/medir", icon: Ruler, label: "Medir terreno" },
  { href: "/terrenos", icon: Map, label: "Terrenos" },
  { href: "/videos", icon: Video, label: "Vídeos salvos" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  { href: "/imoveis", icon: Building2, label: "Imóveis" },
  { href: "/financeiro", icon: WalletCards, label: "Financeiro" },
  { href: "/cobrancas", icon: ReceiptText, label: "Cobranças" },
  { href: "/documentos", icon: FolderArchive, label: "Documentos" },
  { href: "/gerar-projeto", icon: Sparkles, label: "Gerar Projeto IA" },
  { href: "/configuracoes", icon: Settings, label: "Configurações" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function sair() {
    sessionStorage.removeItem("medicao-terreno:acesso");
    router.replace("/login");
  }

  return (
    <SidebarContainer>
      <SidebarHeader>
        <div className="sidebar-logo-wrap">
          <Image
            src="/logo.png"
            alt="GR Mapping"
            width={128}
            height={128}
            priority
            className="sidebar-logo h-auto w-32 object-contain"
          />
        </div>
      </SidebarHeader>
      <SidebarNav>
        {ITEMS.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            icon={<item.icon size={18} strokeWidth={2} />}
            label={item.label}
            active={pathname === item.href}
          />
        ))}
      </SidebarNav>
      <SidebarFooter>
        <button
          type="button"
          onClick={sair}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut size={18} strokeWidth={2} />
          Sair
        </button>
      </SidebarFooter>
    </SidebarContainer>
  );
}
