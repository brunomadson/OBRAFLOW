import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Client com privilégio de service_role — ignora RLS.
//
// USO EXCLUSIVO server-side (route handlers em src/app/api/**, nunca em
// componente "use client" nem em qualquer arquivo importado por um).
// SUPABASE_SERVICE_ROLE_KEY não tem prefixo NEXT_PUBLIC_, então o Next.js
// nunca inclui essa variável no bundle do navegador — mas a disciplina de
// só chamar createAdminClient() a partir de route handlers continua sendo
// a proteção real.
//
// Motivo de existir separado de supabase-admin.mjs (raiz do projeto): aquele
// arquivo é só para scripts Node de linha de comando e seu próprio
// comentário proíbe importação de dentro de src/.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
