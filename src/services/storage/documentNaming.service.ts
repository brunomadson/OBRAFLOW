// DocumentNamingService — padroniza o nome do arquivo no upload.
// Padrão pedido: TIPO_DOCUMENTO_NOME_CLIENTE_CIDADE
// Exemplo: IMG000123.pdf → RG_JOAO_SILVA_PEDREIRAS.pdf
//
// v1 é uma regra determinística (maiúsculo, sem acento, tipo_doc como
// está no banco) — não é definitiva. O ticket pede explicitamente que
// isso seja substituível por IA no futuro ("a regra deve permitir
// alteração futura pela IA"); por isso esta função é uma peça isolada e
// pequena, fácil de trocar por uma chamada de IA depois sem tocar em quem
// chama (uploadDocumentoHibrido).

// "Combining Diacritical Marks" (U+0300 a U+036F) — o que normalize("NFD")
// separa de cada letra acentuada (ex.: "ã" vira "a" + marca combinada).
// Construído via charCode em vez de literal no arquivo fonte, pra não
// depender de nenhum caractere combinado sobrevivendo intacto na hora de
// salvar/ler este arquivo em diferentes ferramentas/encodings.
const MARCAS_DIACRITICAS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, "g");

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(MARCAS_DIACRITICAS, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function gerarNomePadronizado(params: {
  tipoDoc: string;
  nomeCliente: string;
  cidade?: string | null;
  nomeOriginal: string;
}): string {
  const extensao = params.nomeOriginal.split(".").pop()?.toLowerCase() ?? "bin";
  const partes = [normalizar(params.tipoDoc), normalizar(params.nomeCliente), params.cidade ? normalizar(params.cidade) : null].filter(
    (p): p is string => !!p
  );
  return `${partes.join("_")}.${extensao}`;
}
