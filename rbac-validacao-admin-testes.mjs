// rbac-validacao-admin-testes.mjs
// Sprint 7.1 — testes obrigatórios das tabelas administrativas (config,
// metas_dashboard, workspace_invites, workspace_integracoes), usando os
// usuários reais já criados por rbac-validacao-setup.mjs (rode esse
// primeiro se ainda não rodou).
//
// Só apaga o que ele mesmo cria (linha de config/meta fixture, convite de
// teste) — os usuários continuam existindo.
//
// Rodar com: node --env-file=.env.local rbac-validacao-admin-testes.mjs

import { createClient } from '@supabase/supabase-js';
import { sb } from './supabase-admin.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SENHA = 'RbacValidacao_2026!';
const WORKSPACE_NOME = 'ObraFlow Padrão';

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

const { data: ws } = await sb.from('workspaces').select('id').eq('nome', WORKSPACE_NOME).single();
const workspaceId = ws.id;
console.log(`\n🔒  Testes administrativos — Sprint 7.1 — workspace ${WORKSPACE_NOME} (${workspaceId})\n`);

const ceo = await loginComo('rbac-ceo@teste.com');
const gerente = await loginComo('rbac-gerente@teste.com');
const sdr = await loginComo('rbac-sdr@teste.com');
const engenheiro = await loginComo('rbac-engenheiro@teste.com');
const estagiario = await loginComo('rbac-estagiario@teste.com');

const convitesCriados = [];

