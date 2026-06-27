import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://zrzqvdurgkqmoizlpeof.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyenF2ZHVyZ2txbW9pemxwZW9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjUxNjIwOSwiZXhwIjoyMDk4MDkyMjA5fQ.QjStR__xmpYUyuChh6mxzs-ZMQzQXIXKSFNJs3pig7w'
);

const { data: lead } = await sb.from('leads').select('*').limit(1).single();
console.log('COLUNAS LEADS:', lead ? Object.keys(lead).sort().join(', ') : 'sem dados');

const { data: corr } = await sb.from('correspondentes').select('*').limit(5);
console.log('\nCORRESPONDENTES:', JSON.stringify(corr, null, 2));

// Testa se origem_recurso existe
const { error } = await sb.from('leads').select('origem_recurso').limit(1);
console.log('\norigem_recurso existe?', error ? 'NÃO - ' + error.message : 'SIM');

// Testa tamanho_imovel e com_muro
const { error: e2 } = await sb.from('leads').select('tamanho_imovel,com_muro,nascimento,email,valor_lote,valor_financiamento').limit(1);
console.log('outros campos?', e2 ? 'ERRO - ' + e2.message : 'OK');
