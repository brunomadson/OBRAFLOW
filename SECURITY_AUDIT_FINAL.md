# SECURITY_AUDIT_FINAL.md — ObraFlow

Auditoria final de segurança, consolidando tudo validado nas Sprints 0 a 8.
Status por área: 🟢 Seguro · 🟡 Atenção (funciona, mas com ressalva conhecida) · 🔴 Bloqueador.

**Data**: 2026-07-14 · **Testes rodados nesta auditoria**: 95/95 passando
(`security-test.mjs` 14/14, `rbac-test.mjs` 25/25, `rbac-validacao-testes.mjs`
22/22, `rbac-validacao-admin-testes.mjs` 12/12, `rbac-documentos-test.mjs` 22/22).

## 🟢 Isolamento entre workspaces

RLS por `workspace_id` em todas as 22 tabelas do schema. Validado com
usuários reais (não `service_role`, que ignora RLS) tentando ler/escrever/
apagar dado de outro workspace — sempre negado, inclusive em Storage.
Nenhum vazamento cross-tenant encontrado em nenhuma das 4 sprints de
validação.

## 🟢 RBAC — Comercial, Obras, Financeiro

6 cargos padrão (CEO, Gerente, SDR, Engenheiro, Estagiário, Financeiro) +
cargos customizados pelo CEO, matriz visualizar/criar/editar/excluir via
`has_permission()` + `permissoes_cargo`. RLS real em `leads`, `obras`,
`lancamentos` e tabelas-filho — não é só filtro de tela. 25/25 +
22/22 checagens, incluindo regras finas ("Gerente não exclui lançamento",
"Estagiário não exclui obra").

## 🟢 RBAC — Administrativo (config, metas, convites, integrações)

Fechado no Sprint 7.1. As 4 tabelas que só tinham isolamento por workspace
agora exigem permissão real (`configuracoes`, `metas`, `membros`,
`integracoes`). 12/12 checagens, incluindo os 4 casos nomeados no ticket
original.

## 🟢 Documentos e Storage

Fechado no Sprint 7.2. Bucket privado, policies de banco e Storage
espelhadas, visualização compartilhada por acesso ao lead/obra (inclusive
continuidade Comercial→Obras), criação por setor, edição só de quem criou
(CEO/Gerente como gestores), exclusão exclusiva do CEO. 22/22 checagens.

## 🟢 Histórico

**Vulnerabilidade real corrigida no Sprint 7.2**: uma policy `USING(true)`
criada manualmente fora de qualquer migration anulava o isolamento da
tabela inteira. Removida; regra nova aplicada (visualizar por módulo,
ninguém edita, só CEO exclui) e validada com teste real.

## 🟢 Convites (revisado após teste real do usuário)

RLS de `workspace_invites` correta e testada (só quem tem `membros.criar`
cria convite — hoje só CEO). **Vulnerabilidade funcional real encontrada e
corrigida**: o usuário testou um convite de verdade (e-mail real) e o
clique caía sempre no `/login` sem explicação. Causa: `/auth/callback` era
uma rota de servidor que só processava o formato `?code=`, mas o link real
gerado pela Supabase pra esse fluxo usa `#access_token=` (nunca chega ao
servidor). **O mesmo bug afetava a confirmação de e-mail do cadastro**
(`next=/onboarding`, mesma rota) — reproduzido e confirmado via link
gerado pela API do Supabase antes de corrigir. Reescrito como página
client (mesmo padrão já comprovado de `/reset-password`), revalidado com
build limpo e checagem de rotas. Pendente: confirmar com um novo convite
real de ponta a ponta (o usuário ainda vai reenviar o teste).

## 🟢 Autenticação

Login, cadastro e recuperação de senha testados. Três bugs reais
encontrados e corrigidos nesta série de sprints:
1. Recuperação de senha completamente quebrada (middleware bloqueava a
   rota antes do token ser processado).
2. Login não tratava erro na busca do perfil pós-auth, podendo mandar um
   usuário existente pro onboarding silenciosamente (achado na auditoria
   de logs, Etapa 4).
3. `/auth/callback` quebrado pro mesmo motivo do item 1, afetando
   confirmação de cadastro por e-mail e convite de membro (achado pelo
   usuário testando um convite real, ver seção Convites acima).

## 🟡 Infraestrutura operacional (Sprint 8)

- **Backup**: 🟡 — plano Supabase atual é Free, sem backup automático.
  Mitigação gratuita criada (`npm run backup`), mas não substitui backup
  de verdade. Ver `BACKUP_RECOVERY.md`. Não é bloqueador pro tamanho atual,
  mas é a ressalva mais importante deste documento.
- **Monitoramento de erros**: 🟡 — código pronto (Sentry), deliberadamente
  inativo até ativação manual. Ver `MONITORAMENTO.md`.
- **Ambiente DEV separado**: 🟡 — documentado e com código 100%
  compatível, criação do projeto ainda não feita. Ver `AMBIENTES.md`.

## 🟡 Escopo deliberadamente fora do RBAC granular

`cidades`, `corretores`, `correspondentes` seguem só com isolamento por
workspace (sem checar cargo) — decisão consciente, dado de referência de
baixo risco. "Documentos financeiros" citados em tickets anteriores não
existem no schema (documento só liga a lead ou obra, nunca a lançamento) —
não é um risco, é uma funcionalidade que não existe ainda.

## Resumo

| Área | Status |
|---|---|
| Isolamento entre workspaces | 🟢 |
| RBAC Comercial/Obras/Financeiro | 🟢 |
| RBAC Administrativo | 🟢 |
| Documentos e Storage | 🟢 |
| Histórico | 🟢 |
| Convites | 🟢 (vulnerabilidade funcional real corrigida, ver detalhe acima) |
| Autenticação | 🟢 |
| Backup | 🟡 (sem backup automático, mitigação manual existe) |
| Monitoramento | 🟡 (pronto, inativo por escolha) |
| Ambiente DEV | 🟡 (documentado, não criado) |

**Nenhum item 🔴.** Os 🟡 são decisões conscientes ou ressalvas de baixo
risco pro tamanho atual da operação — não bloqueiam aceitar o primeiro
cliente pagante, mas devem ser revisitados conforme a base de clientes
cresce (ver gatilhos específicos em cada documento referenciado).

## Checklist antes de cadastrar o primeiro cliente pagante externo

- [x] Ambiente de produção isolado por workspace (multi-tenant validado)
- [x] `service_role` rotacionada (Sprint 0)
- [x] Storage protegido (privado + RLS + RBAC)
- [x] RBAC validado (negócio + administrativo + documentos)
- [x] Histórico protegido (vulnerabilidade real corrigida)
- [x] Variáveis de ambiente revisadas (nada hardcoded)
- [ ] Backup automático (hoje só mitigação manual — considerar upgrade de plano antes de escalar)
- [ ] Monitoramento ativo (código pronto, falta criar conta Sentry)
- [ ] Ambiente DEV separado (documentado, falta criar)
- [ ] Reenviar um convite real pra confirmar a correção do `/auth/callback` de ponta a ponta
