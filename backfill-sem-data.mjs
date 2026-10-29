import { sb } from './supabase-admin.mjs';
const WORKSPACE_ID = '88d8716f-083e-44bd-91f3-a391cda59d66';

const { data: semData, error: fetchErr } = await sb
  .from('leads')
  .select('id, nome')
  .eq('workspace_id', WORKSPACE_ID)
  .is('data_contato', null);
if (fetchErr) { console.error(fetchErr.message); process.exit(1); }

console.log(`Leads sem data_contato: ${semData.length}`);
semData.forEach((l) => console.log(' - ' + l.nome));

const { data: updated, error } = await sb
  .from('leads')
  .update({ data_contato: '2026-06-25' })
  .eq('workspace_id', WORKSPACE_ID)
  .is('data_contato', null)
  .select('id');
if (error) { console.error(error.message); process.exit(1); }
console.log(`\n✓ ${updated.length} leads atualizados com data_contato = 25/06/2026.`);
