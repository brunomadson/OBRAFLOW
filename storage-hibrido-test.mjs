// storage-hibrido-test.mjs — Sprint 11.2
// Testa: schema/RLS de document_storage_sync e entity_storage_folders,
// troca de storage_provider (com trava de "precisa estar conectado"), e o
// mecanismo de fallback+fila de pendência de verdade — sem precisar de
// credencial real do Google (o fallback é exatamente o que acontece
// quando a conexão falha, então testamos com o workspace marcado como
// "google_drive" mas SEM conexão real: deve cair pro Supabase e marcar
// pendente_migracao, sem quebrar o upload do usuário).
//
// Rodar com: npm run dev (outro terminal) + node --env-file=.env.local storage-hibrido-test.mjs

import { createClient } from '@supabase/supabase-js';
import { sb } from './supabase-admin.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SENHA = 'StorageTest_2026!';
const MARKER = 'STORAGE_TEST';
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
  const { data: cargo } = await sb.from('cargos').select('id').eq('workspace_id', ws.id).eq('nome', 'CEO / Dono').single();
  const { data: u } = await sb.auth.admin.createUser({ email, password: SENHA, email_confirm: true });
  await sb.from('profiles').update({ workspace_id: ws.id, cargo_id: cargo.id }).eq('id', u.user.id);
  return { workspaceId: ws.id, userId: u.user.id };
}

const suffix = Date.now().toString(36);
const criados = { workspaces: [], users: [], leadIds: [] };

