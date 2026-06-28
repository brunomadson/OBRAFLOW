// seed-financeiro.mjs
// Gera lançamentos de teste para o Setor Financeiro
// Rodar com: node --use-system-ca seed-financeiro.mjs

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://zrzqvdurgkqmoizlpeof.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyenF2ZHVyZ2txbW9pemxwZW9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjUxNjIwOSwiZXhwIjoyMDk4MDkyMjA5fQ.QjStR__xmpYUyuChh6mxzs-ZMQzQXIXKSFNJs3pig7w'
);

// ─── Verificar colunas da migration ───────────────────────────────────────────
console.log('🔍  Verificando migration...');
const { error: migCheck } = await sb.from('lancamentos').select('grupo').limit(1);
if (migCheck?.code === '42703') {
  console.error('❌  Migration não foi executada. Execute migration.sql no Supabase Dashboard primeiro.');
  process.exit(1);
}
console.log('✅  Migration OK\n');

// ─── Buscar obras para vincular lançamentos ────────────────────────────────────
const { data: obras, error: errObras } = await sb.from('obras').select('id').limit(10);
if (errObras) { console.error('Erro ao buscar obras:', errObras.message); process.exit(1); }
console.log(`📦  ${obras?.length ?? 0} obras encontradas`);
const obraIds = (obras ?? []).map(o => o.id);

