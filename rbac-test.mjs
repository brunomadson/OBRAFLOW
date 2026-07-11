// rbac-test.mjs
// Teste automatizado da matriz de permissão por cargo (RBAC), no mesmo
// espírito do security-test.mjs (que testa isolamento entre workspaces).
// Aqui o foco é DENTRO de um único workspace: confirma que cada cargo só
// consegue fazer exatamente o que a matriz de permissoes_cargo autoriza.
//
// Cria um workspace descartável (os 6 cargos padrão são semeados sozinhos
// pelo trigger workspaces_seed_cargos), um usuário por cargo testado, dados
// próprios, e apaga tudo no final. Roda com segurança contra produção.
//
// Rodar com: node --env-file=.env.local rbac-test.mjs

import { createClient } from '@supabase/supabase-js';
import { sb } from './supabase-admin.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Faltam SUPABASE_URL / SUPABASE_ANON_KEY em .env.local');
  process.exit(1);
}

const SUFFIX = Date.now().toString(36);
const SENHA = `RbacTest_${SUFFIX}_!Aa1`;

const resultados = [];
function registrar(nome, ok, detalhe) {
  resultados.push({ nome, ok, detalhe });
  console.log(`${ok ? '✅' : '❌'} ${nome}${detalhe ? ' — ' + detalhe : ''}`);
}

const cleanup = { workspaceId: null, userIds: [] };

async function criarUsuarioComCargo(nomeCargo, label) {
  const email = `rbactest-${label.toLowerCase()}-${SUFFIX}@obraflow-test.local`;
  const { data: userResp, error: uErr } = await sb.auth.admin.createUser({
    email, password: SENHA, email_confirm: true, user_metadata: { nome: `Teste ${label}` },
  });
  if (uErr) throw new Error(`criar usuário ${label}: ${uErr.message}`);
  cleanup.userIds.push(userResp.user.id);

  const { data: cargo, error: cErr } = await sb
    .from('cargos').select('id')
    .eq('workspace_id', cleanup.workspaceId).eq('nome', nomeCargo).single();
  if (cErr) throw new Error(`achar cargo ${nomeCargo}: ${cErr.message}`);

  const { error: pErr } = await sb.from('profiles')
    .update({ workspace_id: cleanup.workspaceId, cargo_id: cargo.id })
    .eq('id', userResp.user.id);
  if (pErr) throw new Error(`atribuir cargo ${label}: ${pErr.message}`);

  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error: loginErr } = await client.auth.signInWithPassword({ email, password: SENHA });
  if (loginErr) throw new Error(`login ${label}: ${loginErr.message}`);
  return client;
}

async function testarPermitido(nome, promise, descricaoOk) {
  const { data, error } = await promise;
  registrar(nome, !error, error ? error.message : descricaoOk);
  return data;
}

async function testarNegado(nome, promise) {
  const { data, error } = await promise;
  const negado = !!error || (Array.isArray(data) && data.length === 0);
  registrar(nome, negado, error ? `negado com erro: ${error.message}` : `${(data ?? []).length} linha(s) retornada(s)/afetada(s)`);
}

