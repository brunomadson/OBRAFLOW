// Factory de storage — troque o provider aqui quando quiser usar Google Drive
import { SupabaseStorageProvider } from "./supabase.provider";
// import { GoogleDriveStorageProvider } from "./google-drive.provider.stub";

export type { IStorageProvider } from "./types";

let _provider: InstanceType<typeof SupabaseStorageProvider> | null = null;

export function getStorageProvider() {
  if (!_provider) _provider = new SupabaseStorageProvider();
  return _provider;
  // Para usar Google Drive: return new GoogleDriveStorageProvider();
}