// ─── Helper de data ────────────────────────────────────────────────────────────
function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function diasFrente(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function obraId(i) {
  return obraIds.length > 0 ? obraIds[i % obraIds.length] : null;
}

// ─── Lançamentos de entrada ────────────────────────────────────────────────────
const entradas = [
  // Medições Caixa (últimos 6 meses)
  { tipo: 'entrada', categoria: 'Medição Caixa', grupo: 'Receita Obras', descricao: 'Medição 1ª etapa — Obra Silva', valor: 18500, data: diasAtras(150), obra_id: obraId(0), status_pagamento: 'pago', data_confirmacao: diasAtras(148) + 'T10:00:00Z', forma_pagamento: 'Transferência' },
  { tipo: 'entrada', categoria: 'Medição Caixa', grupo: 'Receita Obras', descricao: 'Medição 2ª etapa — Obra Pereira', valor: 22000, data: diasAtras(120), obra_id: obraId(1), status_pagamento: 'pago', data_confirmacao: diasAtras(118) + 'T14:00:00Z', forma_pagamento: 'Transferência' },
  { tipo: 'entrada', categoria: 'Medição Caixa', grupo: 'Receita Obras', descricao: 'Medição 1ª etapa — Obra Oliveira', valor: 15800, data: diasAtras(90), obra_id: obraId(2), status_pagamento: 'pago', data_confirmacao: diasAtras(88) + 'T09:00:00Z', forma_pagamento: 'Transferência' },
  { tipo: 'entrada', categoria: 'Medição Caixa', grupo: 'Receita Obras', descricao: 'Medição 3ª etapa — Obra Silva', valor: 19200, data: diasAtras(60), obra_id: obraId(0), status_pagamento: 'pago', data_confirmacao: diasAtras(58) + 'T11:00:00Z', forma_pagamento: 'Pix' },
  { tipo: 'entrada', categoria: 'Medição Caixa', grupo: 'Receita Obras', descricao: 'Medição 2ª etapa — Obra Oliveira', valor: 21000, data: diasAtras(30), obra_id: obraId(2), status_pagamento: 'pago', data_confirmacao: diasAtras(28) + 'T16:00:00Z', forma_pagamento: 'Transferência' },
  { tipo: 'entrada', categoria: 'Medição Caixa', grupo: 'Receita Obras', descricao: 'Medição 4ª etapa — Obra Pereira', valor: 17500, data: diasAtras(10), obra_id: obraId(1), status_pagamento: 'pago', data_confirmacao: diasAtras(8) + 'T10:00:00Z', forma_pagamento: 'Pix' },
  // Adiantamentos
  { tipo: 'entrada', categoria: 'Adiantamento cliente', grupo: 'Receita Obras', descricao: 'Adiantamento cliente Souza', valor: 8000, data: diasAtras(100), obra_id: obraId(3), status_pagamento: 'pago', data_confirmacao: diasAtras(100) + 'T08:00:00Z', forma_pagamento: 'Pix' },
  { tipo: 'entrada', categoria: 'Adiantamento cliente', grupo: 'Receita Obras', descricao: 'Adiantamento cliente Santos', valor: 5000, data: diasAtras(45), obra_id: obraId(0), status_pagamento: 'pago', data_confirmacao: diasAtras(45) + 'T09:00:00Z', forma_pagamento: 'Dinheiro' },
  // Venda de lote
  { tipo: 'entrada', categoria: 'Venda de lote', grupo: 'Receita Obras', descricao: 'Venda de lote — Presidente Dutra', valor: 35000, data: diasAtras(80), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(79) + 'T15:00:00Z', forma_pagamento: 'Transferência' },
  // Capital
  { tipo: 'entrada', categoria: 'Aporte sócio', grupo: 'Capital', descricao: 'Aporte sócio para capital de giro', valor: 10000, data: diasAtras(130), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(130) + 'T08:00:00Z', forma_pagamento: 'Pix' },
  { tipo: 'entrada', categoria: 'Receita diversa', grupo: 'Receita Outras', descricao: 'Assessoria técnica terceiro', valor: 2500, data: diasAtras(55), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(55) + 'T13:00:00Z', forma_pagamento: 'Pix' },
];

// ─── Lançamentos de saída ──────────────────────────────────────────────────────
const saidas = [
  // Custo Obra
  { tipo: 'saida', categoria: 'Material de construção', grupo: 'Custo Obra', descricao: 'Cimento, areia e ferragem — Obra Silva', valor: 6800, data: diasAtras(145), obra_id: obraId(0), status_pagamento: 'pago', data_confirmacao: diasAtras(144) + 'T09:00:00Z', forma_pagamento: 'Boleto', data_vencimento: diasAtras(144) },
  { tipo: 'saida', categoria: 'Material de construção', grupo: 'Custo Obra', descricao: 'Tijolos e telhas — Obra Pereira', valor: 4200, data: diasAtras(115), obra_id: obraId(1), status_pagamento: 'pago', data_confirmacao: diasAtras(113) + 'T10:00:00Z', forma_pagamento: 'Boleto', data_vencimento: diasAtras(113) },
  { tipo: 'saida', categoria: 'Material de construção', grupo: 'Custo Obra', descricao: 'Esquadrias e portas — Obra Oliveira', valor: 5500, data: diasAtras(85), obra_id: obraId(2), status_pagamento: 'pago', data_confirmacao: diasAtras(84) + 'T11:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(84) },
  { tipo: 'saida', categoria: 'Material de construção', grupo: 'Custo Obra', descricao: 'Material hidráulico — Obra Silva', valor: 3100, data: diasAtras(55), obra_id: obraId(0), status_pagamento: 'pago', data_confirmacao: diasAtras(53) + 'T09:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(53) },
  { tipo: 'saida', categoria: 'Material de construção', grupo: 'Custo Obra', descricao: 'Tinta e acabamento — Obra Pereira', valor: 2800, data: diasAtras(25), obra_id: obraId(1), status_pagamento: 'pendente', forma_pagamento: 'Boleto', data_vencimento: diasFrente(5) },
  { tipo: 'saida', categoria: 'Mão de obra', grupo: 'Custo Obra', descricao: 'Pagamento pedreiros — Obra Silva (Jun)', valor: 8500, data: diasAtras(135), obra_id: obraId(0), status_pagamento: 'pago', data_confirmacao: diasAtras(130) + 'T08:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(130) },
  { tipo: 'saida', categoria: 'Mão de obra', grupo: 'Custo Obra', descricao: 'Pagamento pedreiros — Obra Silva (Jul)', valor: 8500, data: diasAtras(105), obra_id: obraId(0), status_pagamento: 'pago', data_confirmacao: diasAtras(100) + 'T08:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(100) },
  { tipo: 'saida', categoria: 'Mão de obra', grupo: 'Custo Obra', descricao: 'Pagamento eletricista — Obra Oliveira', valor: 4200, data: diasAtras(78), obra_id: obraId(2), status_pagamento: 'pago', data_confirmacao: diasAtras(77) + 'T09:00:00Z', forma_pagamento: 'Dinheiro', data_vencimento: diasAtras(77) },
  { tipo: 'saida', categoria: 'Mão de obra', grupo: 'Custo Obra', descricao: 'Pagamento pedreiros — Obra Pereira (Ago)', valor: 9000, data: diasAtras(50), obra_id: obraId(1), status_pagamento: 'pago', data_confirmacao: diasAtras(48) + 'T08:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(48) },
  { tipo: 'saida', categoria: 'Mão de obra', grupo: 'Custo Obra', descricao: 'Pagamento pedreiros — Obra Oliveira (Set)', valor: 8800, data: diasAtras(20), obra_id: obraId(2), status_pagamento: 'pendente', forma_pagamento: 'Pix', data_vencimento: diasFrente(10) },
  { tipo: 'saida', categoria: 'Projetos e taxas técnicas', grupo: 'Custo Obra', descricao: 'ART — Obra Silva', valor: 1200, data: diasAtras(160), obra_id: obraId(0), status_pagamento: 'pago', data_confirmacao: diasAtras(159) + 'T10:00:00Z', forma_pagamento: 'Boleto', data_vencimento: diasAtras(159) },
  // Administrativo
  { tipo: 'saida', categoria: 'Salário / Pro-labore', grupo: 'Administrativo', descricao: 'Pro-labore sócio — Jun', valor: 3500, data: diasAtras(150), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(148) + 'T08:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(148) },
  { tipo: 'saida', categoria: 'Salário / Pro-labore', grupo: 'Administrativo', descricao: 'Pro-labore sócio — Jul', valor: 3500, data: diasAtras(120), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(118) + 'T08:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(118) },
  { tipo: 'saida', categoria: 'Salário / Pro-labore', grupo: 'Administrativo', descricao: 'Pro-labore sócio — Ago', valor: 3500, data: diasAtras(90), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(88) + 'T08:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(88) },
  { tipo: 'saida', categoria: 'Salário / Pro-labore', grupo: 'Administrativo', descricao: 'Pro-labore sócio — Set', valor: 3500, data: diasAtras(60), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(58) + 'T08:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(58) },
  { tipo: 'saida', categoria: 'Salário / Pro-labore', grupo: 'Administrativo', descricao: 'Pro-labore sócio — Out', valor: 3500, data: diasAtras(30), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(28) + 'T08:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(28) },
  { tipo: 'saida', categoria: 'Salário / Pro-labore', grupo: 'Administrativo', descricao: 'Pro-labore sócio — Nov', valor: 3500, data: diasAtras(5), obra_id: null, status_pagamento: 'pendente', forma_pagamento: 'Pix', data_vencimento: diasFrente(25) },
  { tipo: 'saida', categoria: 'Aluguel', grupo: 'Administrativo', descricao: 'Aluguel escritório — mensal', valor: 1200, data: diasAtras(15), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(14) + 'T08:00:00Z', forma_pagamento: 'Transferência', data_vencimento: diasAtras(14) },
  { tipo: 'saida', categoria: 'Contador / Contabilidade', grupo: 'Administrativo', descricao: 'Honorários contábeis — trimestral', valor: 900, data: diasAtras(40), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(39) + 'T09:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(39) },
  // Operacional
  { tipo: 'saida', categoria: 'Combustível', grupo: 'Operacional', descricao: 'Abastecimento pickup — Out', valor: 480, data: diasAtras(35), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(35) + 'T10:00:00Z', forma_pagamento: 'Cartão Débito', data_vencimento: diasAtras(35) },
  { tipo: 'saida', categoria: 'Combustível', grupo: 'Operacional', descricao: 'Abastecimento pickup — Nov', valor: 520, data: diasAtras(8), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(8) + 'T10:00:00Z', forma_pagamento: 'Cartão Débito', data_vencimento: diasAtras(8) },
  { tipo: 'saida', categoria: 'Cartório', grupo: 'Operacional', descricao: 'Escritura do lote — Pedreiras', valor: 850, data: diasAtras(95), obra_id: obraId(3), status_pagamento: 'pago', data_confirmacao: diasAtras(94) + 'T14:00:00Z', forma_pagamento: 'Boleto', data_vencimento: diasAtras(94) },
  // Comercial
  { tipo: 'saida', categoria: 'Comissão corretor', grupo: 'Comercial', descricao: 'Comissão André Almeida — Obra Pereira', valor: 3200, data: diasAtras(110), obra_id: obraId(1), status_pagamento: 'pago', data_confirmacao: diasAtras(108) + 'T11:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(108) },
  { tipo: 'saida', categoria: 'Bônus indicação', grupo: 'Comercial', descricao: 'Bônus indicação — cliente Marilda', valor: 500, data: diasAtras(70), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(69) + 'T09:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(69) },
  // Impostos
  { tipo: 'saida', categoria: 'DAS / Simples Nacional', grupo: 'Impostos', descricao: 'DAS Simples — Set', valor: 1850, data: diasAtras(55), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(53) + 'T09:00:00Z', forma_pagamento: 'Boleto', data_vencimento: diasAtras(53) },
  { tipo: 'saida', categoria: 'DAS / Simples Nacional', grupo: 'Impostos', descricao: 'DAS Simples — Out', valor: 2100, data: diasAtras(25), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(23) + 'T09:00:00Z', forma_pagamento: 'Boleto', data_vencimento: diasAtras(23) },
  { tipo: 'saida', categoria: 'DAS / Simples Nacional', grupo: 'Impostos', descricao: 'DAS Simples — Nov', valor: 2100, data: diasAtras(5), obra_id: null, status_pagamento: 'pendente', forma_pagamento: 'Boleto', data_vencimento: diasFrente(15) },
  { tipo: 'saida', categoria: 'INSS', grupo: 'Impostos', descricao: 'INSS pedreiros — Out', valor: 980, data: diasAtras(28), obra_id: obraId(0), status_pagamento: 'pago', data_confirmacao: diasAtras(26) + 'T09:00:00Z', forma_pagamento: 'Boleto', data_vencimento: diasAtras(26) },
  { tipo: 'saida', categoria: 'FGTS', grupo: 'Impostos', descricao: 'FGTS pedreiros — Out', valor: 720, data: diasAtras(28), obra_id: obraId(0), status_pagamento: 'pago', data_confirmacao: diasAtras(26) + 'T09:30:00Z', forma_pagamento: 'Boleto', data_vencimento: diasAtras(26) },
  { tipo: 'saida', categoria: 'Tarifas bancárias', grupo: 'Impostos', descricao: 'Tarifa bancária — Out/Nov', valor: 180, data: diasAtras(12), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(12) + 'T10:00:00Z', forma_pagamento: 'Débito automático', data_vencimento: diasAtras(12) },
  // Marketing
  { tipo: 'saida', categoria: 'Tráfego pago', grupo: 'Marketing', descricao: 'Google Ads — campanha outubro', valor: 800, data: diasAtras(40), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(38) + 'T10:00:00Z', forma_pagamento: 'Cartão Crédito', data_vencimento: diasAtras(38) },
  { tipo: 'saida', categoria: 'Tráfego pago', grupo: 'Marketing', descricao: 'Facebook Ads — campanha novembro', valor: 600, data: diasAtras(10), obra_id: null, status_pagamento: 'pendente', forma_pagamento: 'Cartão Crédito', data_vencimento: diasFrente(20) },
  { tipo: 'saida', categoria: 'Influenciador', grupo: 'Marketing', descricao: 'Parceria Instagram @construcaoma', valor: 400, data: diasAtras(65), obra_id: null, status_pagamento: 'pago', data_confirmacao: diasAtras(64) + 'T14:00:00Z', forma_pagamento: 'Pix', data_vencimento: diasAtras(64) },
  // Vencidos (para testar o alerta)
  { tipo: 'saida', categoria: 'Material de construção', grupo: 'Custo Obra', descricao: 'Ferro e vergalhão — Obra Santos (VENCIDO)', valor: 3800, data: diasAtras(35), obra_id: obraId(3), status_pagamento: 'pendente', forma_pagamento: 'Boleto', data_vencimento: diasAtras(5) },
  { tipo: 'saida', categoria: 'Salário / Pro-labore', grupo: 'Administrativo', descricao: 'Assistente administrativo (VENCIDO)', valor: 1400, data: diasAtras(25), obra_id: null, status_pagamento: 'pendente', forma_pagamento: 'Pix', data_vencimento: diasAtras(3) },
];

// ─── Parcelas (boleto em 4x) ───────────────────────────────────────────────────
const parcelasAndaime = [15, 30, 45, 60].map((d, i) => ({
  tipo: 'saida', categoria: 'Material de construção', grupo: 'Custo Obra',
  descricao: `Andaimes e escoras — Obra Oliveira (${i+1}/4)`,
  valor: 875, data: diasAtras(75),
  obra_id: obraId(2),
  status_pagamento: i < 2 ? 'pago' : 'pendente',
  data_confirmacao: i < 2 ? (diasAtras(75 - d) + 'T09:00:00Z') : null,
  forma_pagamento: 'Boleto',
  data_vencimento: i < 2 ? diasAtras(75 - d) : diasFrente(d - 75 + 75),
  parcela_num: i + 1,
  parcela_total: 4,
}));

// ─── Inserir todos ─────────────────────────────────────────────────────────────
const todos = [...entradas, ...saidas, ...parcelasAndaime];

console.log(`\n📝  Inserindo ${todos.length} lançamentos de teste...`);

// Limpar lançamentos anteriores de teste (opcional - apenas se quiser recomeçar)
const args = process.argv.slice(2);
if (args.includes('--limpar')) {
  console.log('🧹  Limpando lançamentos anteriores...');
  const { error: delErr } = await sb.from('lancamentos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) console.warn('Aviso ao limpar:', delErr.message);
  else console.log('✅  Lançamentos anteriores removidos');
}

// Inserir em lote de 10
const BATCH = 10;
let inseridos = 0;
for (let i = 0; i < todos.length; i += BATCH) {
  const lote = todos.slice(i, i + BATCH);
  const { error } = await sb.from('lancamentos').insert(lote);
  if (error) {
    console.error(`❌  Erro no lote ${i}-${i+BATCH}:`, error.message);
  } else {
    inseridos += lote.length;
    process.stdout.write(`\r   ✓ ${inseridos}/${todos.length} inseridos...`);
  }
}

console.log(`\n\n✅  Seed financeiro concluído! ${inseridos} lançamentos inseridos.`);
console.log('\nDados criados:');
console.log(`  • ${entradas.length} entradas (Medições Caixa, Adiantamentos, Venda lote, Capital)`);
console.log(`  • ${saidas.length} saídas (6 grupos: Custo Obra, Adm, Operacional, Comercial, Impostos, Marketing)`);
console.log(`  • ${parcelasAndaime.length} parcelas de boleto (andaime 4x, 15/30/45/60 dias)`);
console.log(`  • 2 lançamentos VENCIDOS para testar alertas`);
console.log(`  • Cobrindo os últimos ~5 meses de fluxo\n`);
console.log('🚀  Acesse o Setor Financeiro para ver os dados!');
