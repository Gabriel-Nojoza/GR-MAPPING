"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { RecursoCrud } from "@/components/eng/recurso-crud";
import { PainelCustos } from "@/components/eng/painel-custos";
import { getRamoConfig } from "@/lib/ramos";

export default function CustosPage() {
  const [ativo, setAtivo] = useState<boolean | null>(null);

  useEffect(() => {
    getRamoConfig().then((c) => setAtivo(c.sidebar.includes("eng_custos"))).catch(() => setAtivo(true));
  }, []);

  if (ativo === false) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-6 text-sm text-slate-500">
          Esse módulo não está ativado pra sua empresa. Peça ao administrador do sistema pra liberar em <b>Configurações</b>.
        </Card>
      </div>
    );
  }

  return <RecursoCrud tipo="custo" topo={<PainelCustos />} />;
}
