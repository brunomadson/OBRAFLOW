import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

export async function updateSession(request: NextRequest) {
  // Cria uma response mutável que será retornada ao final.
  // O Supabase pode precisar atualizar cookies de sessão (token rotation),
  // por isso não podemos usar NextResponse.next() diretamente.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          // Atualiza os cookies na request para uso downstream
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Recria a response incluindo os cookies atualizados
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: Não inserir nenhuma lógica entre createServerClient e getUser().
  // getUser() valida o JWT junto ao servidor Supabase e renova a sessão
  // quando necessário (refresh token rotation). É a única forma segura
  // de verificar autenticação no middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthPage   = pathname.startsWith("/login");
  const isPublicPage =
    pathname === "/" ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/aceitar-convite") ||
    pathname.startsWith("/onboarding");

  if (!user && !isAuthPage && !isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/comercial";
    return NextResponse.redirect(url);
  }

  // Retorna supabaseResponse (não NextResponse.next()) para garantir
  // que cookies de sessão atualizados sejam propagados ao browser.
  return supabaseResponse;
}
