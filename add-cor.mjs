import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zrzqvdurgkqmoizlpeof.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyenF2ZHVyZ2txbW9pemxwZW9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjUxNjIwOSwiZXhwIjoyMDk4MDkyMjA5fQ.QjStR__xmpYUyuChh6mxzs-ZMQzQXIXKSFNJs3pig7w'
);

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
