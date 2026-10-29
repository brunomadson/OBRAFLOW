import { pdf } from "@react-pdf/renderer";

export async function baixarPdf(documento: Parameters<typeof pdf>[0], nomeArquivo: string): Promise<void> {
  const blob = await pdf(documento).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo.endsWith(".pdf") ? nomeArquivo : `${nomeArquivo}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
