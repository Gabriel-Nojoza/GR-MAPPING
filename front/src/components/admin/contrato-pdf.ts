import { jsPDF } from "jspdf";
import type { Contrato } from "@/lib/admin-api";

export type Contratada = { nome: string; doc: string; endereco: string; cidade: string };

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const dataBr = (s?: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "____/____/______");

function extenso(v: number): string {
  return brl(v);
}

async function carregarLogo(): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const resp = await fetch("/logo.png");
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
    const dim = await new Promise<{ w: number; h: number }>((res) => {
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => res({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dim };
  } catch {
    return null;
  }
}

export async function gerarContratoPdf(c: Contrato, contratada: Contratada) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 20;
  const W = 210 - M * 2;
  let y = M;

  const logo = await carregarLogo();
  if (logo) {
    const larguraMm = 34;
    const alturaMm = (logo.h / logo.w) * larguraMm;
    doc.addImage(logo.dataUrl, "PNG", 105 - larguraMm / 2, y, larguraMm, alturaMm);
    y += alturaMm + 5;
  }

  const linha = (txt: string, opts: { size?: number; bold?: boolean; gap?: number; align?: "left" | "center" | "justify" } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 10);
    const partes = doc.splitTextToSize(txt, W);
    for (const p of partes) {
      if (y > 275) { doc.addPage(); y = M; }
      doc.text(p, opts.align === "center" ? 105 : M, y, { align: opts.align === "center" ? "center" : "left", maxWidth: W });
      y += (opts.size ?? 10) * 0.42 + 1.6;
    }
    y += opts.gap ?? 0;
  };

  linha("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", { size: 13, bold: true, align: "center", gap: 4 });
  if (c.numero) linha(`Contrato nº ${c.numero}`, { size: 9, align: "center", gap: 4 });

  linha("Pelo presente instrumento particular, as partes:", { gap: 3 });
  linha(`CONTRATADA: ${contratada.nome}, inscrita no CNPJ sob o nº ${contratada.doc || "[CNPJ]"}, com sede em ${contratada.endereco || "[endereço]"}.`, { gap: 2 });
  linha(`CONTRATANTE: ${c.contratante_nome}${c.contratante_doc ? `, inscrita no CNPJ/CPF sob o nº ${c.contratante_doc}` : ""}${c.contratante_endereco ? `, com sede em ${c.contratante_endereco}` : ""}.`, { gap: 4 });
  linha("resolvem celebrar o presente contrato, que se regerá pelas cláusulas seguintes:", { gap: 4 });

  linha("CLÁUSULA 1ª – DO OBJETO", { bold: true, gap: 1 });
  linha(`A CONTRATADA prestará à CONTRATANTE os seguintes serviços: ${c.servico}.`, { gap: 4 });

  linha("CLÁUSULA 2ª – DO VALOR E FORMA DE PAGAMENTO", { bold: true, gap: 1 });
  linha(`Pela prestação dos serviços, a CONTRATANTE pagará à CONTRATADA o valor de ${extenso(c.valor)}${c.prazo_meses ? ` por mês` : ""}.`, { gap: 1 });
  linha(`Forma de pagamento: ${c.forma_pagamento || "a combinar entre as partes"}.`, { gap: 4 });

  linha("CLÁUSULA 3ª – DO PRAZO", { bold: true, gap: 1 });
  linha(`O presente contrato vigorará por ${c.prazo_meses ? `${c.prazo_meses} (${c.prazo_meses}) meses` : "prazo indeterminado"}, a partir de ${dataBr(c.data_inicio)}, podendo ser renovado por acordo entre as partes.`, { gap: 4 });

  linha("CLÁUSULA 4ª – DAS OBRIGAÇÕES DA CONTRATADA", { bold: true, gap: 1 });
  linha("Executar os serviços com zelo e técnica; fornecer os equipamentos e a mão de obra necessários; manter sigilo sobre as informações da CONTRATANTE.", { gap: 4 });

  linha("CLÁUSULA 5ª – DAS OBRIGAÇÕES DA CONTRATANTE", { bold: true, gap: 1 });
  linha("Efetuar os pagamentos nas datas ajustadas; fornecer as informações e o acesso necessários à execução dos serviços.", { gap: 4 });

  linha("CLÁUSULA 6ª – DA RESCISÃO", { bold: true, gap: 1 });
  linha("O contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias, ou imediatamente em caso de descumprimento de qualquer cláusula.", { gap: 4 });

  if (c.observacoes) {
    linha("CLÁUSULA 7ª – DISPOSIÇÕES GERAIS", { bold: true, gap: 1 });
    linha(c.observacoes, { gap: 4 });
  }

  linha("CLÁUSULA 8ª – DO FORO", { bold: true, gap: 1 });
  linha(`Fica eleito o foro da comarca de ${contratada.cidade || "[cidade]"} para dirimir quaisquer dúvidas oriundas deste contrato.`, { gap: 6 });

  linha(`E, por estarem justas e contratadas, as partes assinam o presente em duas vias de igual teor.`, { gap: 10 });
  linha(`${contratada.cidade || "____________"}, ${new Date().toLocaleDateString("pt-BR")}`, { gap: 16 });

  y += 4;
  doc.setFontSize(10);
  doc.text("_________________________________", M, y);
  doc.text("_________________________________", 210 - M, y, { align: "right" });
  y += 5;
  doc.text("CONTRATADA", M, y);
  doc.text("CONTRATANTE", 210 - M, y, { align: "right" });
  y += 4;
  doc.setFontSize(8);
  doc.text(contratada.nome, M, y);
  doc.text(c.contratante_nome, 210 - M, y, { align: "right" });

  doc.save(`contrato-${(c.numero || c.contratante_nome).replace(/[^\w-]+/g, "_")}.pdf`);
}