try {
  // ── CONFIG ────────────────────────────────────────────────────────────────
  console.log('─ config (setor: configuracoes) ─────────────────────────────────');

  // garante uma linha de config existente (via service role) pra testar UPDATE
  const { data: cfgExistente } = await sb.from('config').select('id').eq('workspace_id', workspaceId).maybeSingle();
  let configId = cfgExistente?.id;
  if (!configId) {
    const { data: novoCfg } = await sb.from('config').insert({ workspace_id: workspaceId, analise_credito_horas: 48 }).select('id').single();
    configId = novoCfg.id;
  }

  const { data: estConfig } = await estagiario.from('config').update({ analise_credito_horas: 999 }).eq('id', configId).select('id');
  registrar('Estagiário tentando alterar configuração → BLOQUEADO', (estConfig ?? []).length === 0, `${(estConfig ?? []).length} linha(s) afetada(s)`);

  const { data: ceoConfig } = await ceo.from('config').update({ analise_credito_horas: 48 }).eq('id', configId).select('id');
  registrar('CEO alterando configuração → PERMITIDO', (ceoConfig ?? []).length === 1, `${(ceoConfig ?? []).length} linha(s) afetada(s)`);

  // ── METAS ─────────────────────────────────────────────────────────────────
  console.log('\n─ metas_dashboard (setor: metas) ─────────────────────────────────');

  const periodo = new Date().toISOString().slice(0, 7);
  const { data: metaExistente } = await sb.from('metas_dashboard')
    .select('id').eq('workspace_id', workspaceId).eq('indicador', 'comercial_oportunidades').eq('periodo', periodo).maybeSingle();
  let metaId = metaExistente?.id;
  if (!metaId) {
    const { data: novaMeta } = await sb.from('metas_dashboard')
      .insert({ workspace_id: workspaceId, indicador: 'comercial_oportunidades', periodo, valor_meta: 10 }).select('id').single();
    metaId = novaMeta.id;
  }

  const { data: sdrMeta } = await sdr.from('metas_dashboard').update({ valor_meta: 999 }).eq('id', metaId).select('id');
  registrar('SDR tentando alterar meta → BLOQUEADO', (sdrMeta ?? []).length === 0, `${(sdrMeta ?? []).length} linha(s) afetada(s)`);

  const { data: gerMeta } = await gerente.from('metas_dashboard').update({ valor_meta: 15 }).eq('id', metaId).select('id');
  registrar('Gerente alterando meta → PERMITIDO', (gerMeta ?? []).length === 1, `${(gerMeta ?? []).length} linha(s) afetada(s)`);

  // ── CONVITES ──────────────────────────────────────────────────────────────
  console.log('\n─ workspace_invites (setor: membros) ─────────────────────────────');

  const { data: estConvite, error: estConviteErr } = await estagiario.from('workspace_invites').insert({
    email: 'rbac-teste-convite-estagiario@teste.com', nome: 'Teste Convite', cargo: 'Estagiário', workspace_id: workspaceId,
  }).select('id');
  registrar('Estagiário tentando criar convite → BLOQUEADO', !!estConviteErr || (estConvite ?? []).length === 0, estConviteErr ? `negado: ${estConviteErr.message}` : `${(estConvite ?? []).length} linha(s)`);

  // workspace_invites não tem trigger de auto_set_workspace_id (migration
  // 018 nunca anexou um) — o app sempre manda workspace_id explícito
  // (ModalMembro.tsx), então o teste precisa fazer o mesmo.
  const { data: ceoConvite, error: ceoConviteErr } = await ceo.from('workspace_invites').insert({
    email: 'rbac-teste-convite-ceo@teste.com', nome: 'Teste Convite', cargo: 'Estagiário', workspace_id: workspaceId,
  }).select('id');
  registrar('CEO criando convite → PERMITIDO', !ceoConviteErr && (ceoConvite ?? []).length === 1, ceoConviteErr?.message ?? 'ok');
  if (ceoConvite?.[0]) convitesCriados.push(ceoConvite[0].id);

  // ── INTEGRAÇÕES ───────────────────────────────────────────────────────────
  console.log('\n─ workspace_integracoes (setor: integracoes) ──────────────────────');

  const { data: whatsapp } = await sb.from('integracoes').select('id').eq('codigo', 'whatsapp').single();

  const { data: engInt, error: engIntErr } = await engenheiro.from('workspace_integracoes')
    .upsert({ integracao_id: whatsapp.id, status: 'conectado' }, { onConflict: 'workspace_id,integracao_id' }).select('id');
  registrar('Engenheiro tentando alterar integração → BLOQUEADO', !!engIntErr || (engInt ?? []).length === 0, engIntErr ? `negado: ${engIntErr.message}` : `${(engInt ?? []).length} linha(s)`);

  const { data: ceoInt, error: ceoIntErr } = await ceo.from('workspace_integracoes')
    .upsert({ integracao_id: whatsapp.id, status: 'conectado' }, { onConflict: 'workspace_id,integracao_id' }).select('id');
  registrar('CEO configurando integração → PERMITIDO', !ceoIntErr && (ceoInt ?? []).length === 1, ceoIntErr?.message ?? 'ok');

  // ── Extras: Gerente vê mas não edita integrações; visualizar em config/metas pra "demais cargos" ──
  console.log('\n─ Checagens extras da matriz ───────────────────────────────────');

  const { data: gerVeInt } = await gerente.from('workspace_integracoes').select('id').eq('integracao_id', whatsapp.id);
  registrar('Gerente lê integrações (visualizar=true)', (gerVeInt ?? []).length === 1, 'ok');
  const { data: gerEditaInt } = await gerente.from('workspace_integracoes').upsert({ integracao_id: whatsapp.id, status: 'nao_conectado' }, { onConflict: 'workspace_id,integracao_id' }).select('id');
  registrar('Gerente NÃO edita integrações (só visualizar)', (gerEditaInt ?? []).length === 0, `${(gerEditaInt ?? []).length} linha(s)`);

  const { data: sdrVeMeta } = await sdr.from('metas_dashboard').select('id').eq('id', metaId);
  registrar('SDR ainda lê metas (dashboard precisa disso)', (sdrVeMeta ?? []).length === 1, 'ok');

  const { data: estVeConvite } = await estagiario.from('workspace_invites').select('id').limit(1);
  registrar('Estagiário NÃO lê lista de convites', (estVeConvite ?? []).length === 0, `${(estVeConvite ?? []).length} linha(s)`);

} finally {
  console.log('\n─ Limpeza ──────────────────────────────────────────────────────');
  for (const id of convitesCriados) {
    await sb.from('workspace_invites').delete().eq('id', id);
  }
  console.log(`✓ ${convitesCriados.length} convite(s) de teste removido(s)`);
}

console.log('\n─ Resumo ───────────────────────────────────────────────────────');
const falhas = resultados.filter((r) => !r.ok);
console.log(`${resultados.length - falhas.length}/${resultados.length} passaram`);
if (falhas.length > 0) {
  console.log('\n🚨 FALHAS:');
  for (const f of falhas) console.log(`   - ${f.nome} (${f.detalhe})`);
}
console.log(falhas.length === 0 ? '\n✅ rbac-validacao-admin-testes.mjs: PASSOU\n' : '\n❌ rbac-validacao-admin-testes.mjs: FALHOU\n');
process.exit(falhas.length === 0 ? 0 : 1);
