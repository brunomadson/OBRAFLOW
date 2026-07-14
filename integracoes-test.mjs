// integracoes-test.mjs — Sprint 11.1 (Etapa 9)
// Testa a arquitetura nova de integrações: colunas/tabelas da migration
// 043, bloqueio de coluna de credencial, has_feature() com 'essential',
// isolamento entre workspaces, e RBAC nas rotas /api/integrations/*.
//
// Rodar com: npm run dev (outro terminal) + node --env-file=.env.local integracoes-test.mjs

import { createClient } from '@supabase/supabase-js';
import { sb } from './supabase-admin.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SENHA = 'IntegTest_2026!';
const MARKER = 'INTEG_TEST';
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

async function criarWorkspaceComCargo(nome, nomeCargo, email) {
  const { data: ws } = await sb.from('workspaces').insert({ nome: `[${MARKER}] ${nome}`, tipo_conta: 'PJ', ativo: true }).select('id').single();
  const { data: cargo } = await sb.from('cargos').select('id').eq('workspace_id', ws.id).eq('nome', nomeCargo).single();
  const { data: u } = await sb.auth.admin.createUser({ email, password: SENHA, email_confirm: true });
  await sb.from('profiles').update({ workspace_id: ws.id, cargo_id: cargo.id }).eq('id', u.user.id);
  return { workspaceId: ws.id, userId: u.user.id };
}

const suffix = Date.now().toString(36);
const criados = { workspaces: [], users: [] };

