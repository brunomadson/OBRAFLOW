// rbac-documentos-test.mjs
// Sprint 7.2 — testes obrigatórios de documentos, storage e histórico.
// Usa os 6 usuários reais já criados por rbac-validacao-setup.mjs, no
// workspace "ObraFlow Padrão". Só apaga a própria fixture (leads/obras/
// documentos marcados) — usuários continuam existindo.
//
// Rodar com: node --env-file=.env.local rbac-documentos-test.mjs

import { createClient } from '@supabase/supabase-js';
import { sb } from './supabase-admin.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SENHA = 'RbacValidacao_2026!';
const WORKSPACE_NOME = 'ObraFlow Padrão';
const MARKER = 'RBAC_DOCS_TEST';

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

function fixtureLead(workspaceId, nome) {
  return { nome: `[${MARKER}] ${nome}`, telefone: '(99) 90000-0000', cidade: 'Teste', origem: 'Captação ativa', etapa: 'leads', obs: MARKER, workspace_id: workspaceId };
}
function fixtureObra(workspaceId, nome, leadId) {
  return { cliente: `[${MARKER}] ${nome}`, nome: `[${MARKER}] ${nome}`, telefone: '(99) 90000-0000', cidade: 'Teste', modalidade: 'Terreno próprio', etapa: 'projeto', progresso: 10, obs: MARKER, workspace_id: workspaceId, lead_id: leadId ?? null };
}
function fixtureDocumento({ leadId, obraId, workspaceId, usuarioId }) {
  return {
    lead_id: leadId ?? null, obra_id: obraId ?? null, secao: 'pessoal', tipo_doc: 'cnh_rg',
    nome_arquivo: `${MARKER}.pdf`, storage_path: `${leadId ?? obraId}/pessoal/${MARKER}_${Date.now()}.pdf`,
    workspace_id: workspaceId, usuario_id: usuarioId ?? null,
  };
}

const { data: ws } = await sb.from('workspaces').select('id').eq('nome', WORKSPACE_NOME).single();
const workspaceId = ws.id;
console.log(`\n🔒  Testes de documentos/storage/histórico — workspace ${WORKSPACE_NOME} (${workspaceId})\n`);

const { data: profs } = await sb.from('profiles').select('id, nome').ilike('nome', 'RBAC Teste%');
const idPorNome = Object.fromEntries((profs ?? []).map((p) => [p.nome, p.id]));

// ─── Fixtures ────────────────────────────────────────────────────────────────
// leadA: nunca vira obra (comercial puro)
const { data: leadA } = await sb.from('leads').insert(fixtureLead(workspaceId, 'Lead A (comercial puro)')).select('id').single();
// leadB → obraB: simula continuidade Comercial → Obras
const { data: leadB } = await sb.from('leads').insert(fixtureLead(workspaceId, 'Lead B (virou obra)')).select('id').single();
const { data: obraB } = await sb.from('obras').insert(fixtureObra(workspaceId, 'Obra B (de lead)', leadB.id)).select('id').single();
// obraC: obra pura, sem lead
const { data: obraC } = await sb.from('obras').insert(fixtureObra(workspaceId, 'Obra C (pura)', null)).select('id').single();

const { data: docLeadA } = await sb.from('documentos').insert(fixtureDocumento({ leadId: leadA.id, workspaceId, usuarioId: idPorNome['RBAC Teste — SDR'] })).select('id').single();
const { data: docLeadB } = await sb.from('documentos').insert(fixtureDocumento({ leadId: leadB.id, workspaceId, usuarioId: idPorNome['RBAC Teste — SDR'] })).select('id').single();
const { data: docObraC } = await sb.from('documentos').insert(fixtureDocumento({ obraId: obraC.id, workspaceId, usuarioId: idPorNome['RBAC Teste — Estagiário'] })).select('id').single();

