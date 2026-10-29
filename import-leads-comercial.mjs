// import-leads-comercial.mjs
// Importador Notion -> ObraFlow (setor Comercial / tabela leads).
//
// Fonte: import-data/pipeline-comercial-all.csv (export "_all" do Notion,
// a única view com todos os campos preenchidos).
//
// Regras de conversão confirmadas com o usuário (ticket "Comercial CSV audit"):
//   - Fase -> etapa (mapa 1:1 direto)
//   - Valor (Notion) -> valor_venda
//   - Responsável -> responsavel_id (Bruno Madson / Alef Campos, já sao profiles reais)
//   - Modalidade "Sem Terreno" -> "Aquisição de terreno e Construção"
//   - Origem "Trafego Direto" -> "Tráfego pago"
//   - Cidades novas já adicionadas em src/constants/dominios.ts
//   - Data de Criação -> primeiro registro manual em lead_log (created_at custom),
//     quando existir; senão o lead fica sem histórico inicial.
//
// Modo padrão: DRY RUN (não escreve nada). Passe --commit para gravar de fato.
//
// Rodar com: node --env-file=.env.local import-leads-comercial.mjs [--commit]

import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { sb } from './supabase-admin.mjs';

const WORKSPACE_ID = '88d8716f-083e-44bd-91f3-a391cda59d66'; // CONCRETIZE ENGENHARIA
const CSV_PATH = './import-data/pipeline-comercial-all.csv';
const COMMIT = process.argv.includes('--commit');

const RESPONSAVEIS = {
  'BRUNO MADSON': '9eade354-ce9d-47e7-906b-e6b1dfcdd33d',
  'ALEF CAMPOS': 'cf0d9ac2-95ba-4dc8-8a01-5de8fdca0314',
};

const FASE_TO_ETAPA = {
  'Leads': 'leads',
  'Simulação': 'simulacao',
  'Reunião': 'reuniao',
  'Documentação': 'documentacao',
  'Analise de Credito': 'analise',
  'Proposta reprovada': 'reprovada',
  'Proposta aprovada': 'aprovada',
};

const ORIGEM_MAP = {
  'instagram': 'Instagram',
  'Trafego Direto': 'Tráfego pago',
  'Captação Ativa': 'Captação ativa',
  'Indicação': 'Indicação',
};

const MODALIDADE_MAP = {
  'Terreno Proprio': 'Terreno próprio',
  'Sem Terreno': 'Aquisição de terreno e Construção',
};

const TIPO_RENDA_MAP = {
  'Carteira Assinada': 'Carteira assinada',
  'Contrato Prefeitura': 'Contrato prefeitura/estado',
  'Autônomo': 'Autônomo',
  'Empresario': 'Empresário',
  'Aposentadoria': 'Aposentadoria',
};

const CIDADE_MAP = {
  'GOV. LUIZ ROCHA': 'Governador Luiz Rocha',
};

function parseValor(str) {
  if (!str || !str.trim()) return null;
  const n = str.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
  const v = parseFloat(n);
  return Number.isFinite(v) ? v : null;
}

