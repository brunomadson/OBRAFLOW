import { createClient } from "./server";
import type { User } from "@supabase/supabase-js";

// Server-only. Usar no início de toda rota /api/admin/** antes de tocar em
// qualquer dado cross-tenant. Não usa a service role pra checar — usa o
// client autenticado normal (cookie de sessão) + is_saas_admin() (RPC
// SECURITY DEFINER, migration 041), então a checagem em si já respeita
// "quem é esse usuário" sem precisar confiar em nada vindo do client.
export async function getSaasAdminUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: isAdmin, error } = await supabase.rpc("is_saas_admin");
  if (error) {
    console.error("[requireSaasAdmin] falha ao checar is_saas_admin():", error.message);
    return null;
  }
  if (!isAdmin) return null;

  return user;
}
