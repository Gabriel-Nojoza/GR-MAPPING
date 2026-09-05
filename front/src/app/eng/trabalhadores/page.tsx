import { RecursoCrud } from "@/components/eng/recurso-crud";
import { PainelPessoasObra } from "@/components/eng/painel-pessoas-obra";

export default function TrabalhadoresPage() {
  return <RecursoCrud tipo="trabalhador" topo={<PainelPessoasObra />} />;
}
