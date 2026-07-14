import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM. Server-only (usa Node "crypto" nativo, não roda no
// navegador). A chave nunca fica no banco — só em INTEGRATIONS_ENCRYPTION_KEY
// (variável de ambiente do servidor), então mesmo um dump completo do
// Postgres não expõe nenhum token OAuth em texto claro.
//
// Formato armazenado (base64 de "iv:authTag:ciphertext" concatenados) —
// autocontido, não precisa de coluna extra pro IV.

function getKey(): Buffer {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw) throw new Error("INTEGRATIONS_ENCRYPTION_KEY não configurada — não é possível cifrar/decifrar credenciais.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("INTEGRATIONS_ENCRYPTION_KEY precisa ser uma chave de 32 bytes em base64 (ex.: openssl rand -base64 32).");
  return key;
}

export function encryptCredentials(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptCredentials(encoded: string): string {
  const key = getKey();
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
