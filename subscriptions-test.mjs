// subscriptions-test.mjs — Sprint 9 (Etapa 10)
// Testa: RLS/isolamento de subscriptions, get_workspace_access_status(),
// has_feature(), is_saas_admin(), e o webhook universal
// (/api/webhooks/payment) simulando payment.approved/failed/canceled.
//
// O webhook precisa do servidor Next rodando:
//   npm run dev   (num terminal separado)
//   node --env-file=.env.local subscriptions-test.mjs

import { createClient } from '@supabase/supabase-js';
import { sb } from './supabase-admin.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SENHA = 'SubsTest_2026!';
const MARKER = 'SUBS_TEST';
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const resultados = [];
function registrar(nome, ok, detalhe) {
  resultados.push({ nome, ok, detalhe });
  console.log(`${ok ? '✅' : '❌'} ${nome}${detalhe ? ' — ' + detalhe : ''}`);
}

async function loginComo(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return client;
}

async function criarWorkspaceComCeo(nome, email) {
  const { data: ws } = await sb.from('workspaces').insert({ nome: `[${MARKER}] ${nome}`, tipo_conta: 'PJ', ativo: true }).select('id').single();
  const { data: cargoCeo } = await sb.from('cargos').select('id').eq('workspace_id', ws.id).eq('nome', 'CEO / Dono').single();
  const { data: u } = await sb.auth.admin.createUser({ email, password: SENHA, email_confirm: true });
  await sb.from('profiles').update({ workspace_id: ws.id, cargo_id: cargoCeo.id }).eq('id', u.user.id);
  return { workspaceId: ws.id, userId: u.user.id };
}

async function criarUsuarioComCargo(workspaceId, nomeCargo, email) {
  const { data: cargo } = await sb.from('cargos').select('id').eq('workspace_id', workspaceId).eq('nome', nomeCargo).single();
  const { data: u } = await sb.auth.admin.createUser({ email, password: SENHA, email_confirm: true });
  await sb.from('profiles').update({ workspace_id: workspaceId, cargo_id: cargo.id }).eq('id', u.user.id);
  return u.user.id;
}

async function buscarUserIdPorEmail(email) {
  const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data.users.find((u) => u.email === email)?.id ?? null;
}

const suffix = Date.now().toString(36);
const criados = { workspaces: [], users: [] };

