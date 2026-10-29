import { sb } from './supabase-admin.mjs';
const WORKSPACE_ID = '88d8716f-083e-44bd-91f3-a391cda59d66';

const { data, error, count } = await sb
  .from('historico')
  .select('id, tipo, acao, workspace_id', { count: 'exact' })
  .eq('workspace_id', WORKSPACE_ID)
  .limit(5);
console.log('count:', count, 'error:', error?.message);
console.log(data);
