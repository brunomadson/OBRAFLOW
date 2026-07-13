// rbac-validacao-testes.mjs
// Etapa 4 + parte da Etapa 5 do RBAC_VALIDACAO.md — testes de banco (RLS)
// usando os usuários REAIS e PERSISTENTES criados por
// rbac-validacao-setup.mjs (rode esse primeiro), dentro do workspace
// "ObraFlow Padrão".
//
// Só os DADOS de teste (lead/obra/lançamento fixture, marcados com
// RBAC_VALIDACAO_MARKER) são apagados no final — os usuários e cargos
// continuam existindo pra você usar depois.
//
// Rodar com: node --env-file=.env.local rbac-validacao-testes.mjs

import { createClient } from '@supabase/supabase-js';
import { sb } from './supabase-admin.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SENHA = 'RbacValidacao_2026!';
const MARKER = 'RBAC_VALIDACAO_MARKER';
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
console.log(`\n🔒  Testes de banco — validação RBAC — workspace ${WORKSPACE_NOME} (${workspaceId})\n`);

// ─── Fixtures (dado-base do workspace, via service role) ────────────────────
const hoje = new Date().toISOString().slice(0, 10);
const { data: leadBase } = await sb.from('leads').insert({
  nome: '[RBAC-VALIDACAO] Lead base', telefone: '(99) 90000-0000', cidade: 'Teste',
  origem: 'Captação ativa', etapa: 'leads', obs: MARKER, workspace_id: workspaceId,
}).select('id').single();

const { data: obraBase } = await sb.from('obras').insert({
  cliente: '[RBAC-VALIDACAO] Obra base', nome: '[RBAC-VALIDACAO] Obra base', telefone: '(99) 90000-0000',
  cidade: 'Teste', modalidade: 'Terreno próprio', etapa: 'projeto', progresso: 10,
  obs: MARKER, workspace_id: workspaceId,
}).select('id').single();

const { data: lancBase } = await sb.from('lancamentos').insert({
  descricao: '[RBAC-VALIDACAO] Lançamento base', valor: 1, tipo: 'entrada', categoria: 'Receita diversa',
  grupo: 'Receita Outras', data: hoje, data_vencimento: hoje, forma_pagamento: 'Pix',
  status_pagamento: 'pago', obra_id: obraBase.id, obs: MARKER, workspace_id: workspaceId,
}).select('id').single();

// obra separada, sem lançamento vinculado, só pra testar exclusão (evita
// FK violation com lancBase — mesma lição do rbac-test.mjs)
const { data: obraExcluir } = await sb.from('obras').insert({
  cliente: '[RBAC-VALIDACAO] Obra p/ excluir', nome: '[RBAC-VALIDACAO] Obra p/ excluir', telefone: '(99) 90000-0000',
  cidade: 'Teste', modalidade: 'Terreno próprio', etapa: 'projeto', progresso: 10,
  obs: MARKER, workspace_id: workspaceId,
}).select('id').single();

