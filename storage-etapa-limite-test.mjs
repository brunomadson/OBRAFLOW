// storage-etapa-limite-test.mjs
// Testa os 2 itens desta rodada: (1) mover pasta da obra entre categorias
// só quando a etapa cruza a fronteira processos/andamento/entregues, e
// (2) cálculo de uso de armazenamento + aviso de 80%.
//
// Rodar com: npm run dev (outro terminal) + node --env-file=.env.local storage-etapa-limite-test.mjs

import { createClient } from '@supabase/supabase-js';
import { sb } from './supabase-admin.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SENHA = 'EtapaLimite_2026!';
const MARKER = 'ETAPA_LIMITE_TEST';
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const resultados = [];
function registrar(nome, ok, detalhe) {
  resultados.push({ nome, ok, detalhe });
  console.log(`${ok ? '✅' : '❌'} ${nome}${detalhe ? ' — ' + detalhe : ''}`);
}

async function loginHttp(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login http ${email}: ${error.message}`);
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const payload = { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at, token_type: 'bearer', user: data.user };
  const cookieValue = 'base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
  return { [cookieName]: encodeURIComponent(cookieValue) };
}
function cookieHeader(jar) { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); }

async function criarWorkspaceComCeo(nome, email) {
  const { data: ws } = await sb.from('workspaces').insert({ nome: `[${MARKER}] ${nome}`, tipo_conta: 'PJ', ativo: true }).select('id').single();
  const { data: cargo } = await sb.from('cargos').select('id').eq('workspace_id', ws.id).eq('nome', 'CEO / Dono').single();
  const { data: u } = await sb.auth.admin.createUser({ email, password: SENHA, email_confirm: true });
  await sb.from('profiles').update({ workspace_id: ws.id, cargo_id: cargo.id }).eq('id', u.user.id);
  return { workspaceId: ws.id, userId: u.user.id };
}

const suffix = Date.now().toString(36);
const criados = { workspaces: [], users: [], obraIds: [], leadIds: [], planoIdOriginalLimit: null };

try {
  console.log('\n📂  Mover pasta por etapa da obra + limite de armazenamento\n');

  const A = await criarWorkspaceComCeo(`WS-A-${suffix}`, `etapa-limite-ceo-a-${suffix}@teste.local`);
  criados.workspaces.push(A.workspaceId); criados.users.push(A.userId);

  const { data: leadA } = await sb.from('leads').insert({ nome: `[${MARKER}] Cliente`, telefone: '(99) 90000-0000', cidade: 'Teste', origem: 'Captação ativa', etapa: 'documentacao', obs: MARKER, workspace_id: A.workspaceId }).select('id').single();
  criados.leadIds.push(leadA.id);
  const { data: obraA } = await sb.from('obras').insert({ cliente: `[${MARKER}] Cliente`, nome: `[${MARKER}] Cliente`, cidade: 'Teste', modalidade: 'Terreno próprio', etapa: 'licencas', progresso: 10, obs: MARKER, workspace_id: A.workspaceId, lead_id: leadA.id }).select('id').single();
  criados.obraIds.push(obraA.id);

  await sb.from('workspaces').update({ storage_provider: 'google_drive' }).eq('id', A.workspaceId);

  console.log('─ Mover pasta da obra: só cruza fronteira de categoria ─────────');
  const jarA = await loginHttp(`etapa-limite-ceo-a-${suffix}@teste.local`);

  // licencas → contrato: as duas caem em "obras_processos" — não deve
  // tentar mover nada (sem pasta cadastrada nenhuma ainda, então se
  // TENTASSE mover, moveDriveItem falharia por falta de credencial real —
  // um 200 aqui confirma que nem chegou a tentar).
  const rMesmaCategoria = await fetch(`${APP_URL}/api/storage/obras/${obraA.id}/folder-event`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(jarA) },
    body: JSON.stringify({ etapaAnterior: 'licencas', novaEtapa: 'contrato' }),
  });
  const bodyMesmaCategoria = await rMesmaCategoria.json();
  registrar('licencas → contrato (mesma categoria) → 200 sem tentar mover (nem busca token)', rMesmaCategoria.status === 200 && bodyMesmaCategoria.skip, JSON.stringify(bodyMesmaCategoria));

  // contrato → execucao: cruza processos → andamento de verdade. Sem
  // conexão real com o Google (este teste não tem credencial OAuth de
  // verdade), a rota corretamente FALHA ao tentar buscar o token — é o
  // comportamento certo (não dá pra mover pasta nenhuma sem conexão
  // válida). O caminho "pasta ainda não existe, mas a conexão É válida"
  // (moverObraEtapa retornando em silêncio) só é verificável com Google
  // Cloud configurado de verdade — mesma lacuna já registrada nos
  // relatórios anteriores.
  const rCruzaCategoria = await fetch(`${APP_URL}/api/storage/obras/${obraA.id}/folder-event`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(jarA) },
    body: JSON.stringify({ etapaAnterior: 'contrato', novaEtapa: 'execucao' }),
  });
  registrar('contrato → execucao (cruza categoria) sem conexão real → 500 (falha esperada, não crash)', rCruzaCategoria.status === 500, rCruzaCategoria.status);

  // Sem storage_provider=google_drive → sempre no-op rápido, mesmo com etapa cruzando fronteira.
  await sb.from('workspaces').update({ storage_provider: 'supabase' }).eq('id', A.workspaceId);
  const rSupabase = await fetch(`${APP_URL}/api/storage/obras/${obraA.id}/folder-event`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(jarA) },
    body: JSON.stringify({ etapaAnterior: 'execucao', novaEtapa: 'entregue' }),
  });
  const bodySupabase = await rSupabase.json();
  registrar('workspace em supabase → skip explícito, não tenta Drive', rSupabase.status === 200 && bodySupabase.skip, JSON.stringify(bodySupabase));

  console.log('\n─ Uso de armazenamento / limite do plano ───────────────────────');
  const { data: planoBasico } = await sb.from('planos').select('id, storage_limit_mb').eq('codigo', 'basico').single();
  criados.planoIdOriginalLimit = { id: planoBasico.id, valorOriginal: planoBasico.storage_limit_mb };
  await sb.from('planos').update({ storage_limit_mb: 1 }).eq('id', planoBasico.id); // 1MB — fácil de estourar com pouco dado de teste
  await sb.from('subscriptions').insert({ workspace_id: A.workspaceId, plan_id: planoBasico.id, gateway_provider: 'manual', status: 'active', subscription_start: new Date().toISOString() });

  // 3 documentos: 1 puro Supabase (conta), 1 pendente_migracao (conta,
  // fisicamente ainda no Supabase), 1 sincronizado no Drive (NÃO conta).
  const tamanhoMb1 = 420 * 1024; // 420KB x 2 = ~82% de 1MB — cruza o limiar de 80%
  const { data: doc1 } = await sb.from('documentos').insert({ lead_id: leadA.id, secao: 'pessoal', tipo_doc: 'cnh_rg', nome_arquivo: `${MARKER}_1.pdf`, storage_path: `x/1.pdf`, tamanho_bytes: tamanhoMb1, workspace_id: A.workspaceId }).select('id').single();
  const { data: doc2 } = await sb.from('documentos').insert({ lead_id: leadA.id, secao: 'pessoal', tipo_doc: 'ctps', nome_arquivo: `${MARKER}_2.pdf`, storage_path: `x/2.pdf`, tamanho_bytes: tamanhoMb1, workspace_id: A.workspaceId }).select('id').single();
  await sb.from('document_storage_sync').insert({ workspace_id: A.workspaceId, documento_id: doc2.id, provider: 'google_drive', sync_status: 'pendente_migracao' });
  const { data: doc3 } = await sb.from('documentos').insert({ lead_id: leadA.id, secao: 'pessoal', tipo_doc: 'comp_renda', nome_arquivo: `${MARKER}_3.pdf`, storage_path: `x/3.pdf`, tamanho_bytes: 5 * 1024 * 1024, workspace_id: A.workspaceId }).select('id').single();
  await sb.from('document_storage_sync').insert({ workspace_id: A.workspaceId, documento_id: doc3.id, provider: 'google_drive', external_file_id: 'fake', sync_status: 'sincronizado' });

  const rUsage = await fetch(`${APP_URL}/api/storage/usage`, { headers: { Cookie: cookieHeader(jarA) } });
  const usage = await rUsage.json();
  const usadoEsperadoMb = Math.round(((tamanhoMb1 * 2) / (1024 * 1024)) * 10) / 10;
  registrar('uso conta só documentos físicos no Supabase (ignora o sincronizado no Drive)', Math.abs(usage.usedMb - usadoEsperadoMb) < 0.05, `esperado ~${usadoEsperadoMb}MB, veio ${usage.usedMb}MB`);
  registrar('limite do plano (1MB) reconhecido e percentUsed calculado', usage.limitMb === 1 && usage.percentUsed >= 80, JSON.stringify(usage));

  criados.leadIds.push('nao-apagar-de-novo'); // placeholder pra não duplicar limpeza abaixo
  await sb.from('documentos').delete().in('id', [doc1.id, doc2.id, doc3.id]);

} finally {
  console.log('\n─ Limpeza ──────────────────────────────────────────────────────');
  if (criados.planoIdOriginalLimit) {
    await sb.from('planos').update({ storage_limit_mb: criados.planoIdOriginalLimit.valorOriginal }).eq('id', criados.planoIdOriginalLimit.id);
  }
  await sb.from('documentos').delete().ilike('nome_arquivo', `%${MARKER}%`);
  for (const obraId of criados.obraIds) await sb.from('obras').delete().eq('id', obraId);
  for (const leadId of criados.leadIds) { if (leadId !== 'nao-apagar-de-novo') await sb.from('leads').delete().eq('id', leadId); }
  for (const uid of criados.users) {
    try { await sb.from('profiles').delete().eq('id', uid); } catch { /* segue limpeza */ }
    try { await sb.auth.admin.deleteUser(uid); } catch { /* segue limpeza */ }
  }
  for (const wid of criados.workspaces) {
    try { await sb.from('workspaces').delete().eq('id', wid); } catch { /* segue limpeza */ }
  }
  console.log(`✓ limpeza concluída (limite original do plano básico restaurado)`);
}

console.log('\n─ Resumo ───────────────────────────────────────────────────────');
const falhas = resultados.filter((r) => !r.ok);
console.log(`${resultados.length - falhas.length}/${resultados.length} passaram`);
if (falhas.length > 0) {
  console.log('\n🚨 FALHAS:');
  for (const f of falhas) console.log(`   - ${f.nome} (${f.detalhe})`);
}
console.log(falhas.length === 0 ? '\n✅ storage-etapa-limite-test.mjs: PASSOU\n' : '\n❌ storage-etapa-limite-test.mjs: FALHOU\n');
process.exit(falhas.length === 0 ? 0 : 1);