try {
  console.log('\n💳  Sprint 9 — subscriptions, has_feature, is_saas_admin, webhook\n');

  // ── Setup: 2 workspaces (A e B), CEO + SDR em A ────────────────────────
  const { data: planoBasico } = await sb.from('planos').select('id, codigo').eq('codigo', 'basico').single();
  const { data: planoPremium } = await sb.from('planos').select('id, codigo').eq('codigo', 'premium').single();

  const A = await criarWorkspaceComCeo(`WS-A-${suffix}`, `subs-ceo-a-${suffix}@teste.local`);
  criados.workspaces.push(A.workspaceId); criados.users.push(A.userId);
  const sdrAId = await criarUsuarioComCargo(A.workspaceId, 'SDR / Vendedor', `subs-sdr-a-${suffix}@teste.local`);
  criados.users.push(sdrAId);

  const B = await criarWorkspaceComCeo(`WS-B-${suffix}`, `subs-ceo-b-${suffix}@teste.local`);
  criados.workspaces.push(B.workspaceId); criados.users.push(B.userId);

  const { data: subA } = await sb.from('subscriptions').insert({
    workspace_id: A.workspaceId, plan_id: planoBasico.id, gateway_provider: 'manual', status: 'active', subscription_start: new Date().toISOString(),
  }).select('id').single();
  const { data: subB } = await sb.from('subscriptions').insert({
    workspace_id: B.workspaceId, plan_id: planoBasico.id, gateway_provider: 'manual', status: 'active', subscription_start: new Date().toISOString(),
  }).select('id').single();

  const ceoA = await loginComo(`subs-ceo-a-${suffix}@teste.local`);
  const sdrA = await loginComo(`subs-sdr-a-${suffix}@teste.local`);
  const ceoB = await loginComo(`subs-ceo-b-${suffix}@teste.local`);

  console.log('─ RLS: SELECT ──────────────────────────────────────────────────');
  const { data: ceoVe } = await ceoA.from('subscriptions').select('id').eq('id', subA.id);
  registrar('CEO (configuracoes=visualizar) vê a própria assinatura', (ceoVe ?? []).length === 1, 'ok');
  const { data: sdrVe } = await sdrA.from('subscriptions').select('id').eq('id', subA.id);
  registrar('SDR (sem configuracoes) NÃO vê a assinatura do próprio workspace', (sdrVe ?? []).length === 0, `${(sdrVe ?? []).length} linha(s)`);
  const { data: crossVe } = await ceoA.from('subscriptions').select('id').eq('id', subB.id);
  registrar('CEO de A NÃO vê assinatura de B (cross-tenant)', (crossVe ?? []).length === 0, `${(crossVe ?? []).length} linha(s)`);

  console.log('\n─ RLS: escrita bloqueada pro client (só service_role escreve) ───');
  const { data: ceoInsert } = await ceoA.from('subscriptions').insert({ workspace_id: A.workspaceId, plan_id: planoPremium.id, gateway_provider: 'manual', status: 'active' }).select('id');
  registrar('CEO NÃO consegue INSERT em subscriptions', (ceoInsert ?? []).length === 0, `${(ceoInsert ?? []).length} linha(s)`);
  const { data: ceoUpdate } = await ceoA.from('subscriptions').update({ status: 'canceled' }).eq('id', subA.id).select('id');
  registrar('CEO NÃO consegue trocar o próprio plano/status via UPDATE direto', (ceoUpdate ?? []).length === 0, `${(ceoUpdate ?? []).length} linha(s)`);
  const { data: ceoDelete } = await ceoA.from('subscriptions').delete().eq('id', subA.id).select('id');
  registrar('CEO NÃO consegue DELETE em subscriptions', (ceoDelete ?? []).length === 0, `${(ceoDelete ?? []).length} linha(s)`);

  console.log('\n─ get_workspace_access_status() ──────────────────────────────────');
  const { data: st1 } = await ceoA.rpc('get_workspace_access_status');
  registrar('active → ok', st1 === 'ok', st1);
  await sb.from('subscriptions').update({ status: 'past_due' }).eq('id', subA.id);
  const { data: st2 } = await ceoA.rpc('get_workspace_access_status');
  registrar('past_due → past_due (alerta, não bloqueia)', st2 === 'past_due', st2);
  await sb.from('subscriptions').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', subA.id);
  const { data: st3 } = await ceoA.rpc('get_workspace_access_status');
  registrar('canceled → blocked', st3 === 'blocked', st3);
  await sb.from('subscriptions').delete().eq('id', subA.id);
  const { data: st4 } = await ceoA.rpc('get_workspace_access_status');
  registrar('sem NENHUMA assinatura → ok (grandfather — não pode travar workspace legado)', st4 === 'ok', st4);
  const { data: subA2 } = await sb.from('subscriptions').insert({ workspace_id: A.workspaceId, plan_id: planoBasico.id, gateway_provider: 'manual', status: 'active', subscription_start: new Date().toISOString() }).select('id').single();
  await sb.from('workspaces').update({ ativo: false }).eq('id', A.workspaceId);
  const { data: st5 } = await ceoA.rpc('get_workspace_access_status');
  registrar('workspace.ativo=false → blocked mesmo com assinatura active (kill-switch admin)', st5 === 'blocked', st5);
  await sb.from('workspaces').update({ ativo: true }).eq('id', A.workspaceId);

  console.log('\n─ has_feature() ───────────────────────────────────────────────');
  await sb.from('subscriptions').update({ status: 'active' }).eq('id', subA2.id);
  const { data: hf1 } = await ceoA.rpc('has_feature', { p_workspace_id: A.workspaceId, p_feature_codigo: 'google_drive' });
  registrar('plano básico + ativo → has_feature(google_drive) = true', hf1 === true, hf1);
  const { data: hf2 } = await ceoA.rpc('has_feature', { p_workspace_id: A.workspaceId, p_feature_codigo: 'whatsapp' });
  registrar('plano básico → has_feature(whatsapp) = false (não incluso)', hf2 === false, hf2);
  await sb.from('subscriptions').update({ plan_id: planoPremium.id }).eq('id', subA2.id);
  const { data: hf3 } = await ceoA.rpc('has_feature', { p_workspace_id: A.workspaceId, p_feature_codigo: 'whatsapp' });
  registrar('upgrade pra premium → has_feature(whatsapp) = true', hf3 === true, hf3);
  await sb.from('subscriptions').update({ status: 'canceled' }).eq('id', subA2.id);
  const { data: hf4 } = await ceoA.rpc('has_feature', { p_workspace_id: A.workspaceId, p_feature_codigo: 'whatsapp' });
  registrar('assinatura cancelada → has_feature(whatsapp) = false mesmo no plano premium', hf4 === false, hf4);
  const { data: hf5 } = await ceoB.rpc('has_feature', { p_workspace_id: A.workspaceId, p_feature_codigo: 'google_drive' });
  registrar('CEO de B não consegue consultar has_feature de A (cross-tenant)', hf5 === false, hf5);
  await sb.from('subscriptions').update({ status: 'active' }).eq('id', subA2.id);

  console.log('\n─ is_saas_admin() ─────────────────────────────────────────────');
  const { data: adminAntes } = await ceoA.rpc('is_saas_admin');
  registrar('usuário comum NÃO é saas_admin por padrão', adminAntes === false, adminAntes);
  await sb.from('saas_admins').insert({ user_id: A.userId, nome: 'Teste' });
  const { data: adminDepois } = await ceoA.rpc('is_saas_admin');
  registrar('depois de inserido em saas_admins, is_saas_admin() = true', adminDepois === true, adminDepois);
  const { data: adminOutro } = await ceoB.rpc('is_saas_admin');
  registrar('CEO de B continua NÃO sendo saas_admin', adminOutro === false, adminOutro);
  await sb.from('saas_admins').delete().eq('user_id', A.userId);

  console.log('\n─ Webhook universal (/api/webhooks/payment?provider=cakto) ──────');
  const emailNovo = `subs-webhook-${suffix}@teste.local`;
  const subGatewayId = `sub_test_${suffix}`;
  const secret = process.env.CAKTO_WEBHOOK_SECRET;

  async function postWebhook(payload) {
    const res = await fetch(`${APP_URL}/api/webhooks/payment?provider=cakto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cakto-secret': secret },
      body: JSON.stringify(payload),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  const payloadAprovado = {
    event: 'purchase_approved',
    data: {
      customer: { email: emailNovo, name: 'Cliente Teste Webhook', id: `cus_${suffix}` },
      subscription: { id: subGatewayId, next_billing_at: '2026-08-14T00:00:00Z' },
      product: { code: 'basico' },
    },
  };

  let webhookOk = true;
  try {
    const r1 = await postWebhook(payloadAprovado);
    registrar('payment.approved (cliente novo) → 200', r1.status === 200, JSON.stringify(r1.body));

    const { data: novoWs } = await sb.from('workspaces').select('id').ilike('nome', `%${emailNovo}%`).maybeSingle();
    const { data: inviteNovo } = await sb.from('workspace_invites').select('workspace_id, cargo').eq('email', emailNovo).maybeSingle();
    registrar('workspace novo criado e convite CEO gerado', !!inviteNovo && inviteNovo.cargo === 'CEO / Dono', inviteNovo ? 'ok' : 'não encontrado');

    const workspaceNovoId = inviteNovo?.workspace_id;
    if (workspaceNovoId) criados.workspaces.push(workspaceNovoId);

    const { data: subNova } = await sb.from('subscriptions').select('id, status, gateway_subscription_id, gateway_provider').eq('gateway_subscription_id', subGatewayId).maybeSingle();
    registrar('subscription criada com status active e dados do gateway corretos', subNova?.status === 'active' && subNova?.gateway_provider === 'cakto', JSON.stringify(subNova));

    // Reenvio do mesmo evento — idempotência (não deve duplicar nem a
    // assinatura, nem o workspace/convite criado pra ela)
    const rReenvio = await postWebhook(payloadAprovado);
    registrar('reenvio do mesmo evento → 200', rReenvio.status === 200, JSON.stringify(rReenvio.body));
    const { data: subsDuplicadas } = await sb.from('subscriptions').select('id').eq('gateway_subscription_id', subGatewayId);
    registrar('reenviar o mesmo evento NÃO duplica a assinatura (idempotente)', (subsDuplicadas ?? []).length === 1, `${(subsDuplicadas ?? []).length} linha(s)`);
    const { data: convitesDuplicados } = await sb.from('workspace_invites').select('id, workspace_id').eq('email', emailNovo);
    registrar('reenviar o mesmo evento NÃO cria um segundo workspace/convite', (convitesDuplicados ?? []).length === 1, `${(convitesDuplicados ?? []).length} convite(s)`);

    const r2 = await postWebhook({ event: 'purchase_refused', data: { customer: {}, subscription: { id: subGatewayId }, product: {} } });
    const { data: subPastDue } = await sb.from('subscriptions').select('status').eq('gateway_subscription_id', subGatewayId).maybeSingle();
    registrar('payment.failed → status vira past_due', r2.status === 200 && subPastDue?.status === 'past_due', subPastDue?.status);

    const r3 = await postWebhook({ event: 'subscription_canceled', data: { customer: {}, subscription: { id: subGatewayId }, product: {} } });
    const { data: subCancelada } = await sb.from('subscriptions').select('status, canceled_at').eq('gateway_subscription_id', subGatewayId).maybeSingle();
    registrar('subscription.canceled → status vira canceled com canceled_at preenchido', r3.status === 200 && subCancelada?.status === 'canceled' && !!subCancelada?.canceled_at, JSON.stringify(subCancelada));

    const r4 = await postWebhook({ ...payloadAprovado, data: { ...payloadAprovado.data, subscription: { id: 'outro' } } });
    const rSemSecret = await fetch(`${APP_URL}/api/webhooks/payment?provider=cakto`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadAprovado) });
    registrar('sem header de secret → 401', rSemSecret.status === 401, rSemSecret.status);

    const rSemProvider = await fetch(`${APP_URL}/api/webhooks/payment`, { method: 'POST', body: '{}' });
    registrar('sem ?provider= → 400', rSemProvider.status === 400, rSemProvider.status);
    void r4;

    const webhookUserId = await buscarUserIdPorEmail(emailNovo);
    if (webhookUserId) criados.users.push(webhookUserId);
  } catch (e) {
    webhookOk = false;
    registrar('bloco de testes do webhook rodou sem exceção', false, e.message + ' — servidor Next (npm run dev) está rodando em ' + APP_URL + '?');
  }
  void webhookOk;

} finally {
  console.log('\n─ Limpeza ──────────────────────────────────────────────────────');
  for (const uid of criados.users) {
    try { await sb.from('profiles').delete().eq('id', uid); } catch { /* segue limpeza */ }
    try { await sb.auth.admin.deleteUser(uid); } catch { /* segue limpeza */ }
  }
  for (const wid of criados.workspaces) {
    try { await sb.from('workspaces').delete().eq('id', wid); } catch { /* segue limpeza */ }
  }
  console.log(`✓ ${criados.workspaces.length} workspace(s) e ${criados.users.length} usuário(s) de teste removidos`);
}

console.log('\n─ Resumo ───────────────────────────────────────────────────────');
const falhas = resultados.filter((r) => !r.ok);
console.log(`${resultados.length - falhas.length}/${resultados.length} passaram`);
if (falhas.length > 0) {
  console.log('\n🚨 FALHAS:');
  for (const f of falhas) console.log(`   - ${f.nome} (${f.detalhe})`);
}
console.log(falhas.length === 0 ? '\n✅ subscriptions-test.mjs: PASSOU\n' : '\n❌ subscriptions-test.mjs: FALHOU\n');
process.exit(falhas.length === 0 ? 0 : 1);
