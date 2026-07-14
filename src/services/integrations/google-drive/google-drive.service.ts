import { getDecryptedCredentials } from "../core/integration-provider";
import { refreshAccessToken, type GoogleTokens } from "../core/google-oauth";
import type { IntegrationContext } from "../core/integration-types";

// Chamadas de baixo nível à API do Google Drive v3 — via fetch cru, sem SDK
// (mesmo estilo de google-oauth.ts). scope "drive.file": só dá acesso a
// arquivos/pastas CRIADOS por este app, nunca ao Drive inteiro do usuário —
// escolha deliberada de escopo mínimo, já feita na Sprint 11.1.
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export function getGoogleDriveScopes(): string[] {
  return SCOPES;
}

interface StoredCredentials extends GoogleTokens {
  obtained_at: number;
}

// Pega o access_token válido, renovando com o refresh_token se já expirou.
// Não persiste o token renovado de volta no banco aqui de propósito — quem
// chama (provider) decide se quer persistir, mantém esta função sem
// efeito colateral de escrita.
export async function getValidAccessToken(ctx: IntegrationContext): Promise<{ accessToken: string; refreshed: GoogleTokens | null }> {
  const creds = await getDecryptedCredentials<StoredCredentials>(ctx, "google_drive");
  if (!creds) throw new Error("Google Drive não está conectado neste workspace.");

  const expirado = Date.now() > creds.obtained_at + creds.expires_in * 1000 - 60_000; // 1 min de folga
  if (!expirado) return { accessToken: creds.access_token, refreshed: null };

  if (!creds.refresh_token) throw new Error("Token do Google Drive expirou e não há refresh_token salvo — é preciso reconectar.");
  const novo = await refreshAccessToken(creds.refresh_token);
  return { accessToken: novo.access_token, refreshed: novo };
}

// Chamada mínima só pra confirmar que o token realmente autentica contra a
// API do Google (usada por validateConnection()) — não lista nem baixa
// nenhum arquivo.
export async function pingDrive(accessToken: string): Promise<boolean> {
  const res = await fetch(`${DRIVE_API}/about?fields=user`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok;
}

async function driveFetch(accessToken: string, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`Google Drive API falhou (${res.status} ${path}): ${corpo}`);
  }
  return res;
}

// ── Pastas ────────────────────────────────────────────────────────────────────

export async function createDriveFolder(
  accessToken: string,
  nome: string,
  parentId: string | null
): Promise<string> {
  const res = await driveFetch(accessToken, "/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: nome,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
  const data = await res.json();
  return data.id as string;
}

// Move uma pasta/arquivo pra outro pai — a API do Drive não tem "mover",
// é literalmente trocar de parents (arquivo pode ter vários pais, mas
// aqui sempre tratamos como hierarquia de pasta única: remove o antigo,
// adiciona o novo).
export async function moveDriveItem(
  accessToken: string,
  itemId: string,
  novoParentId: string,
  antigoParentId: string
): Promise<void> {
  await driveFetch(
    accessToken,
    `/files/${itemId}?addParents=${novoParentId}&removeParents=${antigoParentId}&fields=id`,
    { method: "PATCH" }
  );
}

export async function renameDriveItem(accessToken: string, itemId: string, novoNome: string): Promise<void> {
  await driveFetch(accessToken, `/files/${itemId}?fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: novoNome }),
  });
}

export async function listDriveFiles(
  accessToken: string,
  folderId: string
): Promise<Array<{ id: string; name: string; mimeType: string; modifiedTime: string }>> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const res = await driveFetch(accessToken, `/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)`);
  const data = await res.json();
  return data.files ?? [];
}

// ── Arquivos ──────────────────────────────────────────────────────────────────

// Upload multipart (metadata + bytes numa request só) — suficiente pra
// documentos de construção civil (PDF, foto, planilha), não é o caso de
// vídeo grande que precisaria de upload resumível.
export async function uploadDriveFile(
  accessToken: string,
  params: { nome: string; mimeType: string; bytes: Uint8Array; parentId: string }
): Promise<{ id: string; webViewLink: string | null }> {
  const boundary = `obraflow-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: params.nome, parents: [params.parentId] });

  const encoder = new TextEncoder();
  const parts: BlobPart[] = [
    encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    encoder.encode(`--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`),
    params.bytes as BlobPart,
    encoder.encode(`\r\n--${boundary}--`),
  ];
  const body = new Blob(parts);

  const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Falha no upload pro Google Drive (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, webViewLink: data.webViewLink ?? null };
}

export async function downloadDriveFile(accessToken: string, fileId: string): Promise<ArrayBuffer> {
  const res = await driveFetch(accessToken, `/files/${fileId}?alt=media`);
  return res.arrayBuffer();
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  await driveFetch(accessToken, `/files/${fileId}`, { method: "DELETE" });
}
