"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar/sidebar";
import { AdminSidebar } from "@/components/sidebar/admin-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const isLogin = pathname === "/login";
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (isLogin) return;
    if (sessionStorage.getItem("medicao-terreno:acesso") !== "autorizado") {
      router.replace("/login");
      return;
    }
    const usuario = JSON.parse(sessionStorage.getItem("medicao-terreno:usuario") ?? "null");
    if (isAdmin && usuario?.perfil !== "superadmin") {
      router.replace("/");
      return;
    }
    setVerified(true);
  }, [isAdmin, isLogin, router]);

  if (isLogin) {
    return <main className="min-h-screen">{children}</main>;
  }

  if (!verified) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {isAdmin ? <AdminSidebar /> : <Sidebar />}
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
