# BACKUP_RECOVERY.md — Estratégia de backup e recuperação

## Estado atual (2026-07-13)

Projeto Supabase no plano **Free** — **sem backup automático** (nem
snapshot diário, nem Point-in-Time Recovery). Confirmado direto no
Dashboard (Settings → Database). Isso significa que, hoje, um erro
humano, uma migration mal escrita ou um problema de infraestrutura do
lado do Supabase podem causar perda de dado real **sem nenhuma forma de
recuperação automática**.

Diferente de outros itens desta sprint (Sentry, ambiente DEV), isto não é
algo que dá pra "deixar pronto e sem risco até ativar depois" — o risco
existe agora, com dado real (Concretize) no banco. Por isso, mesmo sem
migrar de plano ainda, criamos uma rede de segurança mínima gratuita
enquanto isso não muda.

## Mitigação atual — backup manual (`backup-manual.mjs`)

`npm run backup` exporta todas as 22 tabelas do schema pra arquivos JSON
em `backups/<data-hora>/` (fora do git — contém dado real de cliente).

**O que cobre**: todas as linhas de todas as tabelas (leads, obras,
lançamentos, documentos-metadados, histórico, cargos/permissões, etc).

**O que NÃO cobre**:
- Os arquivos de verdade no Storage (RG, CPF, projetos anexados) — só o
  registro na tabela `documentos` (nome, caminho, quem anexou), não o
  arquivo em si.
- Não é um backup transacional/consistente entre tabelas (cada tabela é
  lida em um instante levemente diferente) — suficiente pra recuperar de
  um erro humano, não substitui um backup de banco de verdade.
- Não é automático — precisa alguém lembrar de rodar.

**Frequência recomendada**: semanal, ou antes de qualquer migration que
mexa em dado existente (não só estrutura).

**Como restaurar** (procedimento manual, via `supabase-admin.mjs`): ler o
JSON da tabela afetada e reinserir as linhas faltantes/corrigir as
alteradas. Não há script de restauração automática hoje — se for
precisar, é mais seguro montar o script na hora, olhando exatamente o que
precisa ser corrigido, do que ter um "restore automático" genérico que
poderia sobrescrever dado novo por engano.

## Estratégia definitiva — quando migrar pro Supabase Pro

Plano Pro (US$ 25/mês) inclui backup diário automático com 7 dias de
retenção, e a opção de Point-in-Time Recovery (granularidade de minutos)
como add-on pago à parte.

**Gatilho discutido**: em torno de 50 clientes pagantes. Vale registrar o
raciocínio: US$ 25/mês é um custo muito pequeno perto do risco de perda
total de dado de qualquer cliente real, então **não é preciso esperar
exatamente 50** — o gatilho certo é "assim que a Concretize (ou qualquer
outro cliente real) tiver dado que seria realmente ruim perder", o que já
é verdade hoje. A decisão de quando pagar é do CEO, não técnica — este
documento só deixa registrado que o risco existe e a mitigação gratuita
(`backup-manual.mjs`) não é equivalente a um backup de verdade.

## Responsável

CEO/Dono do workspace decide quando fazer upgrade de plano. Rodar
`npm run backup` periodicamente é responsabilidade de quem tiver acesso
ao `.env.local` de produção (hoje, só quem já tem a `service_role`).
