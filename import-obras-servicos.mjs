// import-obras-servicos.mjs
// Importador Notion -> ObraFlow (setor Obras / tabela obras), a partir da base
// "Serviços" do Notion (registro de clientes/obras).
//
// Fonte: import-data/servicos-obras-all.csv (export "_all" do Notion).
//
// Regras confirmadas com o usuário (ticket "Obras CSV audit"):
//   - Status -> etapa: Não iniciada->projeto, Obra->execucao,
//     Documentação->licencas, Projeto->projeto, Conformidade->conformidade
//   - Stephanye (Mirlene) e Ana Clara: já são vendas aprovadas em execução de
//     obra -> força etapa=execucao mesmo com Status="Não iniciada"
//   - Bruna Kauanny (linha "Não iniciada"/Proposta aprovada) é duplicata de
//     BRUNA KAWANNY (linha "Obra") -> usa só a linha "Obra"
//   - kaio Felipe (linha "Não iniciada") é duplicata de KAIO (linha "Obra")
//     -> usa só a linha "Obra"
//   - Valor (Notion) -> valor_venda
//   - "Início" (data por extenso, ex. "18 de setembro de 2025") -> data_contato
//     (equivalente a "Data de Contato"/entrada no funil, mesmo padrão do
//     Comercial); quando ausente, usa "Data de Criação" (DD/MM/AAAA)
//   - Responsável sem profile reconhecido (só Bruno Madson/Alef Campos) -> NULL
//   - lead_id: tenta achar lead já aprovado com nome igual (link automático,
//     reportado no dry run antes de qualquer commit)
//
// Modo padrão: DRY RUN (não escreve nada). Passe --commit para gravar de fato.
//
// Rodar com: node --env-file=.env.local import-obras-servicos.mjs [--commit]

import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { sb } from './supabase-admin.mjs';

const WORKSPACE_ID = '88d8716f-083e-44bd-91f3-a391cda59d66'; // CONCRETIZE ENGENHARIA
const CSV_PATH = './import-data/servicos-obras-all.csv';
const COMMIT = process.argv.includes('--commit');

const RESPONSAVEIS = {
  'BRUNO MADSON': '9eade354-ce9d-47e7-906b-e6b1dfcdd33d',
  'ALEF CAMPOS': 'cf0d9ac2-95ba-4dc8-8a01-5de8fdca0314',
};

const STATUS_TO_ETAPA = {
  'Não iniciada': 'projeto',
  'Obra': 'execucao',
  'Documentação': 'licencas',
  'Projeto': 'projeto',
  'Conformidade': 'conformidade',
};

const ORIGEM_MAP = {
  'instagram': 'Instagram',
  'Indicação': 'Indicação',
};

