// reset-teste-demo.mjs
// Remove todos os registros criados por seed-teste-demo.mjs (identificados
// pelo marcador SEED_TESTE_2026 no campo obs). Leads/obras cascateiam para
// lead_log/obra_log/medicoes automaticamente; lançamentos são apagados antes
// das obras porque a FK obra_id não tem ON DELETE CASCADE.
//
// Rodar com: node --env-file=.env.local reset-teste-demo.mjs

import { sb } from './supabase-admin.mjs';

const SEED_MARKER = 'SEED_TESTE_2026';

async function apagar(tabela) {
  const { data, error } = await sb
    .from(tabela)
    .delete()
    .ilike('obs', `%${SEED_MARKER}%`)
    .select('id');
  if (error) { console.log(`✗ ${tabela}: ${error.message}`); return 0; }
  console.log(`✓ ${tabela}: ${data.length} removido(s)`);
  return data.length;
}

console.log('Removendo dados de teste (marcador:', SEED_MARKER, ')\n');

await apagar('lancamentos');
await apagar('obras');   // cascata: obra_log, medicoes
await apagar('leads');   // cascata: lead_log

console.log('\n✅  Reset concluído. Recarregue o app para conferir.\n');
