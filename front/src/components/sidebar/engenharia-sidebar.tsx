"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  HardHat,
  Truck,
  Users,
  Route,
  Plane,
  TrendingUp,
  Coins,
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
  { href: "/eng", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/eng/obras", icon: HardHat, label: "Obras" },
  { href: "/eng/equipamentos", icon: Truck, label: "Máquinas" },
  { href: "/eng/trabalhadores", icon: Users, label: "Trabalhadores" },
  { href: "/eng/frentes", icon: Route, label: "Frentes" },
  { href: "/eng/voos", icon: Plane, label: "Voos" },
  { href: "/eng/avanco", icon: TrendingUp, label: "Avanço" },
  { href: "/eng/custos", icon: Coins, label: "Custos" },
  { href: "/eng/configuracoes", icon: Settings, label: "Configurações" },
] as const;

export function EngenhariaSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function sair() {
    sessionStorage.removeItem("medicao-terreno:acesso");
    sessionStorage.removeItem("medicao-terreno:token");
    sessionStorage.removeItem("medicao-terreno:usuario");
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
            active={item.href === "/eng" ? pathname === "/eng" : pathname.startsWith(item.href)}
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
