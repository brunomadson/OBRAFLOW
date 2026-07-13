# RBAC_VALIDACAO.md — Matriz oficial de teste

Documento de referência para a validação do RBAC implementado nas migrations
027–032. Fonte de verdade da matriz: `seed_cargos_padrao()` em
`supabase/migrations/027_rbac_cargos_permissoes.sql`. Atualizar este arquivo
sempre que a matriz de um cargo padrão mudar.

Setores: `comercial`, `obras`, `financeiro`, `notificacoes` (rótulo "Alertas"
na UI — só leitura, não há criação/edição/exclusão de alerta, são
computados por `useNotificacoes`), `configuracoes`.

## Matriz esperada por cargo

| Cargo | Comercial | Obras | Financeiro | Alertas | Configurações |
|---|---|---|---|---|---|
| **CEO / Dono** | ver·criar·editar·excluir | ver·criar·editar·excluir | ver·criar·editar·excluir | ver | ver·criar·editar·excluir |
| **Gerente / Diretor** | ver·criar·editar·excluir | ver·criar·editar·excluir | ver·criar·editar (**não exclui**) | ver | — |
| **SDR / Vendedor** | ver·criar·editar·excluir | — | — | ver | — |
| **Engenheiro / Arquiteto** | — | ver·criar·editar (**não exclui**) | — | ver | — |
| **Estagiário** | — | ver·criar·editar (**não exclui**) | — | ver | — |
| **Financeiro** | — | — | ver·criar·editar·excluir | ver | — |

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
