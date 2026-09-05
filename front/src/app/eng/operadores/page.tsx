"use client";

import { useEffect, useMemo, useState } from "react";
import { Joystick, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getRecursosEng, recursoEngFotoUrl, type RecursoEng } from "@/lib/api";
import { getRamoConfig } from "@/lib/ramos";

export default function OperadoresPage() {
  const [lista, setLista] = useState<RecursoEng[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [ativo, setAtivo] = useState<boolean | null>(null);

  useEffect(() => {
    getRamoConfig().then((c) => setAtivo(c.sidebar.includes("eng_operadores"))).catch(() => setAtivo(true));
    getRecursosEng("operador")
      .then(setLista)
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar os operadores."));
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return lista.filter((o) => [o.nome, o.dados.modelo_drone, o.dados.email].some((v) => v?.toLowerCase().includes(q)));
  }, [busca, lista]);

  if (ativo === false) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-6 text-sm text-slate-500">
          Esse módulo não está ativado pra sua empresa. Peça ao administrador do sistema pra liberar em <b>Configurações</b>.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[100rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Operadores</h1>
          <p className="mt-1 text-sm text-slate-500">Quem pilota os drones. Cada voo é vinculado a um operador.</p>
        </div>
        <div className="rounded-full bg-indigo-50 px-3 py-2 text-sm font-medium text-primary">{lista.length} operador(es)</div>
      </div>

      <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
        O operador é cadastrado pelo <b>administrador</b> ao criar o acesso (login), informando o <b>modelo do drone</b>.
        Aí todo voo que ele criar já sai identificado com nome + drone.
      </p>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-semibold text-slate-800">Operadores cadastrados</h2>
            <p className="text-xs text-slate-500">{filtrados.length} resultado(s)</p>
          </div>
          <label className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" className="w-72 max-w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="px-5 py-3">Operador</th><th className="px-5 py-3">Drone</th>
                <th className="px-5 py-3">E-mail</th><th className="px-5 py-3">Telefone</th><th className="px-5 py-3">ANAC</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">Nenhum operador. Cadastre pelo Admin → Usuários e acessos.</td></tr>
              ) : filtrados.map((o) => (
                <tr key={o.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {o.tem_foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={recursoEngFotoUrl("operador", o.id)} alt={o.nome} className="size-10 rounded-full object-cover" />
                      ) : (
                        <span className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-400"><Joystick size={16} /></span>
                      )}
                      <span className="font-medium text-slate-700">{o.nome}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{o.dados.modelo_drone || "—"}</td>
                  <td className="px-5 py-4 text-slate-500">{o.dados.email || "—"}</td>
                  <td className="px-5 py-4 text-slate-500">{o.dados.telefone || "—"}</td>
                  <td className="px-5 py-4 text-slate-500">{o.dados.registro_anac || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {erro && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
