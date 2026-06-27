// seed-leads.mjs
// Preenche leads com campos novos e cria log de etapas com datas para a timeline
// Rodar com: node --use-system-ca seed-leads.mjs

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://zrzqvdurgkqmoizlpeof.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyenF2ZHVyZ2txbW9pemxwZW9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjUxNjIwOSwiZXhwIjoyMDk4MDkyMjA5fQ.QjStR__xmpYUyuChh6mxzs-ZMQzQXIXKSFNJs3pig7w'
);

// ─── Verificar migration ───────────────────────────────────────────────────────
console.log('Verificando migration...');
const { error: migCheck } = await sb.from('leads').select('email').limit(1);
if (migCheck?.code === '42703') {
  console.log('❌  Migration não foi executada ainda.');
  console.log('    Abra: https://supabase.com/dashboard/project/zrzqvdurgkqmoizlpeof/sql/new');
  console.log('    Cole e execute o conteúdo do arquivo migration.sql e tente novamente.\n');
  process.exit(1);
}
console.log('✓ Migration OK\n');

// ─── Buscar dados ──────────────────────────────────────────────────────────────
const { data: leads, error: leadsErr } = await sb
  .from('leads')
  .select('id, nome, etapa, correspondente_id, cidade, origem')
  .order('created_at');

if (leadsErr || !leads?.length) {
  console.log('Nenhum lead encontrado ou erro:', leadsErr?.message);
  process.exit(0);
}

const { data: existingLogs } = await sb.from('lead_log').select('lead_id, etapa');
const logSet = new Set((existingLogs ?? []).map(l => `${l.lead_id}:${l.etapa}`));

// ─── Atualizar correspondentes com nomes de pessoas ────────────────────────────
console.log('─ Correspondentes ─────────────────────────────────');
const corrUpdates = [
  { nomeAtual: 'Caixa Econômica – AG Pedreiras',    nome: 'Jailson',  agencia: 'Agência Pedreiras',       contato: '(99) 3631-1001', cidade: 'Pedreiras' },
  { nomeAtual: 'Caixa Econômica – AG Tuntum',       nome: 'Marilda',  agencia: 'Agência Tuntum',           contato: '(99) 3651-2002', cidade: 'Tuntum' },
  { nomeAtual: 'Caixa Econômica – AG Pres. Dutra',  nome: 'Genilza',  agencia: 'Agência Presidente Dutra', contato: '(99) 3671-3003', cidade: 'Presidente Dutra' },
  { nomeAtual: 'Correspondente Hab. MA',            nome: 'Raimundo', agencia: 'Correspondente Hab. MA',   contato: '(98) 98888-7777', cidade: 'São Luís' },
  { nomeAtual: 'Agente Hab. São Domingos',          nome: 'Josiane',  agencia: 'AG São Domingos',          contato: '(99) 98777-6666', cidade: 'São Domingos do Maranhão' },
];
const { data: corrsRaw } = await sb.from('correspondentes').select('id, nome, agencia').eq('ativo', true);
for (const u of corrUpdates) {
  const found = (corrsRaw ?? []).find(c => c.nome === u.nomeAtual || c.nome === u.nome);
  if (found && found.nome === u.nomeAtual) {
    const { error } = await sb.from('correspondentes').update({
      nome: u.nome, agencia: u.agencia, contato: u.contato, cidade: u.cidade,
    }).eq('id', found.id);
    if (error) console.log(`  ✗ ${u.nome}: ${error.message}`);
    else console.log(`  ✓ ${u.nomeAtual} → ${u.nome} — ${u.agencia}`);
  } else if (found) {
    console.log(`  - ${u.nome} já atualizado`);
  } else {
    console.log(`  - Não encontrado: ${u.nomeAtual}`);
  }
}
const { data: corrs } = await sb.from('correspondentes').select('id, nome, agencia').eq('ativo', true);
console.log(`  Total correspondentes ativos: ${corrs?.length ?? 0}\n`);

