// backup-manual.mjs
// Backup manual e gratuito, enquanto o plano do Supabase não inclui backup
// automático (Free tier não tem PITR nem snapshot diário — ver
// BACKUP_RECOVERY.md). Exporta todas as tabelas do schema pra arquivos
// JSON locais, um por tabela, dentro de backups/<data-hora>/.
//
// NÃO substitui um backup de verdade (não é um dump binário do Postgres,
// não inclui os arquivos do Storage) — é uma rede de segurança mínima
// contra "apaguei/corrompi uma tabela sem querer", não contra desastre de
// infraestrutura. Ver BACKUP_RECOVERY.md pra quando faz sentido migrar
// pro plano Pro (backup automático de verdade).
//
// Rodar com: node --env-file=.env.local backup-manual.mjs
// Recomendado: rodar periodicamente (ex. semanal) enquanto estiver no Free.

import { writeFileSync, mkdirSync } from 'node:fs';
import { sb } from './supabase-admin.mjs';

// Ordem não importa pra exportação (sem FK a respeitar num dump simples).
const TABELAS = [
  'workspaces', 'profiles', 'cargos', 'permissoes_cargo',
  'leads', 'lead_log', 'obras', 'obra_log', 'medicoes', 'lancamentos',
  'documentos', 'historico', 'config', 'cidades', 'corretores',
  'correspondentes', 'workspace_invites', 'metas_dashboard',
  'planos', 'integracoes', 'plano_integracoes', 'workspace_integracoes',
];

const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
const dir = `backups/${timestamp}`;
mkdirSync(dir, { recursive: true });

console.log(`\n💾  Backup manual — ${timestamp}\n`);

let totalLinhas = 0;
const resumo = [];

for (const tabela of TABELAS) {
  const { data, error } = await sb.from(tabela).select('*');
  if (error) {
    console.log(`✗ ${tabela}: ${error.message}`);
    resumo.push({ tabela, erro: error.message });
    continue;
  }
  writeFileSync(`${dir}/${tabela}.json`, JSON.stringify(data, null, 2));
  console.log(`✓ ${tabela}: ${data.length} linha(s)`);
  totalLinhas += data.length;
  resumo.push({ tabela, linhas: data.length });
}

writeFileSync(`${dir}/_resumo.json`, JSON.stringify({ timestamp, totalLinhas, tabelas: resumo }, null, 2));

console.log(`\n✅  Backup salvo em ${dir}/ (${totalLinhas} linhas no total)`);
console.log('⚠️  Contém dado real de cliente — guarde fora do repositório git (já está no .gitignore),');
console.log('    idealmente copiado pra um local seguro (Drive, disco externo, etc).');
console.log('\n⚠️  Isto NÃO inclui os arquivos do Storage (documentos anexados) — só os');
console.log('    metadados na tabela "documentos". Ver BACKUP_RECOVERY.md.\n');
