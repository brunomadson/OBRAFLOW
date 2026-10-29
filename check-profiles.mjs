import { sb } from './supabase-admin.mjs';
const WORKSPACE_ID = '88d8716f-083e-44bd-91f3-a391cda59d66';

const { data, error } = await sb
  .from('profiles')
  .select('id, nome, cargo, ativo')
  .eq('workspace_id', WORKSPACE_ID);
if (error) console.error(error.message);
console.log(data);