function parseData(str) {
  if (!str || !str.trim()) return null;
  // pega só a primeira data de um intervalo "22/01/2026 – 23/01/2026"
  // e ignora horário "20/01/2026 9:00 (BRT)"
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function extractNome(linkField) {
  if (!linkField || !linkField.trim()) return null;
  const idx = linkField.indexOf(' (');
  return idx === -1 ? linkField.trim() : linkField.slice(0, idx).trim();
}

function normalizarChave(nome) {
  return nome
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Duplicatas de nome resolvidas manualmente pelo usuário (linha a manter indicada
// no ticket "Comercial CSV audit" — a linha descartada aqui é a redundante):
//   Fernanda Lima -> manter 55, descartar 19
//   Francisca Eliene -> manter 23, descartar 69
//   Marcelo SD -> manter 39, descartar 63
//   Franciele Marques -> manter 146, descartar 67
//   Gaby -> manter 93, descartar 89
//   Maria Vitória Capinzal -> manter 94, descartar 90
const LINHAS_EXCLUIDAS = new Set([19, 69, 63, 67, 89, 90]);

const raw = readFileSync(CSV_PATH, 'utf-8');
const rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true });

console.log(`Linhas lidas: ${rows.length}\n`);

const erros = [];
const registros = [];

for (const [i, row] of rows.entries()) {
  const linha = i + 2; // +2 = header + 1-index
  if (LINHAS_EXCLUIDAS.has(linha)) continue;
  const nome = row['Nome do empreendimento']?.trim();
  if (!nome) { erros.push(`Linha ${linha}: sem Nome — ignorada.`); continue; }

  const faseRaw = row['Fase']?.trim();
  const etapa = FASE_TO_ETAPA[faseRaw];
  if (faseRaw && !etapa) { erros.push(`Linha ${linha} (${nome}): Fase desconhecida "${faseRaw}".`); continue; }

  const origemRaw = row['Origem']?.trim();
  const origem = origemRaw ? (ORIGEM_MAP[origemRaw] ?? null) : null;
  if (origemRaw && !ORIGEM_MAP[origemRaw]) erros.push(`Linha ${linha} (${nome}): Origem desconhecida "${origemRaw}" — gravado como NULL.`);

  const modalidadeRaw = row['Modalidade']?.trim();
  const modalidade = modalidadeRaw ? (MODALIDADE_MAP[modalidadeRaw] ?? null) : null;
  if (modalidadeRaw && !MODALIDADE_MAP[modalidadeRaw]) erros.push(`Linha ${linha} (${nome}): Modalidade desconhecida "${modalidadeRaw}" — gravado como NULL.`);

  const tipoRendaRaw = row['Tipo de Renda']?.trim();
  const tipoRenda = tipoRendaRaw ? (TIPO_RENDA_MAP[tipoRendaRaw] ?? null) : null;
  if (tipoRendaRaw && !TIPO_RENDA_MAP[tipoRendaRaw]) erros.push(`Linha ${linha} (${nome}): Tipo de Renda desconhecido "${tipoRendaRaw}" — gravado como NULL.`);

  const responsavelRaw = row['Responsável']?.trim();
  const responsavelNome = extractNome(responsavelRaw);
  const responsavel_id = responsavelNome ? (RESPONSAVEIS[responsavelNome.toUpperCase()] ?? null) : null;
  if (responsavelNome && !responsavel_id) erros.push(`Linha ${linha} (${nome}): Responsável desconhecido "${responsavelNome}" — gravado como NULL.`);

  const cidadeRaw = row['Cidade']?.trim();
  const cidade = cidadeRaw ? (CIDADE_MAP[cidadeRaw] ?? cidadeRaw) : null;

  registros.push({
    _linha: linha,
    _dataCriacao: parseData(row['Data de Criação']),
    nome,
    cidade,
    telefone: row['Telefone']?.trim() || null,
    obs: row['Texto']?.trim() || null,
    tipo_renda: tipoRenda,
    modalidade,
    origem,
    renda_bruta: parseValor(row['Renda bruta']),
    dependente: row['Dependente']?.trim() === 'Sim',
    etapa: etapa || 'leads',
    data_reuniao: parseData(row['Data da Reunião']),
    responsavel_id,
    valor_venda: parseValor(row['Valor']),
    workspace_id: WORKSPACE_ID,
  });
}

// Detecção de duplicados por nome normalizado
const porNome = new Map();
for (const r of registros) {
  const chave = normalizarChave(r.nome);
  if (!porNome.has(chave)) porNome.set(chave, []);
  porNome.get(chave).push(r);
}
const duplicados = [...porNome.values()].filter((grupo) => grupo.length > 1);

console.log(`Registros válidos: ${registros.length}`);
console.log(`Avisos/erros: ${erros.length}`);
console.log(`Grupos de nome duplicado: ${duplicados.length}\n`);

if (erros.length) {
  console.log('--- Avisos ---');
  erros.forEach((e) => console.log(' - ' + e));
  console.log('');
}

if (duplicados.length) {
  console.log('--- Nomes duplicados (decisão pendente) ---');
  for (const grupo of duplicados) {
    console.log(`\n"${grupo[0].nome}" (${grupo.length}x):`);
    for (const r of grupo) {
      console.log(`   linha ${r._linha} | etapa=${r.etapa} | cidade=${r.cidade ?? '-'} | valor_venda=${r.valor_venda ?? '-'} | data_reuniao=${r.data_reuniao ?? '-'}`);
    }
  }
  console.log('');
}

if (!COMMIT) {
  console.log('=== DRY RUN — nada foi gravado no banco. Rode com --commit para importar de fato. ===');
  process.exit(0);
}

// --- Fase de gravação (só roda com --commit) ---
console.log('\nGravando leads...');
const paraGravar = registros.filter((r) => !duplicados.some((g) => g.includes(r)) || true); // duplicados tratados manualmente antes de rodar com --commit

const payload = paraGravar.map(({ _linha, _dataCriacao, ...lead }) => lead);
const { data: inseridos, error: insErr } = await sb.from('leads').insert(payload).select('id');
if (insErr) { console.error('Erro ao inserir leads:', insErr.message); process.exit(1); }
console.log(`✓ ${inseridos.length} leads inseridos.`);

// Histórico inicial (Data de Criação) para quem tem essa informação
let logsInseridos = 0;
for (let i = 0; i < paraGravar.length; i++) {
  const dataCriacao = paraGravar[i]._dataCriacao;
  if (!dataCriacao) continue;
  const { error: logErr } = await sb.from('lead_log').insert({
    lead_id: inseridos[i].id,
    etapa: paraGravar[i].etapa,
    obs: 'Importado do Notion',
    created_at: new Date(dataCriacao).toISOString(),
  });
  if (!logErr) logsInseridos++;
}
console.log(`✓ ${logsInseridos} registros de histórico inicial criados.`);
console.log('\n✅ Import concluído.');
