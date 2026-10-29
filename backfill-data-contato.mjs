// backfill-data-contato.mjs
// Corrige um esquecimento do import-leads-comercial.mjs: o Dashboard Comercial
// filtra os leads por `data_contato` ("Data de Contato"), mas o import só tinha
// gravado a Data de Criação do Notion em lead_log, deixando data_contato NULL.
// Isso fazia o Dashboard (não o Pipeline) aparecer vazio pros leads importados.
//
// Rodar com: node --env-file=.env.local backfill-data-contato.mjs [--commit]

import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { sb } from './supabase-admin.mjs';

const WORKSPACE_ID = '88d8716f-083e-44bd-91f3-a391cda59d66';
const CSV_PATH = './import-data/pipeline-comercial-all.csv';
const COMMIT = process.argv.includes('--commit');

// Mesma exclusão de duplicados usada no import original
const LINHAS_EXCLUIDAS = new Set([19, 69, 63, 67, 89, 90]);

function parseData(str) {
  if (!str || !str.trim()) return null;
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function normalizarChave(nome) {
  return nome.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const raw = readFileSync(CSV_PATH, 'utf-8');
const rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true });

const { data: leadsExistentes, error: fetchErr } = await sb
  .from('leads')
  .select('id, nome, data_contato')
  .eq('workspace_id', WORKSPACE_ID);
if (fetchErr) { console.error(fetchErr.message); process.exit(1); }

const porNome = new Map();
for (const l of leadsExistentes) {
  porNome.set(normalizarChave(l.nome), l);
}

let atualizados = 0;
let semData = 0;
let semMatch = 0;

for (const [i, row] of rows.entries()) {
  const linha = i + 2;
  if (LINHAS_EXCLUIDAS.has(linha)) continue;
  const nome = row['Nome do empreendimento']?.trim();
  if (!nome) continue;

  const dataContato = parseData(row['Data de Criação']);
  if (!dataContato) { semData++; continue; }

  const lead = porNome.get(normalizarChave(nome));
  if (!lead) { semMatch++; console.log(`Sem match no banco: "${nome}" (linha ${linha})`); continue; }
  if (lead.data_contato) continue; // já preenchido, não sobrescreve

  if (COMMIT) {
    const { error } = await sb.from('leads').update({ data_contato: dataContato }).eq('id', lead.id);
    if (error) { console.log(`✗ ${nome}: ${error.message}`); continue; }
  }
  atualizados++;
}

console.log(`\nLeads com data_contato ${COMMIT ? 'atualizada' : 'a atualizar'}: ${atualizados}`);
console.log(`Sem "Data de Criação" no CSV: ${semData}`);
console.log(`Sem correspondência no banco: ${semMatch}`);
console.log(COMMIT ? '\n✅ Backfill concluído.' : '\n=== DRY RUN — rode com --commit para gravar. ===');
