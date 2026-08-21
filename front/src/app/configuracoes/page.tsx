import { KeyRound, Server } from "lucide-react";
import { API_URL } from "@/lib/api";
import { Card } from "@/components/ui/card";

export default function Configuracoes() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Configurações</h1>

      <div className="mt-6 flex max-w-md flex-col gap-4">
        <Card>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Server size={16} className="text-primary" />
            Backend
          </div>
          <p className="mt-3 text-sm text-slate-700">
            URL da API: <code className="rounded bg-slate-100 px-1.5 py-0.5">{API_URL}</code>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Definida em <code>front/.env.local</code> na variável{" "}
            <code>NEXT_PUBLIC_API_URL</code>.
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <KeyRound size={16} className="text-primary" />
            Chave da IA (Gemini)
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Configurada só no backend, em <code>app/.env</code> (variável{" "}
            <code>GEMINI_API_KEY</code>) — por segurança, não é exposta nem gerenciada pelo
            front.
          </p>
        </Card>
      </div>
    </div>
  );
}
