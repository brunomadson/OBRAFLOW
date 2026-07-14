import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/services/payments/payment.provider";
import { processarEventoPagamento } from "@/services/payments/processarEventoPagamento";

// Rota ÚNICA e genérica para qualquer gateway de pagamento — nunca criar
// /api/webhooks/<gateway> (ver payment.provider.ts). Cada gateway é
// configurado no painel dele apontando pra:
//   https://.../api/webhooks/payment?provider=cakto
//   https://.../api/webhooks/payment?provider=stripe
// O "?provider=" só seleciona qual adaptador vai traduzir o payload —
// tudo depois disso (processarEventoPagamento) já é 100% genérico.
export async function POST(req: NextRequest) {
  const providerName = req.nextUrl.searchParams.get("provider");
  if (!providerName) {
    return NextResponse.json({ error: "parâmetro ?provider= ausente" }, { status: 400 });
  }

  let provider;
  try {
    provider = await getPaymentProvider(providerName);
  } catch {
    return NextResponse.json({ error: `gateway "${providerName}" não suportado` }, { status: 400 });
  }

  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => { headers[key] = value; });

  const evento = provider.parseWebhookEvent(rawBody, headers);
  if (!evento) {
    // Assinatura inválida ou evento não reconhecido — não processa.
    return NextResponse.json({ error: "evento inválido ou não reconhecido" }, { status: 401 });
  }

  try {
    await processarEventoPagamento(evento);
  } catch (e) {
    // 5xx sinaliza pro gateway reenviar depois — é o comportamento padrão
    // esperado de webhook (não engolir erro transitório silenciosamente).
    console.error(`[/api/webhooks/payment] falha ao processar evento ${evento.type} (${evento.gatewayProvider}):`, e);
    return NextResponse.json({ error: "falha ao processar evento" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
