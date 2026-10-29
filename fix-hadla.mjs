import { sb } from './supabase-admin.mjs';

const WORKSPACE_ID = '88d8716f-083e-44bd-91f3-a391cda59d66';

const { data: obras, error: findErr } = await sb
  .from('obras')
  .select('id, cliente, etapa')
  .eq('workspace_id', WORKSPACE_ID)
  .ilike('cliente', '%HADLA%');
if (findErr) { console.error(findErr.message); process.exit(1); }

console.log('Encontradas:', obras);

const { data: updated, error: updErr } = await sb
  .from('obras')
  .update({ etapa: 'contrato' })
  .eq('workspace_id', WORKSPACE_ID)
  .ilike('cliente', '%HADLA%')
  .select('id, cliente, etapa');
if (updErr) { console.error(updErr.message); process.exit(1); }

console.log('Atualizadas:', updated);