try {
  console.log('\n🔌  Sprint 11.1 — integrações (schema, has_feature, RLS, rotas)\n');

  const A = await criarWorkspaceComCargo(`WS-A-${suffix}`, 'CEO / Dono', `integ-ceo-a-${suffix}@teste.local`);
  criados.workspaces.push(A.workspaceId); criados.users.push(A.userId);
  const { data: cargoSdr } = await sb.from('cargos').select('id').eq('workspace_id', A.workspaceId).eq('nome', 'SDR / Vendedor').single();
  const { data: uSdr } = await sb.auth.admin.createUser({ email: `integ-sdr-a-${suffix}@teste.local`, password: SENHA, email_confirm: true });
  await sb.from('profiles').update({ workspace_id: A.workspaceId, cargo_id: cargoSdr.id }).eq('id', uSdr.user.id);
  criados.users.push(uSdr.user.id);

  const B = await criarWorkspaceComCargo(`WS-B-${suffix}`, 'CEO / Dono', `integ-ceo-b-${suffix}@teste.local`);
  criados.workspaces.push(B.workspaceId); criados.users.push(B.userId);

  const { data: planoBasico } = await sb.from('planos').select('id').eq('codigo', 'basico').single();
  await sb.from('subscriptions').insert({ workspace_id: A.workspaceId, plan_id: planoBasico.id, gateway_provider: 'manual', status: 'active', subscription_start: new Date().toISOString() });
  await sb.from('subscriptions').insert({ workspace_id: B.workspaceId, plan_id: planoBasico.id, gateway_provider: 'manual', status: 'active', subscription_start: new Date().toISOString() });

  const ceoA = await loginComo(`integ-ceo-a-${suffix}@teste.local`);
  const sdrA = await loginComo(`integ-sdr-a-${suffix}@teste.local`);
  const ceoB = await loginComo(`integ-ceo-b-${suffix}@teste.local`);

  console.log('─ Catálogo e disponibilidade por plano ────────────────────────');
  const { data: gdrive } = await ceoA.from('integracoes').select('id, codigo, tipo_acesso, provider, categoria').eq('codigo', 'google_drive').single();
  registrar('google_drive tem tipo_acesso=essential e provider=google', gdrive.tipo_acesso === 'essential' && gdrive.provider === 'google', JSON.stringify(gdrive));

  const { data: hfDrive } = await ceoA.rpc('has_feature', { p_workspace_id: A.workspaceId, p_feature_codigo: 'google_drive' });
  registrar('has_feature(google_drive) = true no plano básico (essential)', hfDrive === true, hfDrive);
  const { data: hfWhats } = await ceoA.rpc('has_feature', { p_workspace_id: A.workspaceId, p_feature_codigo: 'whatsapp' });
  registrar('has_feature(whatsapp) = false no plano básico (premium)', hfWhats === false, hfWhats);

  // A linha precisa existir DE VERDADE (com credential real) antes de
  // testar o bloqueio — testar contra uma tabela vazia não prova nada
  // (achado numa rodada anterior: SELECT numa tabela sem linha visível
  // não gera erro de privilégio nenhum, só data: [], mascarando um
  // vazamento real).
  const { data: wiA } = await sb.from('workspace_integracoes').upsert(
    { workspace_id: A.workspaceId, integracao_id: gdrive.id, status: 'conectado', conectado_em: new Date().toISOString(), credentials_encrypted: 'SEGREDO_TESTE_NAO_DEVE_VAZAR' },
    { onConflict: 'workspace_id,integracao_id' }
  ).select('id').single();

  console.log('\n─ Coluna de credencial bloqueada pro client ────────────────────');
  const { data: dataSelectCred, error: erroSelectCred } = await ceoA.from('workspace_integracoes').select('credentials_encrypted').eq('id', wiA.id);
  const vazou = (dataSelectCred ?? []).some((r) => r.credentials_encrypted != null);
  registrar('SELECT credentials_encrypted pelo client autenticado é recusado (linha real existe)', !!erroSelectCred && !vazou, erroSelectCred?.message ?? `SEM ERRO — vazou: ${JSON.stringify(dataSelectCred)}`);
  const { data: dataOutrasColunas, error: erroOutrasColunas } = await ceoA.from('workspace_integracoes').select('id, status, settings').eq('id', wiA.id);
  registrar('outras colunas continuam legíveis normalmente', !erroOutrasColunas && (dataOutrasColunas ?? []).length === 1, erroOutrasColunas?.message ?? `${(dataOutrasColunas ?? []).length} linha(s)`);

  console.log('\n─ Escrita direta bloqueada (só service_role escreve) ───────────');
  const { data: writeAttempt } = await ceoA.from('workspace_integracoes').insert({ integracao_id: gdrive.id, status: 'conectado' }).select('id');
  registrar('CEO NÃO consegue forjar status=conectado via INSERT direto', (writeAttempt ?? []).length === 0, `${(writeAttempt ?? []).length} linha(s)`);

  console.log('\n─ workspace_integration_logs ────────────────────────────────');
  await sb.from('workspace_integration_logs').insert({ workspace_id: A.workspaceId, workspace_integracao_id: wiA.id, evento: 'conectado', detalhe: 'seed de teste' });
  const { data: logsA } = await ceoA.from('workspace_integration_logs').select('id').eq('workspace_integracao_id', wiA.id);
  registrar('CEO de A vê o próprio log de conexão', (logsA ?? []).length === 1, `${(logsA ?? []).length} linha(s)`);
  const { data: logsB } = await ceoB.from('workspace_integration_logs').select('id').eq('workspace_integracao_id', wiA.id);
  registrar('CEO de B NÃO vê log de conexão de A (cross-tenant)', (logsB ?? []).length === 0, `${(logsB ?? []).length} linha(s)`);
  const { data: logsSdr } = await sdrA.from('workspace_integration_logs').select('id').eq('workspace_integracao_id', wiA.id);
  registrar('SDR de A (sem permissão integracoes) NÃO vê log', (logsSdr ?? []).length === 0, `${(logsSdr ?? []).length} linha(s)`);

  console.log('\n─ Rotas /api/integrations (contra npm run dev) ─────────────────');
  // As rotas leem sessão via cookie (createClient de server.ts) — uma
  // chamada direta de Node não carrega cookie de navegador nenhum, então
  // o resultado esperado é sempre 401. Isso já confirma que a rota não
  // deixa passar sem sessão de verdade (não existe bypass via header solto).
  let httpOk = true;
  try {
    const resStatus = await fetch(`${APP_URL}/api/integrations/google_drive/status`);
    registrar('rota /status sem sessão de navegador → 401', resStatus.status === 401, resStatus.status);

    const resConnect = await fetch(`${APP_URL}/api/integrations/whatsapp/connect`);
    registrar('rota /connect sem sessão de navegador → 401 (não quebra o servidor)', resConnect.status === 401, resConnect.status);
  } catch (e) {
    httpOk = false;
    registrar('bloco de testes HTTP rodou sem exceção', false, e.message + ' — npm run dev está rodando em ' + APP_URL + '?');
  }
  void httpOk;

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
console.log(falhas.length === 0 ? '\n✅ integracoes-test.mjs: PASSOU\n' : '\n❌ integracoes-test.mjs: FALHOU\n');
process.exit(falhas.length === 0 ? 0 : 1);
