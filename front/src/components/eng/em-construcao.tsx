import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

export function EmConstrucao({
  titulo,
  descricao,
  itens,
}: {
  titulo: string;
  descricao: string;
  itens: string[];
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
      <p className="mt-1 text-sm text-slate-500">{descricao}</p>

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-3 text-slate-700">
          <span className="grid size-10 place-items-center rounded-lg bg-amber-50 text-amber-600">
            <Construction size={20} />
          </span>
          <div>
            <h2 className="font-semibold">Módulo em construção</h2>
            <p className="text-xs text-slate-500">Esta área vai reunir:</p>
          </div>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {itens.map((item) => (
            <li key={item} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="size-1.5 rounded-full bg-primary" />
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
