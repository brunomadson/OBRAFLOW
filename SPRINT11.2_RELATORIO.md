# Sprint 11.2 — Storage Híbrido + Google Drive Provider

**Status: migration aplicada, tudo testado de verdade — 14/14 em `storage-hibrido-test.mjs`
(incluindo o mecanismo de fallback ponta a ponta via HTTP real) + regressão sem quebra
(`security-test` 14/14, `rbac-documentos-test` 22/22). `npm run build`/`type-check` passando.**

## Decisões-chave (confirmadas na conversa antes de codar)

- **Supabase continua sendo o padrão** — `workspaces.storage_provider` (novo, default `'supabase'`). Ninguém é obrigado a conectar nada.
- **Reaproveitado, não duplicado**: `workspace_integracoes` (Sprint 11.1) continua sendo a única fonte de conexão/credencial. Achei e reaproveitei uma abstração `IStorageProvider` que já existia no projeto (`src/services/storage/`, usada de verdade por `documentos.service.ts`) — e removi o `google-drive.provider.stub.ts` que nunca foi implementado, pra não ficar com duas ideias de "provider do Google Drive" no código.
- **Roteamento por documento, não por workspace**: quem decide de onde baixar/apagar um documento é o registro `document_storage_sync` daquele documento específico — trocar o provider do workspace nunca migra o que já existe.
- **Fallback com fila de pendência** (regra combinada): se o Drive falhar no momento do upload, o arquivo vai pro Supabase mesmo assim (upload nunca falha pro usuário), fica marcado `pendente_migracao`, e sobe sozinho pro Drive na próxima vez que a conexão for confirmada saudável — sem precisar de sincronização bidirecional completa pra isso funcionar.
- **PLS 01-05 são pastas fixas**, não uma por linha de `medicoes` — achado real lendo `AbaDocumentos.tsx` antes de automatizar (a tabela `medicoes` financeira não tem relação 1:1 com isso).

## Migration criada

**`045_storage_hibrido.sql`** (pendente de aplicar):
- `workspaces.storage_provider` (supabase/google_drive/dropbox/onedrive, default supabase)
- `planos.storage_limit_mb` (estrutura preparada, cálculo de uso e aviso de 80% ficam pra quando a tela consumir — `documentos.tamanho_bytes` já existe desde a migration 006, populado no upload)
- `document_storage_sync` (genérico, `provider` como coluna — não é `google_drive_files`). RLS herda a visibilidade de `documentos` via `EXISTS`, sem duplicar a regra de continuidade lead→obra.
- `entity_storage_folders` (genérico, `chave` controlada em código — não é enum fixo no banco, não precisa de migration nova pra cada subpasta nova)

## Arquitetura criada

- `src/services/integrations/google-drive/google-drive.service.ts` — estendido com as chamadas reais da API do Drive (`createFolder`, `uploadFile` multipart, `download`, `delete`, `rename`, `move`, `list`). Compõe no MESMO objeto provider da Sprint 11.1 (não duplica OAuth/credencial).
- `src/services/storage/folderStructure.ts` — estrutura oficial (OBRAFLOW → Comercial/Obras/Financeiro → pasta do cliente → 5 subpastas + PLS 01-05), `find-or-create` idempotente por `chave` (proteção contra o mesmo tipo de corrida que já pegou o webhook da Sprint 9).
- `src/services/storage/documentoHibrido.service.ts` — orquestra upload/download/exclusão híbridos + `promoverPendentes()` (a fila combinada).
- `src/services/storage/documentNaming.service.ts` — `TIPO_DOCUMENTO_NOME_CLIENTE_CIDADE`, isolado de propósito pra poder virar IA depois sem tocar em quem chama.
- Rotas: `/api/storage/documentos` (upload), `/api/storage/documentos/[id]` (download/delete), `/api/storage/leads/[leadId]/folder-event` (gatilho de automação), `/api/storage/provider` (trocar o padrão do workspace — só permite mudar pra um provider já conectado de verdade).

## Automação conectada nos gatilhos REAIS (não hipotéticos)

Auditei o código antes de acoplar: os 3 pontos ficam em `useLeads.ts`/`useObras.ts` (hooks client), não em services. Conectado via chamada fire-and-forget (mesmo padrão de `registrarHistorico(...).catch(()=>{})` já usado ali):
- `avancarEtapa` → cria pasta do cliente quando chega em "documentacao"; move pasta quando aprova/reprova.
- `enviarParaObras` → move a pasta (mesma linha, mesma filosofia de `lead_id` nunca virar `obra_id`) de Comercial pra Obras.

**Não conectado nesta sprint**: avanço de etapa da OBRA (mover entre 2.1/2.2/2.3 conforme a obra progride) — precisaria auditar um 4º gatilho que não foi mapeado ainda. Fica como próximo passo natural, não bloqueia o resto.

## Bugs reais achados e corrigidos ANTES de qualquer teste rodar