// ─── Criar corretores de exemplo ────────────────────────────────────────────────
console.log('─ Corretores ──────────────────────────────────────');
const corretoresExemplo = [
  { nome: 'André Almeida',    telefone: '(99) 98111-2222', email: 'andre.almeida@imob.com.br' },
  { nome: 'Fernanda Sousa',   telefone: '(99) 98333-4444', email: 'fernanda.sousa@creci.ma' },
  { nome: 'Ricardo Barros',   telefone: '(98) 98555-6666', email: 'r.barros@imoveis.com' },
];
const { data: corrsExist } = await sb.from('corretores').select('nome').eq('ativo', true);
const nomesExist = new Set((corrsExist ?? []).map(c => c.nome));
for (const c of corretoresExemplo) {
  if (nomesExist.has(c.nome)) { console.log(`  - ${c.nome} já existe`); continue; }
  const { error } = await sb.from('corretores').insert({ ...c, ativo: true });
  if (error) console.log(`  ✗ ${c.nome}: ${error.message}`);
  else console.log(`  ✓ ${c.nome} criado`);
}
const { data: corretores } = await sb.from('corretores').select('id, nome').eq('ativo', true);
console.log(`  Total corretores: ${corretores?.length ?? 0}\n`);

// ─── Dados de seed por lead ────────────────────────────────────────────────────
const FLUXO = ['leads', 'simulacao', 'reuniao', 'documentacao', 'analise', 'aprovada'];

const TAMANHOS    = ['65m²', '80m²', '90m²', '55m²', '70m²', '45m²', '100m²', '75m²', '60m²', '85m²'];
const COM_MURO    = ['sem_muro', 'com_muro', 'muro_parcial', 'com_muro', 'sem_muro', 'muro_parcial'];
const RECURSO     = ['FGTS', 'SBPE', 'PRO-COTISTA', 'FGTS', 'FGTS', 'SBPE', 'FGTS', 'PRO-COTISTA'];
const VALOR_LOTE  = [35000, 40000, 50000, 30000, 45000, 60000, 38000, 52000, 42000, 55000];
const VALOR_FIN   = [95000, 110000, 130000, 85000, 120000, 145000, 98000, 115000, 125000, 140000];
const NASCIMENTOS = [
  '1985-03-12', '1978-07-25', '1992-11-08', '1987-05-19', '1980-09-30',
  '1995-02-14', '1983-06-22', '1990-12-05', '1975-08-17', '1988-04-03',
  '1977-10-28', '1993-01-16', '1982-09-07', '1989-06-11', '1984-12-24',
];
const EMAILS_SUF  = ['@gmail.com', '@hotmail.com', '@yahoo.com', '@outlook.com'];
const LOCAIS_REU  = ['Escritório', 'Na casa do cliente', 'Escritório', 'Videoconferência (Meet)', 'Escritório'];
const MOTIVOS_REP = ['Score de crédito insuficiente', 'Renda insuficiente', 'Restrição no CPF (SPC/Serasa)'];

function pastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(1, daysAgo));
  d.setHours(8 + Math.floor(Math.random() * 9));
  d.setMinutes(Math.floor(Math.random() * 60));
  d.setSeconds(Math.floor(Math.random() * 60));
  return d.toISOString();
}

