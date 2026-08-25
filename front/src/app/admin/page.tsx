"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CircleDollarSign, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { listarEmpresas, type Empresa } from "@/lib/admin-api";

export default function AdminPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    listarEmpresas().then(setEmpresas).catch((causa) => {
      setErro(causa instanceof Error ? causa.message : "Não foi possível carregar os dados.");
    });
  }, []);

  const ativas = useMemo(() => empresas.filter((empresa) => empresa.status === "ativo").length, [empresas]);
  const usuarios = useMemo(() => empresas.reduce((total, empresa) => total + Number(empresa.total_usuarios), 0), [empresas]);

  return <div className="mx-auto max-w-7xl"><p className="text-sm font-medium text-primary">Administração Master</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">Visão geral da plataforma</h1><p className="mt-1 text-sm text-slate-500">Acompanhe as imobiliárias cadastradas e a operação do sistema.</p><div className="mt-6 grid gap-4 sm:grid-cols-3"><Card className="p-5"><Building2 className="text-primary" size={20} /><p className="mt-4 text-sm text-slate-500">Imobiliárias cadastradas</p><p className="mt-1 text-2xl font-semibold text-slate-900">{empresas.length}</p></Card><Card className="p-5"><Users className="text-primary" size={20} /><p className="mt-4 text-sm text-slate-500">Acessos de imobiliárias</p><p className="mt-1 text-2xl font-semibold text-slate-900">{usuarios}</p></Card><Card className="p-5"><CircleDollarSign className="text-primary" size={20} /><p className="mt-4 text-sm text-slate-500">Contas ativas</p><p className="mt-1 text-2xl font-semibold text-emerald-600">{ativas}</p></Card></div>{erro && <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}</div>;
}