- `nome padronizado` com acento quebraria se eu tivesse deixado caractere combinado literal no arquivo fonte — troquei por `String.fromCharCode` explícito.
- `excluirDocumentoHibrido` não limpava a linha de sync de documento `pendente_migracao`, o que deixaria `promoverPendentes` tentando "ressuscitar" um arquivo já excluído pelo usuário — corrigido, e `promoverPendentes` agora também ignora documento com `ativo=false` como segunda camada de proteção.
- `deleteDocumento` (client) sempre tentava apagar do Supabase mesmo quando o arquivo estava só no Drive — corrigido pra só apagar fisicamente quando a rota confirma que precisa.

## Testes

- `npm run build` / `type-check`: passando.
- Regressão (`security-test.mjs` 14/14, `rbac-documentos-test.mjs` 22/22): sem quebra.
- `storage-hibrido-test.mjs`: **14/14 passando**, rodado de verdade contra o banco + `npm run dev`. Cobre RLS de `document_storage_sync`/`entity_storage_folders`, isolamento cross-tenant, trava de "não pode trocar pra um provider desconectado", e — o mais importante — **o mecanismo de fallback de verdade**: upload HTTP real num workspace marcado como `google_drive` sem conexão real → não falha, o arquivo vai fisicamente pro Supabase (baixado de volta e confirmado byte a byte), fica `pendente_migracao`, e a exclusão limpa a linha de sync sem deixar órfã.

## Riscos e lacunas conhecidas

1. **OAuth do Google segue sem projeto real configurado** (mesma pendência da Sprint 11.1) — as chamadas de `createFolder`/`uploadFile`/etc. são novas e genuinamente não testadas contra a API de verdade.
2. **Avanço de etapa da OBRA não move a pasta entre 2.1/2.2/2.3** — só o fluxo Lead→Documentação→Aprovação→Obras está automatizado.
3. **`DocumentNamingService` v1** deriva o "tipo" direto de `tipo_doc` (ex. `CNH_RG` em vez de `RG`) — funcional, mas não é um mapa curado; o ticket já previa isso ser substituído por IA depois.
4. **`storage_limit_mb`/aviso de 80%**: dado preparado, tela de aviso não construída (fora do pedido "preparar estrutura" desta sprint).
5. **Sincronização Drive→ObraFlow** (detectar arquivo novo/removido feito direto no Drive) continua fora do escopo — só a fila de pendência (Supabase→Drive) foi construída.

## Próximo passo

1. ~~Colar `045_storage_hibrido.sql`.~~ **Feito.**
2. ~~Rodar `storage-hibrido-test.mjs`.~~ **Feito — 14/14.**
3. ~~Auditar o gatilho de avanço de etapa da OBRA e conectar movimentação 2.1/2.2/2.3.~~ **Feito, ver abaixo.**
4. ~~Tela de aviso de limite de armazenamento (80%).~~ **Feito, ver abaixo.**
5. Quando tiver o projeto Google Cloud configurado: testar conectar de verdade e criar a estrutura de pastas com uma conta real.

## Complemento (mesma sprint, rodada seguinte): mover pasta da obra + aviso de limite

**Mover pasta por etapa da obra** — auditei `useObras.ts` (`avancarEtapa`, não em nenhum service) e conectei via `/api/storage/obras/[obraId]/folder-event`, fire-and-forget, mesmo padrão de `useLeads.ts`. `categoriaObraPorEtapa()` mapeia a etapa da obra pra 2.1_PROCESSOS (projeto até contrato) / 2.2_OBRAS_EM_ANDAMENTO (execucao) / 2.3_CASAS_ENTREGUES (entregue) — só move quando a mudança de etapa cruza a fronteira entre categorias (licencas→contrato não mexe em nada).

**Bug real achado e corrigido no processo**: a rota buscava o token OAuth do Google **antes** de checar se a mudança de etapa realmente cruzava uma fronteira de pasta — significava que qualquer avanço de etapa (mesmo licencas→contrato, que não move pasta nenhuma) ia falhar com erro se a conexão do Drive estivesse com problema, mesmo sem precisar tocar em pasta nenhuma. Corrigido: a checagem de categoria (barata, sem rede) roda antes, e só busca token quando existe uma movimentação de verdade pra fazer.

**Aviso de limite de armazenamento**: `/api/storage/usage` soma `documentos.tamanho_bytes` (coluna que já existia) de tudo que está fisicamente no Supabase — inclusive documento `pendente_migracao` (Sprint 11.2, ainda não promovido pro externo), mas nunca o que já está `sincronizado` no Drive (não ocupa mais espaço aqui). Compara contra `planos.storage_limit_mb` da assinatura ativa. Banner em `AppShell.tsx`, mesmo padrão visual do aviso de pagamento atrasado (Sprint 9). **Nenhum plano tem `storage_limit_mb` definido ainda** — o aviso fica preparado mas inerte até alguém definir um limite (decisão de negócio, não travei nenhum valor arbitrário).

**Testes** (`storage-etapa-limite-test.mjs`, 5/5 passando, rodado de verdade): mudança de etapa na mesma categoria não busca token nenhum; mudança que cruza categoria falha corretamente sem conexão real (não crasha); cálculo de uso ignora documento já sincronizado no Drive; percentual de uso bate com o limite do plano.
