import { sb as supabase } from './supabase-admin.mjs';

// Adiciona coluna cor via rpc exec_sql (se disponível) ou via update direto
// Como não podemos rodar DDL via REST, vamos verificar o que está disponível

// Testa a query sem 'cor' para confirmar que funciona
const { data, error } = await supabase
  .from('leads')
  .select('*, log:lead_log(*), responsavel:profiles!leads_responsavel_id_fkey(id,nome,cargo), correspondente:correspondentes(*)')
  .order('updated_at', { ascending: false });

if (error) {
  console.error('ERRO:', JSON.stringify(error, null, 2));
} else {
  console.log(`✓ Query OK — ${data.length} leads carregados:`);
  data.forEach(l => console.log(`  [${l.etapa}] ${l.nome}`));
}
