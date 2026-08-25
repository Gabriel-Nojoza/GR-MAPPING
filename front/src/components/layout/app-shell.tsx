"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, UserRound } from "lucide-react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { AdminSidebar } from "@/components/sidebar/admin-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [usuario, setUsuario] = useState<{ nome?: string | null; email?: string; empresa_nome?: string | null; perfil?: string } | null>(null);
  const isLogin = pathname === "/login";
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (isLogin) return;
    if (sessionStorage.getItem("medicao-terreno:acesso") !== "autorizado") {
      router.replace("/login");
      return;
    }
    const usuarioSalvo = JSON.parse(sessionStorage.getItem("medicao-terreno:usuario") ?? "null");
    if (isAdmin && usuarioSalvo?.perfil !== "superadmin") {
      router.replace("/");
      return;
    }
    setUsuario(usuarioSalvo);
    setVerified(true);
  }, [isAdmin, isLogin, router]);

  if (isLogin) {
    return <main className="min-h-screen">{children}</main>;
  }

  if (!verified) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {isAdmin ? <AdminSidebar /> : <Sidebar />}
      <main className="flex-1 overflow-y-auto p-8">
        {!isAdmin && usuario && <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-indigo-50 text-primary"><Building2 size={18} /></span><div><p className="text-xs text-slate-500">Imobiliária</p><p className="text-sm font-semibold text-slate-800">{usuario.empresa_nome ?? "Empresa não vinculada"}</p></div></div><div className="flex items-center gap-2 border-l border-slate-100 pl-4"><UserRound size={16} className="text-slate-400" /><div><p className="text-xs text-slate-500">Usuário conectado</p><p className="text-sm font-medium text-slate-700">{usuario.nome || usuario.email}</p></div></div></div>}
        {children}
      </main>
    </div>
  );
}
