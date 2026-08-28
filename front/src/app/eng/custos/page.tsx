import { RecursoCrud } from "@/components/eng/recurso-crud";
import { PainelCustos } from "@/components/eng/painel-custos";

export default function CustosPage() {
  return <RecursoCrud tipo="custo" topo={<PainelCustos />} />;
}
