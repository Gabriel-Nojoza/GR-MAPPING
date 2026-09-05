"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  HardHat,
  Truck,
  Users,
  Joystick,
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
import { getRamoConfig } from "@/lib/ramos";

const ITEMS = [
  { href: "/eng", icon: LayoutDashboard, label: "Dashboard", chave: "eng_dashboard" },
  { href: "/eng/obras", icon: HardHat, label: "Obras", chave: "eng_obras" },
  { href: "/eng/equipamentos", icon: Truck, label: "Máquinas", chave: "eng_maquinas" },
  { href: "/eng/trabalhadores", icon: Users, label: "Trabalhadores", chave: "eng_trabalhadores" },
  { href: "/eng/operadores", icon: Joystick, label: "Operadores", chave: "eng_operadores" },
  { href: "/eng/voos", icon: Plane, label: "Voos", chave: "eng_voos" },
  { href: "/eng/avanco", icon: TrendingUp, label: "Avanço", chave: "eng_avanco" },
  { href: "/eng/custos", icon: Coins, label: "Custos", chave: "eng_custos" },
  { href: "/eng/configuracoes", icon: Settings, label: "Configurações", chave: "eng_configuracoes" },
] as const;

// itens que só aparecem quando o admin liga a flag daquela empresa
const OPCIONAIS = new Set(["eng_operadores", "eng_custos"]);

export function EngenhariaSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  // por padrão mostra tudo (evita sumir o item por 1 frame); some assim que
  // a config real da empresa chega e a flag estiver desligada
  const [sidebar, setSidebar] = useState<string[] | null>(null);

  useEffect(() => {
    getRamoConfig().then((c) => setSidebar(c.sidebar)).catch(() => {});
  }, []);

  const itens = ITEMS.filter((item) => !OPCIONAIS.has(item.chave) || !sidebar || sidebar.includes(item.chave));

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
        {itens.map((item) => (
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