try {
  // ── Etapa 4: casos explicitamente pedidos no ticket ────────────────────────
  console.log('─ Etapa 4 — casos explícitos do ticket ─────────────────────────');

  const sdr = await loginComo('rbac-sdr@teste.com');
  const { data: sdrLanc } = await sdr.from('lancamentos').select('id').eq('id', lancBase.id);
  registrar('SDR acessando lancamentos → negado', (sdrLanc ?? []).length === 0, `${(sdrLanc ?? []).length} linha(s)`);

  const financeiro = await loginComo('rbac-financeiro@teste.com');
  const { data: finLeads } = await financeiro.from('leads').select('id').eq('id', leadBase.id);
  registrar('Financeiro acessando leads → negado', (finLeads ?? []).length === 0, `${(finLeads ?? []).length} linha(s)`);

  const engenheiro = await loginComo('rbac-engenheiro@teste.com');
  const { data: engDel } = await engenheiro.from('obras').delete().eq('id', obraBase.id).select('id');
  registrar('Engenheiro excluindo obra → bloqueado pelo banco', (engDel ?? []).length === 0, `${(engDel ?? []).length} linha(s) apagada(s)`);

  const estagiario = await loginComo('rbac-estagiario@teste.com');
  const { data: estDel } = await estagiario.from('obras').delete().eq('id', obraBase.id).select('id');
  registrar('Estagiário excluindo obra → bloqueado pelo banco', (estDel ?? []).length === 0, `${(estDel ?? []).length} linha(s) apagada(s)`);

  // ── Matriz completa por cargo (positivo + negativo) ─────────────────────────
  console.log('\n─ Matriz completa — controles positivos e negativos ────────────');

  const ceo = await loginComo('rbac-ceo@teste.com');
  await testarLista('CEO lê leads/obras/lançamentos (acesso total)', [
    ceo.from('leads').select('id').eq('id', leadBase.id),
    ceo.from('obras').select('id').eq('id', obraExcluir.id),
    ceo.from('lancamentos').select('id').eq('id', lancBase.id),
  ], 1);

  const gerente = await loginComo('rbac-gerente@teste.com');
  const { data: gerLeadOk } = await gerente.from('leads').select('id').eq('id', leadBase.id);
  registrar('Gerente lê leads', (gerLeadOk ?? []).length === 1, 'ok');
  const { data: gerLancDel } = await gerente.from('lancamentos').delete().eq('id', lancBase.id).select('id');
  registrar('Gerente NÃO exclui lançamento (regra explícita do ticket)', (gerLancDel ?? []).length === 0, `${(gerLancDel ?? []).length} linha(s)`);

  const { data: sdrCriaLead, error: sdrCriaErr } = await sdr.from('leads').insert({
    nome: '[RBAC-VALIDACAO] Lead do SDR', telefone: '(99) 90000-0000', cidade: 'Teste',
    origem: 'Captação ativa', etapa: 'leads', obs: MARKER,
  }).select('id').single();
  registrar('SDR cria lead', !sdrCriaErr, sdrCriaErr?.message ?? 'ok');
  if (sdrCriaLead) {
    const { data: sdrDelLead } = await sdr.from('leads').delete().eq('id', sdrCriaLead.id).select('id');
    registrar('SDR exclui lead (tem permissão)', (sdrDelLead ?? []).length === 1, 'ok');
  }
  const { data: sdrObras } = await sdr.from('obras').select('id').eq('id', obraExcluir.id);
  registrar('SDR NÃO acessa obras', (sdrObras ?? []).length === 0, `${(sdrObras ?? []).length} linha(s)`);

  const { data: engObras } = await engenheiro.from('obras').select('id').eq('id', obraExcluir.id);
  registrar('Engenheiro lê obras', (engObras ?? []).length === 1, 'ok');
  const { data: engFin } = await engenheiro.from('lancamentos').select('id').eq('id', lancBase.id);
  registrar('Engenheiro NÃO acessa financeiro', (engFin ?? []).length === 0, `${(engFin ?? []).length} linha(s)`);

  const { data: estObras } = await estagiario.from('obras').select('id').eq('id', obraExcluir.id);
  registrar('Estagiário lê obras', (estObras ?? []).length === 1, 'ok');
  const { data: estCom } = await estagiario.from('leads').select('id').eq('id', leadBase.id);
  registrar('Estagiário NÃO acessa comercial', (estCom ?? []).length === 0, `${(estCom ?? []).length} linha(s)`);

  const { data: finLanc } = await financeiro.from('lancamentos').select('id').eq('id', lancBase.id);
  registrar('Financeiro lê lançamentos', (finLanc ?? []).length === 1, 'ok');
  const { data: finObras } = await financeiro.from('obras').select('id').eq('id', obraExcluir.id);
  registrar('Financeiro NÃO acessa obras', (finObras ?? []).length === 0, `${(finObras ?? []).length} linha(s)`);

  // ── Etapa 5: cargo customizado "Supervisor de Obras" ────────────────────────
  console.log('\n─ Etapa 5 — cargo customizado "Supervisor de Obras" ────────────');

  const supervisor = await loginComo('rbac-supervisor@teste.com');
  const { data: supObras } = await supervisor.from('obras').select('id').eq('id', obraExcluir.id);
  registrar('Supervisor lê obras', (supObras ?? []).length === 1, 'ok');
  const { data: supEditou } = await supervisor.from('obras').update({ cidade: 'Editado pelo Supervisor' }).eq('id', obraExcluir.id).select('id');
  registrar('Supervisor edita obra', (supEditou ?? []).length === 1, 'ok');
  const { data: supDel } = await supervisor.from('obras').delete().eq('id', obraExcluir.id).select('id');
  registrar('Supervisor NÃO exclui obra (matriz customizada)', (supDel ?? []).length === 0, `${(supDel ?? []).length} linha(s)`);
  const { data: supCom } = await supervisor.from('leads').select('id').eq('id', leadBase.id);
  registrar('Supervisor NÃO acessa comercial', (supCom ?? []).length === 0, `${(supCom ?? []).length} linha(s)`);
  const { data: supFin } = await supervisor.from('lancamentos').select('id').eq('id', lancBase.id);
  registrar('Supervisor NÃO acessa financeiro', (supFin ?? []).length === 0, `${(supFin ?? []).length} linha(s)`);

  // Confirma que o cargo customizado aparece na listagem que o ModalMembro usa
  const { data: cargosVisiveis } = await ceo.from('cargos').select('nome').eq('workspace_id', workspaceId);
  const apareceNoSeletor = (cargosVisiveis ?? []).some((c) => c.nome === 'Supervisor de Obras');
  registrar('Cargo "Supervisor de Obras" aparece no seletor de membro (CEO)', apareceNoSeletor, apareceNoSeletor ? 'ok' : 'não encontrado');

} finally {
  console.log('\n─ Limpeza (só dados de teste, usuários continuam) ──────────────');
  await sb.from('lancamentos').delete().eq('workspace_id', workspaceId).ilike('obs', `%${MARKER}%`);
  await sb.from('obras').delete().eq('workspace_id', workspaceId).ilike('obs', `%${MARKER}%`);
  await sb.from('leads').delete().eq('workspace_id', workspaceId).ilike('obs', `%${MARKER}%`);
  console.log('✓ leads/obras/lançamentos de teste removidos');
}

async function testarLista(nome, promessas, esperado) {
  const resultadosParciais = await Promise.all(promessas);
  const ok = resultadosParciais.every((r) => (r.data ?? []).length === esperado);
  registrar(nome, ok, ok ? 'ok' : JSON.stringify(resultadosParciais.map((r) => r.data?.length)));
}

console.log('\n─ Resumo ───────────────────────────────────────────────────────');
const falhas = resultados.filter((r) => !r.ok);
console.log(`${resultados.length - falhas.length}/${resultados.length} passaram`);
if (falhas.length > 0) {
  console.log('\n🚨 FALHAS:');
  for (const f of falhas) console.log(`   - ${f.nome} (${f.detalhe})`);
}
console.log(falhas.length === 0 ? '\n✅ rbac-validacao-testes.mjs: PASSOU\n' : '\n❌ rbac-validacao-testes.mjs: FALHOU\n');
process.exit(falhas.length === 0 ? 0 : 1);
