// security-test.mjs
// Teste automatizado de isolamento entre workspaces (RLS + Storage).
//
// Cria DOIS workspaces e DOIS usuários totalmente descartáveis, popula cada
// um com um registro próprio (lead, obra, lançamento, arquivo no Storage) e
// tenta acessar o dado do workspace B autenticado como usuário do workspace
// A — e vice-versa. Se qualquer leitura/gravação cross-tenant for permitida,
// o script termina com exit code 1 (dá pra plugar em CI no futuro).
//
// Importante: só cria e só apaga dado que ele mesmo criou nesta execução
// (todos marcados com o mesmo sufixo aleatório) — nunca toca em dado real.
// Pode rodar contra produção com segurança por causa disso.
//
// Rodar com: node --env-file=.env.local security-test.mjs

import { createClient } from '@supabase/supabase-js';
import { sb } from './supabase-admin.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Faltam SUPABASE_URL / SUPABASE_ANON_KEY em .env.local');
  process.exit(1);
}

const SUFFIX = Date.now().toString(36);
const SENHA = `SecTest_${SUFFIX}_!Aa1`;
const BUCKET = 'documentos';

const resultados = [];
function registrar(nome, ok, detalhe) {
  resultados.push({ nome, ok, detalhe });
  console.log(`${ok ? '✅' : '❌'} ${nome}${detalhe ? ' — ' + detalhe : ''}`);
}

const cleanup = { workspaces: [], userIds: [], storagePaths: [] };

async function criarTenant(label) {
  const { data: ws, error: wErr } = await sb
    .from('workspaces')
    .insert({ nome: `[SEC-TEST] ${label} ${SUFFIX}`, tipo_conta: 'PJ', ativo: true })
    .select('id')
    .single();
  if (wErr) throw new Error(`criar workspace ${label}: ${wErr.message}`);
  cleanup.workspaces.push(ws.id);

  const email = `sectest-${label.toLowerCase()}-${SUFFIX}@obraflow-test.local`;
  const { data: userResp, error: uErr } = await sb.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
    user_metadata: { nome: `Usuário Teste ${label}` },
  });
  if (uErr) throw new Error(`criar usuário ${label}: ${uErr.message}`);
  const userId = userResp.user.id;
  cleanup.userIds.push(userId);

  // trigger workspaces_seed_cargos já semeou os 6 cargos padrão pro workspace
  // de teste (RBAC, migration 027) — pega o cargo "CEO / Dono" pra dar acesso
  // total, senão has_permission() nega tudo e os controles positivos falham.
  const { data: cargoCeo, error: cargoErr } = await sb
    .from('cargos')
    .select('id')
    .eq('workspace_id', ws.id)
    .eq('nome', 'CEO / Dono')
    .single();
  if (cargoErr) throw new Error(`achar cargo CEO de ${label}: ${cargoErr.message}`);

  // trigger handle_new_user já criou o profile no workspace padrão — sobrescreve
  // pro workspace de teste, igual ao que /onboarding faz na aplicação real.
  const { error: pErr } = await sb
    .from('profiles')
    .update({ workspace_id: ws.id, cargo_id: cargoCeo.id })
    .eq('id', userId);
  if (pErr) throw new Error(`atualizar profile ${label}: ${pErr.message}`);

  return { workspaceId: ws.id, userId, email };
}

async function popularDados(workspaceId, responsavelId, label) {
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: lead, error: leadErr } = await sb
    .from('leads')
    .insert({
      nome: `[SEC-TEST] Lead ${label}`, telefone: '(99) 90000-0000', cidade: 'Teste',
      origem: 'Captação ativa', etapa: 'leads', obs: `SEC-TEST ${SUFFIX}`,
      responsavel_id: responsavelId, workspace_id: workspaceId,
    })
    .select('id').single();
  if (leadErr) throw new Error(`criar lead ${label}: ${leadErr.message}`);

  const { data: obra, error: obraErr } = await sb
    .from('obras')
    .insert({
      cliente: `[SEC-TEST] Obra ${label}`, nome: `[SEC-TEST] Obra ${label}`,
      telefone: '(99) 90000-0000', cidade: 'Teste', modalidade: 'Terreno próprio',
      etapa: 'projeto', progresso: 10, obs: `SEC-TEST ${SUFFIX}`,
      responsavel_id: responsavelId, workspace_id: workspaceId,
    })
    .select('id').single();
  if (obraErr) throw new Error(`criar obra ${label}: ${obraErr.message}`);

  const { data: lanc, error: lancErr } = await sb
    .from('lancamentos')
    .insert({
      descricao: `[SEC-TEST] Lançamento ${label}`, valor: 1, tipo: 'entrada',
      categoria: 'Receita diversa', grupo: 'Receita Outras', data: hoje,
      data_vencimento: hoje, data_confirmacao: hoje, forma_pagamento: 'Pix',
      status_pagamento: 'pago', obra_id: obra.id, obs: `SEC-TEST ${SUFFIX}`,
      workspace_id: workspaceId,
    })
    .select('id').single();
  if (lancErr) throw new Error(`criar lançamento ${label}: ${lancErr.message}`);

  const path = `${obra.id}/testes/sec-test-${SUFFIX}.txt`;
  const { error: upErr } = await sb.storage.from(BUCKET).upload(
    path,
    new Blob([`arquivo de teste de segurança — ${label} — ${SUFFIX}`], { type: 'text/plain' }),
    { contentType: 'text/plain' },
  );
  if (upErr) throw new Error(`upload storage ${label}: ${upErr.message}`);
  cleanup.storagePaths.push(path);

  return { leadId: lead.id, obraId: obra.id, lancId: lanc.id, storagePath: path };
}

