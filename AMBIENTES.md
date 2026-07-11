# Ambientes — DEV e Produção

## Estado atual

Hoje existe **um único projeto Supabase** e **um único deploy Vercel**
servindo tanto desenvolvimento quanto os clientes reais (Concretize e o
workspace pioneiro). Qualquer teste, seed ou migration roda direto contra o
banco que os clientes usam. Isso já causou incidentes nesta base de código
(dado de teste temporariamente presente ao lado de dado real).

## Estrutura recomendada (ainda não aplicada)

| | DEV | PRODUÇÃO |
|---|---|---|
| Supabase | projeto novo, separado | projeto atual (`zrzqvdurgkqmoizlpeof`) |
| Vercel | ambiente **Preview** | ambiente **Production** |
| Variáveis | `.env.local` (não commitado) | Vercel → Settings → Environment Variables → *Production* |
| Dados | fictícios, resetáveis a qualquer momento | dados reais de clientes — nunca rodar seed/reset aqui |

O Next.js e a Vercel já suportam essa separação nativamente — não exige
mudança de código, só configuração:

- A Vercel permite valores de env var **diferentes por ambiente**
  (Production / Preview / Development) na mesma tela de configurações do
  projeto.
- Um segundo projeto Supabase gratuito é suficiente para DEV (não precisa
  replicar o plano pago).

## Como montar (passo a passo manual — precisa ser feito no Dashboard)

1. Criar um projeto Supabase novo (ex: `obraflow-dev`).
2. Rodar todas as 25 migrations de `supabase/migrations/` nesse projeto novo,
   em ordem (001 → 025), pelo SQL Editor.
3. Copiar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` do projeto **dev** para o ambiente
   **Preview** da Vercel.
4. Manter as variáveis do projeto **produção** apontando só pro ambiente
   **Production** da Vercel — nunca reusar a mesma chave nos dois.
5. A partir daí, rodar os scripts `seed-*.mjs` / `reset-teste-demo.mjs`
   localmente sempre com o `.env.local` apontando pro projeto **dev**.

## Por que não migrar tudo agora

Esta etapa (Sprint 0) só prepara a estrutura — criar o segundo projeto
Supabase e mover os dados de teste pra lá é trabalho manual no Dashboard que
cabe à decisão de quando fazer, sem urgência de segurança (diferente da
rotação da `service_role`, que é urgente). Ver `SECURITY_CHECKLIST.md` e o
relatório do Sprint 0 pra prioridade.
