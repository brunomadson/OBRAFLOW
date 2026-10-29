"use client";
import { fmtBRL } from "@/lib/utils";

// Tolerância de R$1 pra absorver arredondamento — não é validação bancária,
// é só um aviso pra pegar erro de digitação grosseiro.
const TOLERANCIA = 1;

export default function AvisoComposicaoVenda({
  financiado, recursosProprios, subsidio, venda,
}: {
  financiado: number | null | undefined;
  recursosProprios: number | null | undefined;
  subsidio: number | null | undefined;
  venda: number | null | undefined;
}) {
  const v = venda ?? 0;
  if (!v) return null;

  const soma = (financiado ?? 0) + (recursosProprios ?? 0) + (subsidio ?? 0);
  const diferenca = v - soma;
  if (Math.abs(diferenca) <= TOLERANCIA) return null;

  const faltou = diferenca > 0;

  return (
    <div className="mt-2.5 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      <span className="text-amber-500 text-sm flex-shrink-0">⚠</span>
      <p className="text-[11px] text-amber-700 font-medium">
        Financiado + Recursos Próprios + Subsídio soma <strong>{fmtBRL(soma)}</strong>, mas o Valor de Venda é <strong>{fmtBRL(v)}</strong>
        {" "}— {faltou ? `faltam ${fmtBRL(diferenca)}` : `sobram ${fmtBRL(-diferenca)}`}.
      </p>
    </div>
  );
}
