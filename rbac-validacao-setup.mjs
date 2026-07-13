// rbac-validacao-setup.mjs
// Etapa 2 + 5 do RBAC_VALIDACAO.md — cria os 6 usuários reais de teste (um
// por cargo padrão) dentro do workspace "ObraFlow Padrão" (tenant já usado
// como ambiente de teste/demo nesta base, não a Concretize real), mais um
// 7º usuário no cargo customizado "Supervisor de Obras" criado pra validar
// a Etapa 5. São usuários PERSISTENTES (não descartáveis como os do
// security-test.mjs/rbac-test.mjs) — ficam pra você logar de verdade na UI
// e conferir menus/botões (Etapa 3), e podem ser reusados depois.
//
// Rodar com: node --env-file=.env.local rbac-validacao-setup.mjs

import { sb } from './supabase-admin.mjs';

const WORKSPACE_NOME = 'ObraFlow Padrão';
const SENHA = 'RbacValidacao_2026!';

const USUARIOS = [
  { email: 'rbac-ceo@teste.com',         nome: 'RBAC Teste — CEO',         cargoNome: 'CEO / Dono' },
  { email: 'rbac-gerente@teste.com',     nome: 'RBAC Teste — Gerente',     cargoNome: 'Gerente / Diretor' },
  { email: 'rbac-sdr@teste.com',         nome: 'RBAC Teste — SDR',         cargoNome: 'SDR / Vendedor' },
  { email: 'rbac-engenheiro@teste.com',  nome: 'RBAC Teste — Engenheiro',  cargoNome: 'Engenheiro / Arquiteto' },
  { email: 'rbac-estagiario@teste.com',  nome: 'RBAC Teste — Estagiário',  cargoNome: 'Estagiário' },
  { email: 'rbac-financeiro@teste.com',  nome: 'RBAC Teste — Financeiro',  cargoNome: 'Financeiro' },
];

const CARGO_CUSTOM_NOME = 'Supervisor de Obras';
const USUARIO_CUSTOM = { email: 'rbac-supervisor@teste.com', nome: 'RBAC Teste — Supervisor de Obras' };

console.log(`🔧  Setup de validação RBAC — workspace "${WORKSPACE_NOME}"\n`);

const { data: ws, error: wsErr } = await sb.from('workspaces').select('id').eq('nome', WORKSPACE_NOME).single();
if (wsErr || !ws) { console.error('Workspace não encontrado:', wsErr?.message); process.exit(1); }
const workspaceId = ws.id;
console.log(`Workspace: ${workspaceId}\n`);

async function upsertUsuario(email, nome, cargoId) {
  const { data: existentes } = await sb.auth.admin.listUsers();
  let user = existentes.users.find((u) => (u.email ?? '').toLowerCase() === email);

  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email, password: SENHA, email_confirm: true, user_metadata: { nome },
    });
    if (error) throw new Error(`criar ${email}: ${error.message}`);
    user = data.user;
    console.log(`  ✓ criado: ${email}`);
  } else {
    console.log(`  · já existia: ${email}`);
  }

  const { error: pErr } = await sb.from('profiles')
    .update({ nome, workspace_id: workspaceId, cargo_id: cargoId, ativo: true })
    .eq('id', user.id);
  if (pErr) throw new Error(`atribuir cargo em ${email}: ${pErr.message}`);

  return user.id;
}

console.log('─ Cargos padrão ─────────────────────────────────────────');
for (const u of USUARIOS) {
  const { data: cargo, error } = await sb.from('cargos')
    .select('id').eq('workspace_id', workspaceId).eq('nome', u.cargoNome).single();
  if (error || !cargo) throw new Error(`cargo "${u.cargoNome}" não encontrado no workspace: ${error?.message}`);
  await upsertUsuario(u.email, u.nome, cargo.id);
}

console.log('\n─ Cargo customizado "Supervisor de Obras" (Etapa 5) ────────');
let { data: cargoCustom } = await sb.from('cargos')
  .select('id').eq('workspace_id', workspaceId).eq('nome', CARGO_CUSTOM_NOME).maybeSingle();

if (!cargoCustom) {
  const { data: novo, error: cErr } = await sb.from('cargos')
    .insert({ workspace_id: workspaceId, nome: CARGO_CUSTOM_NOME, sistema: false })
    .select('id').single();
  if (cErr) throw new Error(`criar cargo customizado: ${cErr.message}`);
  cargoCustom = novo;

  const matriz = [
    { setor: 'comercial',     pode_visualizar: false, pode_criar: false, pode_editar: false, pode_excluir: false },
    { setor: 'obras',         pode_visualizar: true,  pode_criar: true,  pode_editar: true,  pode_excluir: false },
    { setor: 'financeiro',    pode_visualizar: false, pode_criar: false, pode_editar: false, pode_excluir: false },
    { setor: 'notificacoes',  pode_visualizar: true,  pode_criar: false, pode_editar: false, pode_excluir: false },
    { setor: 'configuracoes', pode_visualizar: false, pode_criar: false, pode_editar: false, pode_excluir: false },
  ];
  const { error: pcErr } = await sb.from('permissoes_cargo')
    .insert(matriz.map((m) => ({ ...m, cargo_id: cargoCustom.id })));
  if (pcErr) throw new Error(`matriz do cargo customizado: ${pcErr.message}`);
  console.log(`  ✓ cargo "${CARGO_CUSTOM_NOME}" criado (obras: ver·criar·editar, sem excluir)`);
} else {
  console.log(`  · cargo "${CARGO_CUSTOM_NOME}" já existia`);
}

await upsertUsuario(USUARIO_CUSTOM.email, USUARIO_CUSTOM.nome, cargoCustom.id);

console.log('\n✅  Setup concluído.\n');
console.log('Credenciais (todas com a mesma senha, ambiente de teste):');
console.log(`  senha: ${SENHA}\n`);
for (const u of [...USUARIOS, USUARIO_CUSTOM]) {
  console.log(`  ${u.email}`);
}
console.log(`\nWorkspace: ${WORKSPACE_NOME} (${workspaceId})`);
