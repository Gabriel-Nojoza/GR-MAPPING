"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Cliente {
  nome: string;
  contato: string;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");

  function adicionar() {
    if (!nome.trim()) return;
    setClientes((atual) => [...atual, { nome, contato }]);
    setNome("");
    setContato("");
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
      <p className="mt-1 text-sm text-slate-500">
        Ainda não existe um backend pra clientes — essa lista fica só na memória do navegador
        (some ao recarregar a página).
      </p>

      <Card className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Contato</label>
          <input
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <Button onClick={adicionar}>Adicionar</Button>
      </Card>

      <Card className="mt-5 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-medium text-slate-400">
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">Contato</th>
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-8 text-center text-slate-400">
                  Nenhum cliente cadastrado ainda.
                </td>
              </tr>
            )}
            {clientes.map((c, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-5 py-3 text-slate-700">{c.nome}</td>
                <td className="px-5 py-3 text-slate-500">{c.contato || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
