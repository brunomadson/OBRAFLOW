import { sb } from './supabase-admin.mjs';
const { data, error } = await sb.from('lancamentos').select('*').limit(1);
if (error) { console.error('Erro lancamentos:', error.message); }
else if (data.length > 0) { console.log('LANCAMENTOS cols:', Object.keys(data[0]).join(', ')); }
else { console.log('LANCAMENTOS: tabela vazia, sem colunas para inspecionar'); }

const { data: o, error: eo } = await sb.from('obras').select('*').limit(1);
if (eo) { console.error('Erro obras:', eo.message); }
else if (o.length > 0) { console.log('OBRAS cols:', Object.keys(o[0]).join(', ')); }