try {
  const ceo = await loginComo('rbac-ceo@teste.com');
  const gerente = await loginComo('rbac-gerente@teste.com');
  const sdr = await loginComo('rbac-sdr@teste.com');
  const engenheiro = await loginComo('rbac-engenheiro@teste.com');
  const estagiario = await loginComo('rbac-estagiario@teste.com');
  const financeiro = await loginComo('rbac-financeiro@teste.com');

  console.log('─ CEO — acesso total ────────────────────────────────────────────');
  const { data: ceoVe } = await ceo.from('documentos').select('id').in('id', [docLeadA.id, docLeadB.id, docObraC.id]);
  registrar('CEO visualiza os 3 documentos de teste', (ceoVe ?? []).length === 3, `${(ceoVe ?? []).length}/3`);
  const { data: ceoCria } = await ceo.from('documentos').insert(fixtureDocumento({ leadId: leadA.id, workspaceId })).select('id');
  registrar('CEO cria documento', (ceoCria ?? []).length === 1, 'ok');
  const { data: ceoEdita } = await ceo.from('documentos').update({ tipo_doc: 'comp_residencia' }).eq('id', docLeadA.id).select('id');
  registrar('CEO edita documento que NÃO criou', (ceoEdita ?? []).length === 1, 'ok');
  const { data: ceoExclui } = await ceo.from('documentos').update({ ativo: false }).eq('id', ceoCria[0].id).select('id');
  registrar('CEO exclui (soft-delete) documento', (ceoExclui ?? []).length === 1, 'ok');

  console.log('\n─ Gerente — vê/cria/edita tudo do domínio, NÃO exclui ──────────');
  const { data: gerVe } = await gerente.from('documentos').select('id').in('id', [docLeadA.id, docObraC.id]);
  registrar('Gerente visualiza documentos de comercial e obras', (gerVe ?? []).length === 2, `${(gerVe ?? []).length}/2`);
  const { data: gerEditaAlheio } = await gerente.from('documentos').update({ tipo_doc: 'ctps' }).eq('id', docLeadA.id).select('id');
  registrar('Gerente edita documento que NÃO criou (gestor)', (gerEditaAlheio ?? []).length === 1, 'ok');
  const { data: gerExclui } = await gerente.from('documentos').update({ ativo: false }).eq('id', docObraC.id).select('id');
  registrar('Gerente NÃO exclui documento', (gerExclui ?? []).length === 0, `${(gerExclui ?? []).length} linha(s)`);

  console.log('\n─ SDR — comercial (inclusive continuidade), editar só o próprio ─');
  const { data: sdrVeLeadA } = await sdr.from('documentos').select('id').eq('id', docLeadA.id);
  registrar('SDR visualiza documento do próprio lead', (sdrVeLeadA ?? []).length === 1, 'ok');
  const { data: sdrCria } = await sdr.from('documentos').insert(fixtureDocumento({ leadId: leadA.id, workspaceId, usuarioId: idPorNome['RBAC Teste — SDR'] })).select('id');
  registrar('SDR cria documento em lead', (sdrCria ?? []).length === 1, 'ok');
  const { data: sdrEditaProprio, error: sdrEditaProprioErr } = await sdr.from('documentos').update({ tipo_doc: 'comp_renda' }).eq('id', sdrCria[0].id).select('id');
  registrar('SDR edita o PRÓPRIO documento', (sdrEditaProprio ?? []).length === 1, sdrEditaProprioErr?.message ?? `${(sdrEditaProprio ?? []).length} linha(s)`);
  const { data: sdrEditaAlheio } = await sdr.from('documentos').update({ tipo_doc: 'ctps' }).eq('id', docObraC.id).select('id');
  registrar('SDR NÃO edita documento de outra pessoa/domínio', (sdrEditaAlheio ?? []).length === 0, `${(sdrEditaAlheio ?? []).length} linha(s)`);
  const { data: sdrExcluiProprio } = await sdr.from('documentos').update({ ativo: false }).eq('id', sdrCria[0].id).select('id');
  registrar('SDR NÃO exclui nem o próprio documento', (sdrExcluiProprio ?? []).length === 0, `${(sdrExcluiProprio ?? []).length} linha(s)`);
  const { data: sdrVeObraC } = await sdr.from('documentos').select('id').eq('id', docObraC.id);
  registrar('SDR NÃO visualiza documento de obra pura', (sdrVeObraC ?? []).length === 0, `${(sdrVeObraC ?? []).length} linha(s)`);

  console.log('\n─ Engenheiro — obras + continuidade lead→obra, editar só o próprio ─');
  const { data: engVeContinuidade } = await engenheiro.from('documentos').select('id').eq('id', docLeadB.id);
  registrar('Engenheiro visualiza documento do lead que virou obra (continuidade)', (engVeContinuidade ?? []).length === 1, 'ok');
  const { data: engVeLeadPuro } = await engenheiro.from('documentos').select('id').eq('id', docLeadA.id);
  registrar('Engenheiro NÃO visualiza documento de lead que nunca virou obra', (engVeLeadPuro ?? []).length === 0, `${(engVeLeadPuro ?? []).length} linha(s)`);
  const { data: engCria } = await engenheiro.from('documentos').insert(fixtureDocumento({ obraId: obraC.id, workspaceId, usuarioId: idPorNome['RBAC Teste — Engenheiro'] })).select('id');
  registrar('Engenheiro cria documento em obra', (engCria ?? []).length === 1, 'ok');
  const { data: engEditaAlheio } = await engenheiro.from('documentos').update({ tipo_doc: 'projeto_arq' }).eq('id', docObraC.id).select('id');
  registrar('Engenheiro NÃO edita documento que não criou', (engEditaAlheio ?? []).length === 0, `${(engEditaAlheio ?? []).length} linha(s)`);
  const { data: engFin } = await engenheiro.from('documentos').select('id').eq('id', docLeadA.id);
  registrar('Engenheiro NÃO acessa documentos financeiros/comerciais puros', (engFin ?? []).length === 0, `${(engFin ?? []).length} linha(s)`);

  console.log('\n─ Estagiário — visualiza obra autorizada, NÃO exclui ────────────');
  const { data: estVe } = await estagiario.from('documentos').select('id').eq('id', docObraC.id);
  registrar('Estagiário visualiza documento de obra autorizada', (estVe ?? []).length === 1, 'ok');
  const { data: estExclui } = await estagiario.from('documentos').update({ ativo: false }).eq('id', docObraC.id).select('id');
  registrar('Estagiário NÃO exclui arquivo', (estExclui ?? []).length === 0, `${(estExclui ?? []).length} linha(s)`);

  console.log('\n─ Financeiro — sem acesso a documentos hoje ──────────────────────');
  const { data: finVe } = await financeiro.from('documentos').select('id').in('id', [docLeadA.id, docObraC.id]);
  registrar('Financeiro NÃO visualiza nenhum documento', (finVe ?? []).length === 0, `${(finVe ?? []).length} linha(s)`);

  console.log('\n─ Isolamento entre workspaces ─────────────────────────────────');
  const suffix = Date.now().toString(36);
  const { data: wsB } = await sb.from('workspaces').insert({ nome: `[${MARKER}-B] ${suffix}`, tipo_conta: 'PJ', ativo: true }).select('id').single();
  const { data: uB } = await sb.auth.admin.createUser({ email: `docs-b-${suffix}@teste.local`, password: SENHA, email_confirm: true });
  const { data: cargoCeoB } = await sb.from('cargos').select('id').eq('workspace_id', wsB.id).eq('nome', 'CEO / Dono').single();
  await sb.from('profiles').update({ workspace_id: wsB.id, cargo_id: cargoCeoB.id }).eq('id', uB.user.id);
  const clientB = await loginComo(`docs-b-${suffix}@teste.local`);
  const { data: crossVe } = await clientB.from('documentos').select('id').eq('id', docLeadA.id);
  registrar('Usuário de OUTRO workspace NÃO acessa documento', (crossVe ?? []).length === 0, `${(crossVe ?? []).length} linha(s)`);

  await sb.from('profiles').delete().eq('id', uB.user.id);
  await sb.auth.admin.deleteUser(uB.user.id);
  await sb.from('workspaces').delete().eq('id', wsB.id);

} finally {
  console.log('\n─ Limpeza ──────────────────────────────────────────────────────');
  await sb.from('documentos').delete().eq('workspace_id', workspaceId).ilike('nome_arquivo', `%${MARKER}%`);
  await sb.from('obras').delete().eq('workspace_id', workspaceId).ilike('obs', `%${MARKER}%`);
  await sb.from('leads').delete().eq('workspace_id', workspaceId).ilike('obs', `%${MARKER}%`);
  console.log('✓ fixtures removidas (usuários continuam existindo)');
}

console.log('\n─ Resumo ───────────────────────────────────────────────────────');
const falhas = resultados.filter((r) => !r.ok);
console.log(`${resultados.length - falhas.length}/${resultados.length} passaram`);
if (falhas.length > 0) {
  console.log('\n🚨 FALHAS:');
  for (const f of falhas) console.log(`   - ${f.nome} (${f.detalhe})`);
}
console.log(falhas.length === 0 ? '\n✅ rbac-documentos-test.mjs: PASSOU\n' : '\n❌ rbac-documentos-test.mjs: FALHOU\n');
process.exit(falhas.length === 0 ? 0 : 1);
