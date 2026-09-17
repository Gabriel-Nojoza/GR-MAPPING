// Fila de upload guardada no navegador (IndexedDB) — pra quando a equipe
// tira fotos em campo sem internet: os arquivos ficam guardados no aparelho
// e são enviados sozinhos quando a conexão voltar (ou o usuário reabrir o
// app depois, mesmo tendo fechado a aba no meio do caminho).
const DB_NOME = "gr-mapping-fila";
const LOJA = "uploads";

export type ItemFila = {
  id: string;
  vooId: string;
  criadoEm: string;
  arquivos: { nome: string; tipo: string; blob: Blob }[];
};

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(DB_NOME, 1);
    pedido.onupgradeneeded = () => {
      pedido.result.createObjectStore(LOJA, { keyPath: "id" });
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

export async function salvarNaFila(vooId: string, arquivos: File[]): Promise<void> {
  const db = await abrirDb();
  const item: ItemFila = {
    id: crypto.randomUUID(),
    vooId,
    criadoEm: new Date().toISOString(),
    arquivos: arquivos.map((f) => ({ nome: f.name, tipo: f.type, blob: f })),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LOJA, "readwrite");
    tx.objectStore(LOJA).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listarFila(vooId?: string): Promise<ItemFila[]> {
  const db = await abrirDb();
  const itens = await new Promise<ItemFila[]>((resolve, reject) => {
    const tx = db.transaction(LOJA, "readonly");
    const pedido = tx.objectStore(LOJA).getAll();
    pedido.onsuccess = () => resolve(pedido.result as ItemFila[]);
    pedido.onerror = () => reject(pedido.error);
  });
  return vooId ? itens.filter((i) => i.vooId === vooId) : itens;
}

export async function removerDaFila(id: string): Promise<void> {
  const db = await abrirDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LOJA, "readwrite");
    tx.objectStore(LOJA).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Converte os blobs guardados de volta em File — pra reusar exatamente a
 * mesma função de upload que o envio "ao vivo" usa. */
export function arquivosDoItem(item: ItemFila): File[] {
  return item.arquivos.map((a) => new File([a.blob], a.nome, { type: a.tipo }));
}
