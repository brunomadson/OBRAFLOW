// check-concretize-data.mjs
// Leitura apenas: conta registros no workspace real da CONCRETIZE ENGENHARIA
// pra decidir o que zerar antes da migração real do Notion.
import { sb } from './supabase-admin.mjs';

const { data: ws, error: wErr } = await sb
  .from('workspaces')
  .select('id, nome')
  .ilike('nome', '%concretize%');

if (wErr) { console.error(wErr.message); process.exit(1); }
if (!ws || ws.length === 0) { console.log('Nenhum workspace CONCRETIZE encontrado.'); process.exit(0); }

for (const w of ws) {
  console.log(`\n=== Workspace: ${w.nome} (${w.id}) ===`);
  for (const tabela of ['leads', 'obras', 'lancamentos', 'medicoes', 'documentos', 'lead_log', 'obra_log', 'historico', 'profiles', 'workspace_invites']) {
    const { count, error } = await sb
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', w.id);
    if (error) console.log(`  ${tabela}: erro (${error.message})`);
    else console.log(`  ${tabela}: ${count}`);
  }
}
