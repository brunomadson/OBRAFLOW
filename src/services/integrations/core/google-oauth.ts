import { createHmac, timingSafeEqual } from "node:crypto";

// Mecânica OAuth compartilhada entre google-drive e google-calendar (mesmo
// vendor, mesmo fluxo "authorization code" — só mudam os scopes). Não é
// abstração prematura: as duas integrações realmente compartilham esse
// código, diferente de WhatsApp/IA/Pagamentos, que nem existem ainda.
//
// NÃO TESTADO CONTRA A API REAL DO GOOGLE — não há projeto no Google Cloud
// Console configurado ainda (GOOGLE_CLIENT_ID/SECRET ausentes). O fluxo
// segue exatamente o padrão "OAuth 2.0 Authorization Code" documentado pelo
// Google, mas só uma configuração real + teste ao vivo confirma de fato.

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "OAuth do Google não configurado (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI) — " +
        "ver .env.example. Sem isso, connect() não consegue gerar a URL de autorização."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

// state assinado (HMAC) em vez de guardado numa tabela à parte — não
// precisa de storage extra, só precisa não ser forjável e expirar rápido
// (proteção CSRF do fluxo OAuth).
export function signState(payload: { workspaceId: string; userId: string; slug: string }): string {
  const secret = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!secret) throw new Error("INTEGRATIONS_ENCRYPTION_KEY não configurada.");
  const body = JSON.stringify({ ...payload, ts: Date.now() });
  const bodyB64 = Buffer.from(body, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(bodyB64).digest("base64url");
  return `${bodyB64}.${sig}`;
}

export function verifyState(state: string, maxAgeMs = 10 * 60 * 1000): { workspaceId: string; userId: string; slug: string } {
  const secret = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!secret) throw new Error("INTEGRATIONS_ENCRYPTION_KEY não configurada.");
  const [bodyB64, sig] = state.split(".");
  if (!bodyB64 || !sig) throw new Error("state inválido (formato).");

  const sigEsperada = createHmac("sha256", secret).update(bodyB64).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(sigEsperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("state inválido (assinatura não confere).");

  const payload = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8"));
  if (Date.now() - payload.ts > maxAgeMs) throw new Error("state expirado — tente conectar de novo.");
  return payload;
}

export function buildAuthUrl(scopes: string[], state: string): string {
  const { clientId, redirectUri } = getGoogleOAuthConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline"); // precisa de refresh_token
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Falha ao trocar code por token (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Falha ao renovar token (${res.status}): ${await res.text()}`);
  return res.json();
}