function fmt(isoStr) {
  const d = new Date(isoStr);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// ─── Loop por lead ─────────────────────────────────────────────────────────────
console.log('─ Leads ───────────────────────────────────────────');

const totalLeads = leads.length;

for (const [i, lead] of leads.entries()) {
  const isReprovada = lead.etapa === 'reprovada';
  const etapaIdx = isReprovada ? FLUXO.indexOf('analise') : FLUXO.indexOf(lead.etapa);

  // Distribuir leads no passado: primeiro há ~90 dias, último há ~7 dias
  const startDaysAgo = Math.round(90 - (i / Math.max(totalLeads - 1, 1)) * 75);

  // Correspondente: preferir o já vinculado, senão sortear
  const corrId = lead.correspondente_id
    ?? (etapaIdx >= FLUXO.indexOf('analise') ? corrs?.[i % (corrs?.length || 1)]?.id : null);

  // Corretor: atribuir se origem === "Corretor" ou 1 em cada 3 leads
  const corrRetorId = (lead.origem === 'Corretor' || i % 3 === 0)
    ? corretores?.[i % (corretores?.length || 1)]?.id
    : null;
  const corretorNome = corrRetorId ? corretores?.find(c => c.id === corrRetorId)?.nome : null;

  // Primeiro nome → email
  const primeiroNome = lead.nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');

  // ── Atualizar campos novos do lead ──────────────────────────────────────────
  const updates = {
    email:              `${primeiroNome}${EMAILS_SUF[i % EMAILS_SUF.length]}`,
    nascimento:         NASCIMENTOS[i % NASCIMENTOS.length],
    tamanho_imovel:     TAMANHOS[i % TAMANHOS.length],
    com_muro:           COM_MURO[i % COM_MURO.length],
    origem_recurso:     RECURSO[i % RECURSO.length],
    valor_lote:         VALOR_LOTE[i % VALOR_LOTE.length],
    valor_financiamento:VALOR_FIN[i % VALOR_FIN.length],
    ...(corrId && !lead.correspondente_id ? { correspondente_id: corrId } : {}),
    ...(corrRetorId ? { corretor_id: corrRetorId, corretor: corretorNome } : {}),
  };

  const { error: upErr } = await sb.from('leads').update(updates).eq('id', lead.id);
  if (upErr) {
    console.log(`  ✗ [${lead.etapa}] ${lead.nome}: ${upErr.message}`);
    continue;
  }
  console.log(`\n  ✓ ${lead.nome}  (${lead.etapa})`);
  console.log(`     ${updates.tamanho_imovel} · ${updates.com_muro} · ${updates.origem_recurso} · R$${updates.valor_lote?.toLocaleString('pt-BR')} terreno`);

  // ── Criar log de etapas com datas no passado ────────────────────────────────
  const stagesToLog = [...FLUXO.slice(0, etapaIdx + 1)];
  if (isReprovada) stagesToLog.push('reprovada');

  // Intervalos entre etapas: Lead(0) → Simulacao(3-6d) → Reuniao(3-7d) → Docs(7-14d) → Analise(14-30d) → Aprovada(15-30d)
  const intervals = [0, 4, 5, 10, 18, 20]; // dias após a entrada no lead

  for (const [si, etapa] of stagesToLog.entries()) {
    const logKey = `${lead.id}:${etapa}`;
    if (logSet.has(logKey)) {
      console.log(`     · ${etapa}: já existe`);
      continue;
    }

    const daysAgo = Math.max(1, startDaysAgo - (intervals[si] ?? si * 5));
    const logDate = pastDate(daysAgo);

    const dados_extras = {};
    if (etapa === 'reuniao') {
      dados_extras.local_reuniao = LOCAIS_REU[i % LOCAIS_REU.length];
    }
    if (etapa === 'analise' && corrId) {
      dados_extras.correspondente_id = corrId;
    }
    if (etapa === 'reprovada') {
      dados_extras.motivo_reprovacao = MOTIVOS_REP[i % MOTIVOS_REP.length];
    }

    const { error: logErr } = await sb.from('lead_log').insert({
      lead_id:      lead.id,
      etapa,
      dados_extras: Object.keys(dados_extras).length > 0 ? dados_extras : null,
      criado_em:    logDate,
    });

    if (logErr) {
      console.log(`     ✗ log ${etapa}: ${logErr.message}`);
    } else {
      console.log(`     + ${etapa.padEnd(14)} ${fmt(logDate)}`);
      logSet.add(logKey);
    }
  }
}

// ─── Sumário ───────────────────────────────────────────────────────────────────
console.log('\n─ Resumo ──────────────────────────────────────────');
const { data: final } = await sb
  .from('leads')
  .select('nome, etapa, email, tamanho_imovel, origem_recurso, valor_financiamento')
  .order('created_at');

for (const l of final ?? []) {
  console.log(`  ${(l.nome ?? '').padEnd(30)} ${(l.etapa ?? '').padEnd(14)} ${(l.email ?? '-').padEnd(28)} ${l.tamanho_imovel ?? '-'} · ${l.origem_recurso ?? '-'} · R$${(l.valor_financiamento ?? 0).toLocaleString('pt-BR')}`);
}

console.log('\n✅  Seed concluído! Recarregue o app (F5) para ver as mudanças.\n');