// Cookie jar simples pra chamar as rotas HTTP autenticado de verdade
// (as rotas leem sessão via cookie, não Bearer — ver Sprint 9/11.1).
function parseCookies(setCookieHeaders) {
  const jar = {};
  for (const h of setCookieHeaders ?? []) {
    const [pair] = h.split(';');
    const idx = pair.indexOf('=');
    jar[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
  return jar;
}
function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function loginHttp(email) {
  // Login via password contra o endpoint de token do GoTrue, pegando os
  // tokens e escrevendo o cookie no MESMO formato que @supabase/ssr usa
  // (sb-<project-ref>-auth-token, JSON stringificado + base64).
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login http ${email}: ${error.message}`);

  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const payload = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    token_type: 'bearer',
    user: data.user,
  };
  const cookieValue = 'base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
  return { [cookieName]: encodeURIComponent(cookieValue) };
}

try {
  console.log('\n📦  Sprint 11.2 — storage híbrido (schema, RLS, fallback real)\n');

  const A = await criarWorkspaceComCeo(`WS-A-${suffix}`, `storage-ceo-a-${suffix}@teste.local`);
  criados.workspaces.push(A.workspaceId); criados.users.push(A.userId);
  const B = await criarWorkspaceComCeo(`WS-B-${suffix}`, `storage-ceo-b-${suffix}@teste.local`);
  criados.workspaces.push(B.workspaceId); criados.users.push(B.userId);

  const ceoA = await loginComo(`storage-ceo-a-${suffix}@teste.local`);
  const ceoB = await loginComo(`storage-ceo-b-${suffix}@teste.local`);

  console.log('─ Schema básico ────────────────────────────────────────────────');
  const { data: wsCheck } = await sb.from('workspaces').select('storage_provider').eq('id', A.workspaceId).single();
  registrar('workspaces.storage_provider default = supabase', wsCheck?.storage_provider === 'supabase', wsCheck?.storage_provider);

  const { error: checkErr } = await sb.from('workspaces').update({ storage_provider: 'invalido' }).eq('id', A.workspaceId);
  registrar('CHECK constraint rejeita storage_provider inválido', !!checkErr, checkErr?.message);

  console.log('\n─ entity_storage_folders: RLS ───────────────────────────────────');
  const { data: pastaTeste } = await sb.from('entity_storage_folders').insert({
    workspace_id: A.workspaceId, provider: 'google_drive', chave: `${MARKER}:root`, external_folder_id: 'fake123', nome_pasta: 'OBRAFLOW',
  }).select('id').single();
  const { data: pastaVeA } = await ceoA.from('entity_storage_folders').select('id').eq('id', pastaTeste.id);
  registrar('CEO de A vê a própria pasta cadastrada', (pastaVeA ?? []).length === 1, `${(pastaVeA ?? []).length} linha(s)`);
  const { data: pastaVeB } = await ceoB.from('entity_storage_folders').select('id').eq('id', pastaTeste.id);
  registrar('CEO de B NÃO vê pasta de A (cross-tenant)', (pastaVeB ?? []).length === 0, `${(pastaVeB ?? []).length} linha(s)`);
  const { data: pastaInsertDireto } = await ceoA.from('entity_storage_folders').insert({ workspace_id: A.workspaceId, provider: 'google_drive', chave: 'x', external_folder_id: 'y', nome_pasta: 'z' }).select('id');
  registrar('CEO NÃO consegue INSERT direto em entity_storage_folders (só backend)', (pastaInsertDireto ?? []).length === 0, `${(pastaInsertDireto ?? []).length} linha(s)`);

  console.log('\n─ document_storage_sync: RLS herdada de documentos ──────────────');
  const { data: leadA } = await sb.from('leads').insert({ nome: `[${MARKER}] Cliente A`, telefone: '(99) 90000-0000', cidade: 'Teste', origem: 'Captação ativa', etapa: 'documentacao', obs: MARKER, workspace_id: A.workspaceId }).select('id').single();
  criados.leadIds.push(leadA.id);
  const { data: docA } = await sb.from('documentos').insert({ lead_id: leadA.id, secao: 'pessoal', tipo_doc: 'cnh_rg', nome_arquivo: `${MARKER}.pdf`, storage_path: `${leadA.id}/pessoal/${MARKER}.pdf`, workspace_id: A.workspaceId }).select('id').single();
  const { data: syncRow } = await sb.from('document_storage_sync').insert({ workspace_id: A.workspaceId, documento_id: docA.id, provider: 'google_drive', external_file_id: 'file123', sync_status: 'sincronizado' }).select('id').single();

  const { data: syncVeA } = await ceoA.from('document_storage_sync').select('id').eq('id', syncRow.id);
  registrar('CEO de A vê o sync do próprio documento', (syncVeA ?? []).length === 1, `${(syncVeA ?? []).length} linha(s)`);
  const { data: syncVeB } = await ceoB.from('document_storage_sync').select('id').eq('id', syncRow.id);
  registrar('CEO de B NÃO vê sync de documento de A (herda RLS de documentos)', (syncVeB ?? []).length === 0, `${(syncVeB ?? []).length} linha(s)`);

  console.log('\n─ /api/storage/provider — trava de "precisa estar conectado" ──');
  const jarA = await loginHttp(`storage-ceo-a-${suffix}@teste.local`);
  const rProviderSemConexao = await fetch(`${APP_URL}/api/storage/provider`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(jarA) },
    body: JSON.stringify({ provider: 'google_drive' }),
  });
  registrar('trocar pra google_drive SEM conexão real → 400 (bloqueado)', rProviderSemConexao.status === 400, rProviderSemConexao.status);

  const rProviderSupabase = await fetch(`${APP_URL}/api/storage/provider`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(jarA) },
    body: JSON.stringify({ provider: 'supabase' }),
  });
  registrar('trocar pra supabase (sempre permitido) → 200', rProviderSupabase.status === 200, rProviderSupabase.status);

  console.log('\n─ Upload híbrido de verdade: fallback quando não há conexão real ─');
  // Marca o workspace como "google_drive" diretamente no banco (bypassa a
  // trava da rota, simula um estado real de "conectou uma vez, token
  // expirou/foi revogado depois") — o objetivo aqui é testar o
  // MECANISMO DE FALLBACK, não a trava de UI (já testada acima).
  await sb.from('workspaces').update({ storage_provider: 'google_drive' }).eq('id', A.workspaceId);

  const form = new FormData();
  const conteudo = new Blob([`conteudo de teste ${MARKER}`], { type: 'text/plain' });
  form.append('file', conteudo, 'teste.txt');
  form.append('lead_id', leadA.id);
  form.append('secao', 'pessoal');
  form.append('tipo_doc', 'cnh_rg');

  const rUpload = await fetch(`${APP_URL}/api/storage/documentos`, { method: 'POST', headers: { Cookie: cookieHeader(jarA) }, body: form });
  const uploadBody = await rUpload.json();
  registrar('upload com storage_provider=google_drive SEM conexão real → ainda assim 200 (fallback)', rUpload.status === 200, JSON.stringify(uploadBody).slice(0, 200));

  if (rUpload.status === 200) {
    const { data: syncFallback } = await sb.from('document_storage_sync').select('sync_status, provider').eq('documento_id', uploadBody.documento.id).maybeSingle();
    registrar('documento ficou marcado como pendente_migracao (não perdeu o arquivo)', syncFallback?.sync_status === 'pendente_migracao' && syncFallback?.provider === 'google_drive', JSON.stringify(syncFallback));

    const { data: docCriado } = await sb.from('documentos').select('storage_path').eq('id', uploadBody.documento.id).single();
    const { data: bytesReais, error: downloadErr } = await sb.storage.from('documentos').download(docCriado.storage_path);
    registrar('o arquivo está fisicamente no Supabase (reserva funcionou de verdade)', !downloadErr && !!bytesReais, downloadErr?.message ?? 'ok');

    console.log('\n─ Exclusão de documento pendente não deixa lixo ─────────────────');
    const rDelete = await fetch(`${APP_URL}/api/storage/documentos/${uploadBody.documento.id}`, { method: 'DELETE', headers: { Cookie: cookieHeader(jarA) } });
    const deleteBody = await rDelete.json();
    registrar('DELETE de documento pendente → 200, removerDoSupabase=true', rDelete.status === 200 && deleteBody.removerDoSupabase === true, JSON.stringify(deleteBody));
    const { data: syncOrfao } = await sb.from('document_storage_sync').select('id').eq('documento_id', uploadBody.documento.id);
    registrar('linha de document_storage_sync foi limpa (não fica órfã)', (syncOrfao ?? []).length === 0, `${(syncOrfao ?? []).length} linha(s)`);
  }

} finally {
  console.log('\n─ Limpeza ──────────────────────────────────────────────────────');
  await sb.from('documentos').delete().ilike('nome_arquivo', `%${MARKER}%`);
  for (const leadId of criados.leadIds) await sb.from('leads').delete().eq('id', leadId);
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
console.log(falhas.length === 0 ? '\n✅ storage-hibrido-test.mjs: PASSOU\n' : '\n❌ storage-hibrido-test.mjs: FALHOU\n');
process.exit(falhas.length === 0 ? 0 : 1);
