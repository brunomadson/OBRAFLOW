// reset-concretize-real.mjs
// Zera dados operacionais de TESTE do workspace real da CONCRETIZE ENGENHARIA
// antes da migração real do Notion (Comercial -> Obras -> Financeiro).
// Mantém: workspace, profiles (equipe), workspace_invites, cargos/permissões, assinatura.
// Rodar com: node --env-file=.env.local reset-concretize-real.mjs

import { sb } from './supabase-admin.mjs';

const WORKSPACE_ID = '88d8716f-083e-44bd-91f3-a391cda59d66'; // CONCRETIZE ENGENHARIA

async function apagar(tabela) {
  const { data, error } = await sb
    .from(tabela)
    .delete()
    .eq('workspace_id', WORKSPACE_ID)
    .select('id');
  if (error) { console.log(`✗ ${tabela}: ${error.message}`); return -1; }
  console.log(`✓ ${tabela}: ${data.length} removido(s)`);
  return data.length;
}

console.log('Zerando dados operacionais de teste — CONCRETIZE ENGENHARIA\n');

await apagar('lancamentos');
await apagar('obras');   // cascata: obra_log, medicoes
await apagar('leads');   // cascata: lead_log
await apagar('historico');

console.log('\n✅  Reset concluído. Workspace, contas da equipe e convites preservados.\n');
