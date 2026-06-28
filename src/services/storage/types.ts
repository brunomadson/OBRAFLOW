// Interface de abstração de storage — permite trocar Supabase por Google Drive,
// S3, OneDrive etc. sem alterar nenhuma regra de negócio.

export interface UploadParams {
  file: File;
  path: string;        // caminho dentro do bucket/folder (ex: "lead123/pessoal/cnh.pdf")
  metadata?: Record<string, string>;
}

export interface IStorageProvider {
  upload(params: UploadParams): Promise<string>;        // retorna o path salvo
  getSignedUrl(path: string, expiresIn?: number): Promise<string>; // URL temporária para download
  delete(path: string): Promise<void>;
}
