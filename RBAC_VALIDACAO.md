# RBAC_VALIDACAO.md — Matriz oficial de teste

Documento de referência para a validação do RBAC implementado nas migrations
027–032. Fonte de verdade da matriz: `seed_cargos_padrao()` em
`supabase/migrations/027_rbac_cargos_permissoes.sql`. Atualizar este arquivo
sempre que a matriz de um cargo padrão mudar.

Setores: `comercial`, `obras`, `financeiro`, `notificacoes` (rótulo "Alertas"
na UI — só leitura), `configuracoes`, `metas`, `membros`, `integracoes`
(Sprint 7.1), `documentos` (Sprint 7.2).

## Matriz esperada por cargo

| Cargo | Comercial | Obras | Financeiro | Alertas | Config. | Metas | Membros | Integr. | Documentos |
|---|---|---|---|---|---|---|---|---|---|
| **CEO / Dono** | VCEX | VCEX | VCEX | V | VCEX | VCEX | VCEX | VCEX | VCEX |
| **Gerente / Diretor** | VCEX | VCEX | VCE | V | VE | VE | — | V | VCE |
| **SDR / Vendedor** | VCEX | — | — | V | — | V | — | — | VCE (editar só o que criou) |
| **Engenheiro / Arquiteto** | — | VCE | — | V | — | V | — | — | VCE (editar só o que criou) |
| **Estagiário** | — | VCE | — | V | — | V | — | — | VCE (editar só o que criou) |
| **Financeiro** | — | — | VCEX | V | — | V | — | — | — |

V=visualizar C=criar E=editar X=excluir. `documentos.excluir` é **só CEO**
em todos os cargos — mesmo quem tem VCEX em outro setor não exclui
documento (regra própria da Sprint 7.2, ver seção específica abaixo).

## Tabelas cobertas por RLS de permissão (migration 030)

`leads`, `lead_log` → setor `comercial`
`obras`, `obra_log`, `medicoes` → setor `obras`
`lancamentos` → setor `financeiro`

Cada uma tem 4 policies (SELECT/INSERT/UPDATE/DELETE), cada uma exigindo
`workspace_id = get_my_workspace_id() AND has_permission(setor, ação)`.

## Checklist por cargo

Para cada cargo, os testes de banco (Etapa 4) confirmam:

- [x] Vê registros dos setores permitidos, não vê dos setores negados (SELECT vazio, não erro)
- [x] Cria registro nos setores com `criar=true`; INSERT é rejeitado (erro de RLS) nos setores com `criar=false`
- [x] Edita registro nos setores com `editar=true`; UPDATE não afeta linha nenhuma nos setores com `editar=false`
- [x] Exclui registro nos setores com `excluir=true`; DELETE não afeta linha nenhuma nos setores com `excluir=false`

Validado em 2026-07-11 com usuários reais e persistentes (não descartáveis)
via `rbac-validacao-setup.mjs` + `rbac-validacao-testes.mjs` — 22/22
checagens passando, incluindo os 4 casos explicitamente pedidos (SDR × 
lancamentos, Financeiro × leads, Engenheiro × excluir obra, Estagiário ×
excluir obra). Ver `RELATÓRIO RBAC — VALIDAÇÃO FINAL`.

## Cargo personalizado de teste (Etapa 5)

**Supervisor de Obras** (criado pelo CEO, não é cargo `sistema`):

| Comercial | Obras | Financeiro |
|---|---|---|
| — | ver·criar·editar (**não exclui**) | — |

Confirma que: (a) aparece no seletor de cargo do `ModalMembro`; (b) a RLS
aplica exatamente essa matriz pro usuário atribuído a ele — sem nenhuma
mudança de código, só de dado (prova de que o sistema é de fato dirigido por
dado, não por cargo hardcoded).

## Sprint 7.1 — tabelas administrativas (migrations 033/034)

`config` → setor `configuracoes` · `metas_dashboard` → setor `metas` ·
`workspace_invites` → setor `membros` · `workspace_integracoes` → setor
`integracoes`. Validado com `rbac-validacao-admin-testes.mjs` — 12/12
(2026-07-12), inclusive os 4 casos do ticket (Estagiário × config, SDR ×
meta, Estagiário × convite, Engenheiro × integração).

## Sprint 7.2 — documentos, Storage e histórico (migrations 035/036/037/038)

**Histórico** — vulnerabilidade real corrigida (policy `historico_all`
permissiva, criada manualmente fora de qualquer migration, anulava o
isolamento por workspace da tabela inteira). Regra nova: visualizar só dos
módulos com acesso; ninguém edita, nem CEO; só CEO exclui
(`has_permission('configuracoes','excluir')`, que hoje é exclusivo do CEO).

**Documentos** (tabela `documentos` + `storage.objects`, setor
`documentos`):
- Visualizar é **compartilhado** — quem tem acesso ao lead/obra vê os
  documentos daquele registro, não só quem anexou.
- Criar exige `documentos.criar` **e** a permissão de criar do domínio dono
  do registro (lead→`comercial.criar`, obra→`obras.criar`).
- Editar: só quem criou (`documentos.usuario_id = auth.uid()`, ou
  `storage.objects.owner = auth.uid()`) — **exceto** CEO/Gerente, que editam
  qualquer documento do domínio que têm acesso (usa
  `has_permission('configuracoes','visualizar')` como sinal de "gestor" —
  hoje são exatamente os 2 cargos com esse acesso, sem precisar de setor novo).
- Excluir é **só CEO**, mesmo pra quem criou — reforçado por uma trigger
  (`guard_documento_exclusao`) que intercepta especificamente a mudança de
  `ativo` (o app apaga documento via soft-delete, não DELETE de verdade).
- **Continuidade Comercial → Obras**: quando um lead vira obra
  (`obras.lead_id`), os documentos continuam anexados ao `lead_id` (não
  duplicam pro `obra_id`) — a função `pode_documento()`/`pode_documento_storage()`
  reconhece isso e libera acesso tanto por `comercial.*` quanto por
  `obras.*` nesse caso específico, sem abrir acesso a leads que nunca
  viraram obra.

Validado com `rbac-documentos-test.mjs` — 22/22 (2026-07-13), inclusive
isolamento entre workspaces e o caso de continuidade (achado e corrigido
*antes* de rodar o teste, analisando `ModalObra.tsx`/`AbaDocumentos.tsx`).
