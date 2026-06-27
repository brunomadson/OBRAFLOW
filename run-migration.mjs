// Roda o que é possível via API REST
// Para DDL (ALTER TABLE, CREATE TABLE), use o SQL do arquivo migration.sql no Supabase Dashboard
// https://supabase.com/dashboard/project/zrzqvdurgkqmoizlpeof/sql/new

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://zrzqvdurgkqmoizlpeof.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyenF2ZHVyZ2txbW9pemxwZW9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjUxNjIwOSwiZXhwIjoyMDk4MDkyMjA5fQ.QjStR__xmpYUyuChh6mxzs-ZMQzQXIXKSFNJs3pig7w'
);

console.log('--- Testando se a migration foi executada ---');

// Testa se coluna 'agencia' existe em correspondentes
const { error: eAgencia } = await sb.from('correspondentes').select('agencia').limit(1);
if (eAgencia) {
  console.log('⚠️  MIGRATION NÃO EXECUTADA YET.');
  console.log('   Abra: https://supabase.com/dashboard/project/zrzqvdurgkqmoizlpeof/sql/new');
  console.log('   Cole e execute o conteúdo do arquivo migration.sql');
  process.exit(0);
}

console.log('✓ Migration detectada! Atualizando correspondentes com nomes de pessoas...');

// Atualiza correspondentes com nome de pessoa + agencia separada
const updates = [
  { nomeAtual: 'Caixa Econômica – AG Pedreiras',    nome: 'Jailson',  agencia: 'Agência Pedreiras',       contato: '(99) 3631-1001', cidade: 'Pedreiras' },
  { nomeAtual: 'Caixa Econômica – AG Tuntum',       nome: 'Marilda',  agencia: 'Agência Tuntum',           contato: '(99) 3651-2002', cidade: 'Tuntum' },
  { nomeAtual: 'Caixa Econômica – AG Pres. Dutra',  nome: 'Genilza',  agencia: 'Agência Presidente Dutra', contato: '(99) 3671-3003', cidade: 'Presidente Dutra' },
  { nomeAtual: 'Correspondente Hab. MA',            nome: 'Raimundo', agencia: 'Correspondente Hab. MA',   contato: '(98) 98888-7777', cidade: 'São Luís' },
  { nomeAtual: 'Agente Hab. São Domingos',          nome: 'Josiane',  agencia: 'AG São Domingos',          contato: '(99) 98777-6666', cidade: 'São Domingos do Maranhão' },
];

for (const u of updates) {
  const { data: found } = await sb.from('correspondentes').select('id').eq('nome', u.nomeAtual).single();
  if (found) {
    const { error } = await sb.from('correspondentes').update({
      nome: u.nome,
      agencia: u.agencia,
      contato: u.contato,
      cidade: u.cidade,
    }).eq('id', found.id);
    if (error) console.log(`  ✗ Erro ao atualizar ${u.nomeAtual}: ${error.message}`);
    else console.log(`  ✓ ${u.nomeAtual} → ${u.nome} — ${u.agencia}`);
  } else {
    console.log(`  - Não encontrado: ${u.nomeAtual}`);
  }
}

// Lista final de correspondentes
const { data: final } = await sb.from('correspondentes').select('nome, agencia, contato').eq('ativo', true).order('nome');
console.log('\nCorrespondentes ativos:');
(final ?? []).forEach(c => console.log(`  - ${c.nome} — ${c.agencia || 'sem agência'} (${c.contato || 'sem contato'})`));