async function main() {
  console.log(`\n🔒  Teste de matriz de permissão por cargo — execução ${SUFFIX}\n`);

  const { data: ws, error: wErr } = await sb.from('workspaces')
    .insert({ nome: `[RBAC-TEST] ${SUFFIX}`, tipo_conta: 'PJ', ativo: true })
    .select('id').single();
  if (wErr) throw new Error(`criar workspace: ${wErr.message}`);
  cleanup.workspaceId = ws.id;
  console.log(`Workspace: ${ws.id}\n`);

  // dado-base pertencente ao workspace, criado via service role
  const { data: leadBase } = await sb.from('leads').insert({
    nome: '[RBAC-TEST] Lead base', telefone: '(99) 90000-0000', cidade: 'Teste',
    origem: 'Captação ativa', etapa: 'leads', obs: `RBAC-TEST ${SUFFIX}`, workspace_id: ws.id,
  }).select('id').single();
  const { data: obraBase } = await sb.from('obras').insert({
    cliente: '[RBAC-TEST] Obra base', nome: '[RBAC-TEST] Obra base', telefone: '(99) 90000-0000',
    cidade: 'Teste', modalidade: 'Terreno próprio', etapa: 'projeto', progresso: 10,
    obs: `RBAC-TEST ${SUFFIX}`, workspace_id: ws.id,
  }).select('id').single();
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: lancBase } = await sb.from('lancamentos').insert({
    descricao: '[RBAC-TEST] Lançamento base', valor: 1, tipo: 'entrada', categoria: 'Receita diversa',
    grupo: 'Receita Outras', data: hoje, data_vencimento: hoje, forma_pagamento: 'Pix',
    status_pagamento: 'pago', obra_id: obraBase.id, obs: `RBAC-TEST ${SUFFIX}`, workspace_id: ws.id,
  }).select('id').single();

  // ── SDR / Vendedor — comercial completo (inclusive excluir), sem obras/financeiro ──
  console.log('─ SDR / Vendedor ───────────────────────────────────────────────');
  const sdr = await criarUsuarioComCargo('SDR / Vendedor', 'SDR');
  await testarPermitido('SDR lê leads', sdr.from('leads').select('id').eq('id', leadBase.id), 'ok');
  const { data: novoLeadSdr } = await testarPermitidoRet('SDR cria lead', sdr.from('leads').insert({
    nome: '[RBAC-TEST] Lead do SDR', telefone: '(99) 90000-0000', cidade: 'Teste',
    origem: 'Captação ativa', etapa: 'leads', obs: `RBAC-TEST ${SUFFIX}`,
  }).select('id').single());
  await testarPermitido('SDR edita lead', sdr.from('leads').update({ cidade: 'Editado' }).eq('id', leadBase.id), 'ok');
  await testarPermitido('SDR exclui lead (tem permissão)', sdr.from('leads').delete().eq('id', novoLeadSdr?.id ?? leadBase.id).select('id'), 'ok');
  await testarNegado('SDR NÃO lê obras', sdr.from('obras').select('id').eq('id', obraBase.id));
  await testarNegado('SDR NÃO cria obra', sdr.from('obras').insert({ cliente: 'x', nome: 'x', etapa: 'projeto' }));
  await testarNegado('SDR NÃO lê lançamentos', sdr.from('lancamentos').select('id').eq('id', lancBase.id));

  // ── Gerente / Diretor — cria/edita em comercial+obras+financeiro, NÃO exclui lançamento ──
  console.log('\n─ Gerente / Diretor ────────────────────────────────────────────');
  const gerente = await criarUsuarioComCargo('Gerente / Diretor', 'Gerente');
  await testarPermitido('Gerente lê lançamentos', gerente.from('lancamentos').select('id').eq('id', lancBase.id), 'ok');
  await testarPermitido('Gerente cria lançamento', gerente.from('lancamentos').insert({
    descricao: 'x', valor: 1, tipo: 'entrada', categoria: 'Receita diversa', grupo: 'Receita Outras',
    data: hoje, data_vencimento: hoje, forma_pagamento: 'Pix', status_pagamento: 'pago',
  }), 'ok');
  await testarPermitido('Gerente edita lançamento', gerente.from('lancamentos').update({ descricao: 'editado' }).eq('id', lancBase.id), 'ok');
  await testarNegado('Gerente NÃO exclui lançamento (restrição explícita do ticket)', gerente.from('lancamentos').delete().eq('id', lancBase.id).select('id'));

  // obra separada (sem lançamento vinculado) só pra testar exclusão — obraBase
  // não pode ser usada aqui porque lancBase referencia obraBase.id via FK.
  const { data: obraParaExcluir } = await sb.from('obras').insert({
    cliente: '[RBAC-TEST] Obra p/ excluir', nome: '[RBAC-TEST] Obra p/ excluir', telefone: '(99) 90000-0000',
    cidade: 'Teste', modalidade: 'Terreno próprio', etapa: 'projeto', progresso: 10,
    obs: `RBAC-TEST ${SUFFIX}`, workspace_id: ws.id,
  }).select('id').single();
  await testarPermitido('Gerente exclui obra (tem permissão)', gerente.from('obras').delete().eq('id', obraParaExcluir.id).select('id'), 'ok');

  const obraBase2 = obraBase;

  // ── Engenheiro / Arquiteto — obras cria/edita, NÃO exclui; sem comercial/financeiro ──
  console.log('\n─ Engenheiro / Arquiteto ───────────────────────────────────────');
  const engenheiro = await criarUsuarioComCargo('Engenheiro / Arquiteto', 'Engenheiro');
  await testarPermitido('Engenheiro lê obras', engenheiro.from('obras').select('id').eq('id', obraBase2.id), 'ok');
  await testarPermitido('Engenheiro edita obra', engenheiro.from('obras').update({ cidade: 'Editado' }).eq('id', obraBase2.id), 'ok');
  await testarNegado('Engenheiro NÃO exclui obra', engenheiro.from('obras').delete().eq('id', obraBase2.id).select('id'));
  await testarNegado('Engenheiro NÃO lê leads', engenheiro.from('leads').select('id').eq('id', leadBase.id));
  await testarNegado('Engenheiro NÃO lê lançamentos', engenheiro.from('lancamentos').select('id').eq('id', lancBase.id));

  // ── Estagiário — mesma regra de obras do Engenheiro ──────────────────────────
  console.log('\n─ Estagiário ───────────────────────────────────────────────────');
  const estagiario = await criarUsuarioComCargo('Estagiário', 'Estagiario');
  await testarPermitido('Estagiário lê obras', estagiario.from('obras').select('id').eq('id', obraBase2.id), 'ok');
  await testarPermitido('Estagiário edita obra', estagiario.from('obras').update({ cidade: 'Editado 2' }).eq('id', obraBase2.id), 'ok');
  await testarNegado('Estagiário NÃO exclui obra', estagiario.from('obras').delete().eq('id', obraBase2.id).select('id'));
  await testarNegado('Estagiário NÃO lê leads', estagiario.from('leads').select('id').eq('id', leadBase.id));

  // ── Financeiro — controle completo dos lançamentos, sem comercial/obras ──────
  console.log('\n─ Financeiro ───────────────────────────────────────────────────');
  const financeiro = await criarUsuarioComCargo('Financeiro', 'Financeiro');
  await testarPermitido('Financeiro lê lançamentos', financeiro.from('lancamentos').select('id').eq('id', lancBase.id), 'ok');
  await testarPermitido('Financeiro exclui lançamento (controle completo)', financeiro.from('lancamentos').delete().eq('id', lancBase.id).select('id'), 'ok');
  await testarNegado('Financeiro NÃO lê obras', financeiro.from('obras').select('id').eq('id', obraBase2.id));
  await testarNegado('Financeiro NÃO lê leads', financeiro.from('leads').select('id').eq('id', leadBase.id));

  console.log('\n─ Resumo ───────────────────────────────────────────────────────');
  const falhas = resultados.filter((r) => !r.ok);
  console.log(`${resultados.length - falhas.length}/${resultados.length} passaram`);
  if (falhas.length > 0) {
    console.log('\n🚨 FALHAS NA MATRIZ DE PERMISSÃO:');
    for (const f of falhas) console.log(`   - ${f.nome} (${f.detalhe})`);
  } else {
    console.log('\n✅ Matriz de permissão bate exatamente com o esperado.');
  }
  return falhas.length === 0;
}