async function loginComo(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return client;
}

async function testarIsolamento(nomeAtacante, clienteAtacante, alvo) {
  const { data: leadData } = await clienteAtacante.from('leads').select('id').eq('id', alvo.leadId);
  registrar(`${nomeAtacante} NÃO lê lead do outro workspace`, (leadData ?? []).length === 0, `${(leadData ?? []).length} linha(s) retornada(s)`);

  const { data: obraData } = await clienteAtacante.from('obras').select('id').eq('id', alvo.obraId);
  registrar(`${nomeAtacante} NÃO lê obra do outro workspace`, (obraData ?? []).length === 0, `${(obraData ?? []).length} linha(s) retornada(s)`);

  const { data: lancData } = await clienteAtacante.from('lancamentos').select('id').eq('id', alvo.lancId);
  registrar(`${nomeAtacante} NÃO lê lançamento do outro workspace`, (lancData ?? []).length === 0, `${(lancData ?? []).length} linha(s) retornada(s)`);

  const { data: delData } = await clienteAtacante.from('obras').delete().eq('id', alvo.obraId).select('id');
  registrar(`${nomeAtacante} NÃO apaga obra do outro workspace`, (delData ?? []).length === 0, `${(delData ?? []).length} linha(s) apagada(s)`);

  const { error: dlErr } = await clienteAtacante.storage.from(BUCKET).download(alvo.storagePath);
  registrar(`${nomeAtacante} NÃO baixa arquivo do outro workspace`, !!dlErr, dlErr ? dlErr.message : 'download funcionou (FALHA GRAVE)');
}

async function testarControlePositivo(nome, cliente, proprio) {
  const { data: leadData } = await cliente.from('leads').select('id').eq('id', proprio.leadId);
  registrar(`${nome} lê o próprio lead normalmente`, (leadData ?? []).length === 1, `${(leadData ?? []).length} linha(s) retornada(s)`);

  const { data: dl, error: dlErr } = await cliente.storage.from(BUCKET).download(proprio.storagePath);
  registrar(`${nome} baixa o próprio arquivo normalmente`, !dlErr && !!dl, dlErr?.message);
}

async function main() {
  console.log(`\n🔒  Teste de isolamento entre workspaces — execução ${SUFFIX}\n`);

  const tenantA = await criarTenant('A');
  const tenantB = await criarTenant('B');
  console.log(`Workspace A: ${tenantA.workspaceId}`);
  console.log(`Workspace B: ${tenantB.workspaceId}\n`);

  const dadosA = await popularDados(tenantA.workspaceId, tenantA.userId, 'A');
  const dadosB = await popularDados(tenantB.workspaceId, tenantB.userId, 'B');

  const clienteA = await loginComo(tenantA.email);
  const clienteB = await loginComo(tenantB.email);

  console.log('\n─ Controles positivos (confirma que a query em si funciona) ───');
  await testarControlePositivo('Usuário A', clienteA, dadosA);
  await testarControlePositivo('Usuário B', clienteB, dadosB);

  console.log('\n─ Isolamento cross-tenant ──────────────────────────────────────');
  await testarIsolamento('Usuário A', clienteA, dadosB);
  await testarIsolamento('Usuário B', clienteB, dadosA);

  console.log('\n─ Resumo ───────────────────────────────────────────────────────');
  const falhas = resultados.filter((r) => !r.ok);
  console.log(`${resultados.length - falhas.length}/${resultados.length} passaram`);
  if (falhas.length > 0) {
    console.log('\n🚨 FALHAS DE ISOLAMENTO ENCONTRADAS:');
    for (const f of falhas) console.log(`   - ${f.nome} (${f.detalhe})`);
  } else {
    console.log('\n✅ Nenhuma falha de isolamento encontrada.');
  }

  return falhas.length === 0;
}

async function limpar() {
  console.log('\n─ Limpeza ──────────────────────────────────────────────────────');
  for (const path of cleanup.storagePaths) {
    const { error } = await sb.storage.from(BUCKET).remove([path]);
    console.log(`${error ? '✗' : '✓'} storage: ${path}${error ? ' — ' + error.message : ''}`);
  }
  const { error: lancErr } = await sb.from('lancamentos').delete().in('workspace_id', cleanup.workspaces);
  console.log(`${lancErr ? '✗' : '✓'} lancamentos${lancErr ? ' — ' + lancErr.message : ''}`);
  const { error: obraErr } = await sb.from('obras').delete().in('workspace_id', cleanup.workspaces);
  console.log(`${obraErr ? '✗' : '✓'} obras${obraErr ? ' — ' + obraErr.message : ''}`);
  const { error: leadErr } = await sb.from('leads').delete().in('workspace_id', cleanup.workspaces);
  console.log(`${leadErr ? '✗' : '✓'} leads${leadErr ? ' — ' + leadErr.message : ''}`);
  for (const userId of cleanup.userIds) {
    await sb.from('profiles').delete().eq('id', userId);
    const { error } = await sb.auth.admin.deleteUser(userId);
    console.log(`${error ? '✗' : '✓'} usuário ${userId}${error ? ' — ' + error.message : ''}`);
  }
  const { error: wsErr } = await sb.from('workspaces').delete().in('id', cleanup.workspaces);
  console.log(`${wsErr ? '✗' : '✓'} workspaces${wsErr ? ' — ' + wsErr.message : ''}`);
}

let ok = false;
try {
  ok = await main();
} catch (err) {
  console.error('\n💥 Erro durante o teste:', err.message);
} finally {
  await limpar();
}

console.log(ok ? '\n✅ security-test.mjs: PASSOU\n' : '\n❌ security-test.mjs: FALHOU\n');
process.exit(ok ? 0 : 1);
