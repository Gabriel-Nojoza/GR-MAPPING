"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Terreno } from "@/types/terreno";
import { renomearTerreno, excluirTerreno } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TerrenoFotoMarcada } from "./terreno-foto-marcada";
import { CanvasPoligono } from "@/components/medir/canvas-poligono";
import type { Ponto } from "@/types/medicao";
import { API_URL } from "@/lib/api";

export function TerrenosTabela({ terrenosIniciais }: { terrenosIniciais: Terreno[] }) {
  const [terrenos, setTerrenos] = useState(terrenosIniciais);
  const [editando, setEditando] = useState<Terreno | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [remarcando, setRemarcando] = useState(false);
  const [pontosRemarcados, setPontosRemarcados] = useState<Ponto[]>([]);

  function iniciarEdicao(t: Terreno) {
    setEditando(t);
    setNomeEditado(t.nome ?? t.nome_foto ?? "");
    setRemarcando(false);
    setPontosRemarcados(t.pontos.map(([x, y]) => ({ x, y })));
  }

  async function salvarEdicao() {
    if (!editando) return;
    const atualizado = await renomearTerreno(editando.id, nomeEditado, remarcando ? pontosRemarcados.map((ponto) => [ponto.x, ponto.y]) : undefined);
    setTerrenos((atual) => atual.map((t) => (t.id === atualizado.id ? atualizado : t)));
    setEditando(null);
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este terreno?")) return;
    await excluirTerreno(id);
    setTerrenos((atual) => atual.filter((t) => t.id !== id));
  }

  return (
    <>
      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-medium text-slate-400">
              <th className="px-5 py-3">Terreno</th>
              <th className="px-5 py-3">Área</th>
              <th className="px-5 py-3">Perímetro</th>
              <th className="px-5 py-3">GSD</th>
              <th className="px-5 py-3">Medido em</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {terrenos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  Nenhum terreno medido ainda.
                </td>
              </tr>
            )}
            {terrenos.map((t) => (
              <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-5 py-3">
                  <p className="text-slate-700">{t.nome ?? t.nome_foto ?? "Sem nome"}</p>
                  {t.nome && t.nome_foto && <p className="text-xs text-slate-400">{t.nome_foto}</p>}
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {t.area_ha.toFixed(3)} ha ({t.area_m2.toFixed(0)} m²)
                </td>
                <td className="px-5 py-3 text-slate-500">{t.perimetro_m.toFixed(1)} m</td>
                <td className="px-5 py-3 text-slate-500">{t.gsd_cm_por_px.toFixed(2)} cm/px</td>
                <td className="px-5 py-3 text-slate-500">
                  {new Date(t.criado_em).toLocaleString("pt-BR")}
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => iniciarEdicao(t)} className="text-slate-400 hover:text-primary">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => excluir(t.id)} className="text-slate-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditando(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-slate-500">Editar terreno</h3>

            <TerrenoFotoMarcada terreno={editando} />

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium text-slate-700">Linhas da medição</p><p className="text-xs text-slate-500">{remarcando ? "Clique na foto para marcar o contorno do terreno." : "Mostre ou corrija o polígono marcado."}</p></div><Button variant="secondary" onClick={() => { setRemarcando((ativo) => !ativo); setPontosRemarcados(editando.pontos.map(([x, y]) => ({ x, y }))); }}>{remarcando ? "Cancelar marcação" : editando.pontos.length ? "Corrigir linhas" : "Remarcar linhas"}</Button></div>
              {remarcando && <div className="mt-3"><CanvasPoligono imagemUrl={`${API_URL}/terrenos/${editando.id}/foto`} pontos={pontosRemarcados} onAdicionarPonto={(ponto) => setPontosRemarcados((atuais) => atuais.length >= 4 ? atuais : [...atuais, ponto])} /><div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>{pontosRemarcados.length}/4 pontos marcados</span><button type="button" onClick={() => setPontosRemarcados([])} className="text-primary hover:underline">Limpar pontos</button></div></div>}
            </div>

            <label className="mt-4 block text-xs font-medium text-slate-500">
              Nome / local do terreno
            </label>
            <input
              value={nomeEditado}
              onChange={(e) => setNomeEditado(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-primary focus:outline-none"
              autoFocus
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
              <Button onClick={salvarEdicao}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