async function testarPermitidoRet(nome, promise) {
  const { data, error } = await promise;
  registrar(nome, !error, error ? error.message : 'ok');
  return { data };
}

async function limpar() {
  console.log('\n─ Limpeza ──────────────────────────────────────────────────────');
  if (!cleanup.workspaceId) return;
  const { error: lancErr } = await sb.from('lancamentos').delete().eq('workspace_id', cleanup.workspaceId);
  console.log(`${lancErr ? '✗' : '✓'} lancamentos${lancErr ? ' — ' + lancErr.message : ''}`);
  const { error: obraErr } = await sb.from('obras').delete().eq('workspace_id', cleanup.workspaceId);
  console.log(`${obraErr ? '✗' : '✓'} obras${obraErr ? ' — ' + obraErr.message : ''}`);
  const { error: leadErr } = await sb.from('leads').delete().eq('workspace_id', cleanup.workspaceId);
  console.log(`${leadErr ? '✗' : '✓'} leads${leadErr ? ' — ' + leadErr.message : ''}`);
  for (const userId of cleanup.userIds) {
    await sb.from('profiles').delete().eq('id', userId);
    const { error } = await sb.auth.admin.deleteUser(userId);
    console.log(`${error ? '✗' : '✓'} usuário ${userId}${error ? ' — ' + error.message : ''}`);
  }
  const { error: wsErr } = await sb.from('workspaces').delete().eq('id', cleanup.workspaceId);
  console.log(`${wsErr ? '✗' : '✓'} workspace (cargos/permissoes_cargo cascateiam)${wsErr ? ' — ' + wsErr.message : ''}`);
}

let ok = false;
try {
  ok = await main();
} catch (err) {
  console.error('\n💥 Erro durante o teste:', err.message);
} finally {
  await limpar();
}

console.log(ok ? '\n✅ rbac-test.mjs: PASSOU\n' : '\n❌ rbac-test.mjs: FALHOU\n');
process.exit(ok ? 0 : 1);