const MESES = {
  janeiro: '01', fevereiro: '02', março: '03', abril: '04', maio: '05', junho: '06',
  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

// Duplicatas identificadas manualmente (linha descartada -> equivalente mantido):
//   linha 30: kaio Felipe (Não iniciada, quase vazia) -> descarta, mantém KAIO (linha 40, Obra)
//   linha 32: Bruna Kauanny (Não iniciada/Proposta aprovada) -> descarta, mantém BRUNA KAWANNY (linha 39, Obra)
const LINHAS_EXCLUIDAS = new Set([30, 32]);

// Nomes cuja etapa é forçada para "execucao" mesmo com Status="Não iniciada"
// (já são vendas aprovadas / obra em andamento, per decisão do usuário)
const OVERRIDE_EXECUCAO = new Set(['STEPHANYE (MIRLENE)', 'ANA CLARA']);

function parseValor(str) {
  if (!str || !str.trim()) return null;
  const n = str.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
  const v = parseFloat(n);
  return Number.isFinite(v) ? v : null;
}

function parseDataBR(str) {
  if (!str || !str.trim()) return null;
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function parseDataExtensa(str) {
  if (!str || !str.trim()) return null;
  const match = str.trim().match(/^(\d{1,2}) de (\w+) de (\d{4})$/i);
  if (!match) return null;
  const [, dd, mesNome, yyyy] = match;
  const mm = MESES[mesNome.toLowerCase()];
  if (!mm) return null;
  return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
}

function normalizarChave(nome) {
  return nome.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const raw = readFileSync(CSV_PATH, 'utf-8');
const rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true });

console.log(`Linhas lidas: ${rows.length}\n`);

const erros = [];
const registros = [];

for (const [i, row] of rows.entries()) {
  const linha = i + 2;
  if (LINHAS_EXCLUIDAS.has(linha)) continue;
  const nome = row['Nome']?.trim();
  if (!nome) continue;

  const statusRaw = row['Status']?.trim();
  let etapa = STATUS_TO_ETAPA[statusRaw];
  if (statusRaw && !etapa) { erros.push(`Linha ${linha} (${nome}): Status desconhecido "${statusRaw}".`); continue; }
  etapa = etapa || 'projeto';

  if (OVERRIDE_EXECUCAO.has(normalizarChave(nome))) etapa = 'execucao';

  const dataContato = parseDataExtensa(row['Início']) ?? parseDataBR(row['Data de Criação']);

  const origemRaw = row['Origem']?.trim();
  const origem = origemRaw ? (ORIGEM_MAP[origemRaw] ?? null) : null;
  if (origemRaw && !ORIGEM_MAP[origemRaw]) erros.push(`Linha ${linha} (${nome}): Origem desconhecida "${origemRaw}" — gravado como NULL.`);

  const responsavelRaw = row['Responsável']?.trim();
  const responsavel_id = responsavelRaw ? (RESPONSAVEIS[responsavelRaw.toUpperCase()] ?? null) : null;
  if (responsavelRaw && !responsavel_id) erros.push(`Linha ${linha} (${nome}): Responsável desconhecido "${responsavelRaw}" — gravado como NULL.`);

  registros.push({
    _linha: linha,
    cliente: nome,
    etapa,
    data_contato: dataContato,
    data_reuniao: parseDataBR(row['Data da Reunião']),
    origem,
    valor_venda: parseValor(row['Valor']),
    tamanho_imovel: row['Área']?.trim() || null,
    obs: row['Texto']?.trim() || null,
    responsavel_id,
    workspace_id: WORKSPACE_ID,
    lead_id: null, // preenchido abaixo, se houver match
  });
}

console.log(`Registros válidos: ${registros.length}`);
console.log(`Avisos/erros: ${erros.length}\n`);
if (erros.length) {
  console.log('--- Avisos ---');
  erros.forEach((e) => console.log(' - ' + e));
  console.log('');
}

// Tenta linkar cada obra a um lead já existente com o mesmo nome (aprovado ou não)
const { data: leadsExistentes, error: leadsErr } = await sb
  .from('leads')
  .select('id, nome, etapa')
  .eq('workspace_id', WORKSPACE_ID);
if (leadsErr) { console.error(leadsErr.message); process.exit(1); }

const leadsPorNome = new Map();
for (const l of leadsExistentes) leadsPorNome.set(normalizarChave(l.nome), l);

// "PAULO" (obra) e "Paulo" (lead em simulação) foram confirmados como pessoas
// diferentes pelo usuário — não linkar apesar do nome bater.
const IGNORAR_MATCH_LEAD = new Set(['PAULO']);

let matches = 0;
for (const r of registros) {
  if (IGNORAR_MATCH_LEAD.has(normalizarChave(r.cliente))) continue;
  const lead = leadsPorNome.get(normalizarChave(r.cliente));
  if (lead) { r.lead_id = lead.id; matches++; }
}

console.log(`--- Vínculo com leads existentes ---`);
console.log(`Obras linkadas a um lead por nome igual: ${matches}`);
for (const r of registros) {
  if (r.lead_id) console.log(`  "${r.cliente}" -> lead ${r.lead_id} (etapa do lead: ${leadsPorNome.get(normalizarChave(r.cliente)).etapa})`);
}
console.log('');

console.log('--- Resumo das obras a importar ---');
for (const r of registros) {
  console.log(`  linha ${r._linha} | ${r.cliente.padEnd(28)} | etapa=${r.etapa.padEnd(11)} | data_contato=${r.data_contato ?? '-'} | valor_venda=${r.valor_venda ?? '-'} | lead_id=${r.lead_id ? 'sim' : 'não'}`);
}

if (!COMMIT) {
  console.log('\n=== DRY RUN — nada foi gravado no banco. Rode com --commit para importar de fato. ===');
  process.exit(0);
}

console.log('\nGravando obras...');
const payload = registros.map(({ _linha, ...obra }) => obra);
const { data: inseridos, error: insErr } = await sb.from('obras').insert(payload).select('id');
if (insErr) { console.error('Erro ao inserir obras:', insErr.message); process.exit(1); }
console.log(`✓ ${inseridos.length} obras inseridas.`);
console.log('\n✅ Import concluído.');
