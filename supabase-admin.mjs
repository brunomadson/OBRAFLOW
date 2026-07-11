// supabase-admin.mjs
// Client compartilhado com privilégio de service_role para os scripts locais
// (seed-*.mjs, check-schema.mjs, run-migration.mjs, add-cor.mjs, reset-*.mjs).
//
// NUNCA importar este arquivo de dentro de src/ — service_role ignora RLS e
// não pode chegar ao navegador. Uso é exclusivamente Node, linha de comando.
//
// Rodar os scripts que importam isto com:
//   node --env-file=.env.local <script>.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    '\n❌ Faltam variáveis de ambiente (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).\n' +
    '   Rode o script assim:\n' +
    '     node --env-file=.env.local <script>.mjs\n' +
    '   Confira se SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão preenchidos em .env.local.\n'
  );
  process.exit(1);
}

export const sb = createClient(url, key);
