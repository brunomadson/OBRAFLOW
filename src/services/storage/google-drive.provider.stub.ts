// STUB — Google Drive Provider
// Para ativar: implemente esta classe com as credenciais OAuth2 do Google Cloud.
//
// Pré-requisitos:
//   1. Criar projeto no Google Cloud Console
//   2. Ativar a API Google Drive
//   3. Criar credenciais OAuth2 (Client ID + Client Secret)
//   4. Armazenar em variáveis de ambiente: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   5. Implementar o fluxo OAuth (necessita Next.js API Route em /api/auth/google)
//
// A estrutura de pastas no Drive seguirá:
//   📁 ObraFlow/
//     📁 {nome do cliente} - {cidade}/
//       📁 1.0 Docs Pessoais/
//       📁 2.0 Projetos/
//       📁 3.0 Eng. e Conformidade/
//       📁 4.0 Contrato/
//       📁 5.0 Medições/
//         📁 PLS 01/
//         📁 PLS 02/
//         ...

import type { IStorageProvider, UploadParams } from "./types";

export class GoogleDriveStorageProvider implements IStorageProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async upload(_params: UploadParams): Promise<string> {
    throw new Error(
      "GoogleDriveStorageProvider não implementado. " +
      "Configure as credenciais OAuth2 e implemente esta classe."
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSignedUrl(_path: string, _expiresIn?: number): Promise<string> {
    throw new Error("GoogleDriveStorageProvider não implementado.");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async delete(_path: string): Promise<void> {
    throw new Error("GoogleDriveStorageProvider não implementado.");
  }
}
