import { getTerrenos } from "@/lib/api";
import { TerrenosTabela } from "@/components/terrenos/terrenos-tabela";

export default async function Terrenos() {
    let terrenos;
    try {
        terrenos = await getTerrenos();
    } catch {
        return (
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">Terrenos</h1>
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                    Não consegui falar com a API. Confirme que ela está rodando em{" "}
                    <code>uvicorn app.main:app --reload</code>.
                </p>

            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-semibold text-slate-900">Terrenos</h1>
            <p className="mt-1 text-sm text-slate-500">Histórico de Terrenos medidos</p>
            <TerrenosTabela terrenosIniciais={terrenos} />
        </div>
    )
}