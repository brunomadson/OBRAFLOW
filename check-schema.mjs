import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://zrzqvdurgkqmoizlpeof.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyenF2ZHVyZ2txbW9pemxwZW9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjUxNjIwOSwiZXhwIjoyMDk4MDkyMjA5fQ.QjStR__xmpYUyuChh6mxzs-ZMQzQXIXKSFNJs3pig7w'
);
const { data, error } = await sb.from('lancamentos').select('*').limit(1);
if (error) { console.error('Erro lancamentos:', error.message); }
else if (data.length > 0) { console.log('LANCAMENTOS cols:', Object.keys(data[0]).join(', ')); }
else { console.log('LANCAMENTOS: tabela vazia, sem colunas para inspecionar'); }

const { data: o, error: eo } = await sb.from('obras').select('*').limit(1);
if (eo) { console.error('Erro obras:', eo.message); }
else if (o.length > 0) { console.log('OBRAS cols:', Object.keys(o[0]).join(', ')); }
