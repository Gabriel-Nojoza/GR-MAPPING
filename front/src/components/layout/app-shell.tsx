"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, HardHat, LayoutDashboard, Plane, Ruler, TrendingUp, Users, UserRound } from "lucide-react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { AdminSidebar } from "@/components/sidebar/admin-sidebar";
import { EngenhariaSidebar } from "@/components/sidebar/engenharia-sidebar";
import { MobileTabBar, type TabItem } from "@/components/layout/mobile-tab-bar";
import { rotaEhEngenharia, type RamoSlug } from "@/lib/ramos";

const TABS_ENGENHARIA: TabItem[] = [
  { href: "/eng", icon: LayoutDashboard, label: "Início" },
  { href: "/eng/obras", icon: HardHat, label: "Obras" },
  { href: "/eng/voos", icon: Plane, label: "Voos" },
  { href: "/eng/avanco", icon: TrendingUp, label: "Avanço" },
];
const TABS_IMOBILIARIA: TabItem[] = [
  { href: "/", icon: LayoutDashboard, label: "Início" },
  { href: "/medir", icon: Ruler, label: "Medir" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  { href: "/imoveis", icon: Building2, label: "Imóveis" },
];

type Usuario = {
  nome?: string | null;
  email?: string;
  empresa_nome?: string | null;
  perfil?: string;
  empresa_ramo?: RamoSlug | null;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const isLogin = pathname === "/login";
  const isAdmin = pathname.startsWith("/admin");
  const isEngenhariaRota = rotaEhEngenharia(pathname);

  useEffect(() => {
    if (isLogin) return;
    if (sessionStorage.getItem("medicao-terreno:acesso") !== "autorizado") {
      router.replace("/login");
      return;
    }
    const usuarioSalvo: Usuario | null = JSON.parse(sessionStorage.getItem("medicao-terreno:usuario") ?? "null");
    if (isAdmin && usuarioSalvo?.perfil !== "superadmin") {
      router.replace("/");
      return;
    }
    // Fora do admin, cada empresa só enxerga a área do seu ramo.
    if (!isAdmin && usuarioSalvo?.perfil !== "superadmin") {
      const ehEngenharia = usuarioSalvo?.empresa_ramo === "engenharia";
      if (ehEngenharia && !isEngenhariaRota) {
        router.replace("/eng");
        return;
      }
      if (!ehEngenharia && isEngenhariaRota) {
        router.replace("/");
        return;
      }
    }
    setUsuario(usuarioSalvo);
    setVerified(true);
  }, [isAdmin, isEngenhariaRota, isLogin, router]);

  // fecha o menu do celular ao trocar de página
  useEffect(() => { setMenuAberto(false); }, [pathname]);

  if (isLogin) {
    return <main className="min-h-screen">{children}</main>;
  }

  if (!verified) return null;

  const barraLateral = isAdmin
    ? <AdminSidebar />
    : usuario?.empresa_ramo === "engenharia"
      ? <EngenhariaSidebar />
      : <Sidebar />;

  const rotuloEmpresa = usuario?.empresa_ramo === "engenharia" ? "Empresa" : "Imobiliária";
  const tabs = usuario?.empresa_ramo === "engenharia" ? TABS_ENGENHARIA : TABS_IMOBILIARIA;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* barra lateral: gaveta no celular, fixa no desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          menuAberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {barraLateral}
      </div>
      {menuAberto && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMenuAberto(false)} />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* topo do celular: só a logo (navegação fica na barra de baixo) */}
        <div className="flex items-center border-b border-slate-200 bg-white px-4 py-2.5 lg:hidden">
          <Image src="/logo.png" alt="GR Mapping" width={96} height={28} className="h-7 w-auto object-contain" />
        </div>

        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8">
          {!isAdmin && usuario && <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-indigo-50 text-primary"><Building2 size={18} /></span><div><p className="text-xs text-slate-500">{rotuloEmpresa}</p><p className="text-sm font-semibold text-slate-800">{usuario.empresa_nome ?? "Empresa não vinculada"}</p></div></div><div className="flex items-center gap-2 border-l border-slate-100 pl-4"><UserRound size={16} className="text-slate-400" /><div><p className="text-xs text-slate-500">Usuário conectado</p><p className="text-sm font-medium text-slate-700">{usuario.nome || usuario.email}</p></div></div></div>}
          {children}
        </main>
      </div>

      {!isAdmin && <MobileTabBar items={tabs} onMais={() => setMenuAberto(true)} />}
    </div>
  );
}
