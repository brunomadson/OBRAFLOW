# AMBIENTES.md — DEV e Produção

## Estado atual

Existe **um único projeto Supabase** (`zrzqvdurgkqmoizlpeof`) e **um único
deploy Vercel**, servindo desenvolvimento e clientes reais (Concretize e o
workspace pioneiro) ao mesmo tempo. O `.env.local` da máquina de
desenvolvimento aponta pra esse mesmo projeto — ou seja, hoje até rodar
`npm run dev` localmente já usa dado de produção.

Isso já gerou situações de risco nesta base de código (dado de teste ao
lado de dado real, migrations testadas direto em produção). Nunca causou
perda de dado real porque todo teste desta sessão foi desenhado pra só
tocar dado que ele mesmo cria e depois apaga (ver `security-test.mjs`,
`rbac-*.mjs`) — mas um ambiente separado elimina esse risco de vez, em vez
de depender de cuidado manual toda vez.

## Estrutura definida (Sprint 8)

| | DEV | PRODUÇÃO |
|---|---|---|
| Supabase | projeto novo, separado | projeto atual (`zrzqvdurgkqmoizlpeof`) |
| Vercel | ambiente **Preview** | ambiente **Production** |
| `.env.local` (sua máquina) | aponta pro projeto **DEV** | nunca — produção só vive nas env vars da Vercel |
| Dados | fictícios, resetáveis a qualquer momento | dados reais de clientes — nunca rodar seed/reset/teste aqui |
| Scripts (`seed-*.mjs`, `*-test.mjs`, `rbac-*.mjs`) | rodar aqui, à vontade | não rodar mais, mesmo sendo scripts auto-limpos |

O Next.js e a Vercel já suportam isso nativamente — zero mudança de
código, só configuração. A Vercel permite valores de env var **diferentes
por ambiente** (Production / Preview / Development) na mesma tela do
projeto.

## Passo a passo pra criar o DEV (trabalho manual seu)

1. **Criar o projeto Supabase novo** — [supabase.com/dashboard](https://supabase.com/dashboard) → New Project → nome sugerido `obraflow-dev`, plano Free (não precisa ser pago).
2. **Rodar as migrations, em ordem, no SQL Editor do projeto novo** — são 38 arquivos em `supabase/migrations/`, de `001_auth_and_users.sql` até `038_fix_documentos_continuidade_lead_obra.sql`. Cole e rode cada um na ordem numérica (não pule nenhum — vários dependem de função/tabela criada no anterior). Depois de cada um, especialmente os mais longos (027, 030, 033, 036), vale conferir se rodou inteiro antes de seguir pro próximo — já tivemos migration parar no meio silenciosamente no projeto de produção.
3. **Criar o bucket de Storage** — Dashboard → Storage → New bucket → nome `documentos` → **privado** (mesma configuração do projeto de produção).
4. **Pegar as chaves do projeto novo** — Settings → API → copiar Project URL, `anon`/`publishable` key e `service_role`/`secret` key.
5. **Atualizar seu `.env.local`** pra apontar pro projeto DEV (não pro de produção):
   ```
   NEXT_PUBLIC_SUPABASE_URL=<url do projeto DEV>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key do DEV>
   SUPABASE_URL=<url do projeto DEV>
   SUPABASE_ANON_KEY=<anon/publishable key do DEV>
   SUPABASE_SERVICE_ROLE_KEY=<service_role/secret key do DEV>
   ```
6. **Configurar a Vercel** — Settings → Environment Variables → adicionar as mesmas 2 variáveis públicas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) do projeto DEV, marcadas só pro ambiente **Preview** (não Production). As variáveis de produção continuam como estão, marcadas só pro ambiente **Production** — nunca reusar a mesma chave nos dois.
7. **(Opcional) Popular dado fictício** — rodar `node --env-file=.env.local seed-teste-demo.mjs` contra o DEV pra já ter algo pra navegar.

## Depois de criado

- `npm run dev` local passa a rodar contra o DEV automaticamente (porque `.env.local` agora aponta pra lá).
- Toda migration nova criada daqui pra frente roda **duas vezes**: primeiro no DEV (testar, validar com os scripts `*-test.mjs`), depois em produção (só depois de confirmado que funciona).
- Os scripts de teste (`security-test.mjs`, `rbac-test.mjs`, `rbac-validacao-testes.mjs`, `rbac-validacao-admin-testes.mjs`, `rbac-documentos-test.mjs`) passam a rodar contra o DEV — ainda são seguros contra produção (só tocam dado próprio), mas não precisam mais correr esse risco.
- Se algum dia precisar mesmo rodar algo pontual contra produção (ex.: confirmar um bug que só acontece lá), troque o `.env.local` temporariamente e troque de volta pro DEV depois — nunca deixe apontando pra produção por padrão.

## Por que não foi feito ainda em sessões anteriores

Até a Sprint 7, a prioridade era fechar a camada de RBAC/RLS (que já
protege o dado real independente de ambiente). Criar o DEV é trabalho
100% manual de Dashboard que não tinha urgência de segurança — agora que a
base de permissões está fechada e o ritmo de migrations deve desacelerar,
faz sentido montar o ambiente antes de crescer a base de clientes reais.
