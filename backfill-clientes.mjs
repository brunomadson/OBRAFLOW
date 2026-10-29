// backfill-clientes.mjs
// Sprint 13.1 — popula a nova tabela `clientes` a partir dos leads/obras que
// já existem hoje, sem nenhum cliente_id preenchido.
//
// Regra (confirmada pelo usuário): só liga um lead/obra a um cliente já
// existente quando CPF, e-mail ou telefone realmente batem (comparação exata,
// dígitos-only pra CPF/telefone). Sem dado suficiente pra cruzar → cria
// cliente novo. NUNCA sobrescreve nome/telefone/email de um cliente já
// existente — esse processo só cria clientes novos ou liga cliente_id, nunca
// edita um cliente encontrado.
//
// Bônus de precisão: se uma obra tem lead_id e esse lead já ficou linkado a
// um cliente (nesta rodada ou antes), a obra herda o mesmo cliente_id direto
// — sem precisar bater CPF/e-mail/telefone de novo (é literalmente a mesma
// pessoa, o lead virou obra).
//
// Rodar com: node --env-file=.env.local backfill-clientes.mjs [--commit]

import { sb } from './supabase-admin.mjs';

const COMMIT = process.argv.includes('--commit');

function digitos(v) {
  return (v ?? '').replace(/\D/g, '');
}

function emailNorm(v) {
  return (v ?? '').trim().toLowerCase();
}

// Pool de clientes por workspace — cada entrada tem um id real (já existente
// no banco) ou um marcador temporário "NEW#n" enquanto o registro só existe
// em memória (dry run, ou aguardando o insert em --commit).
function criarPool(clientesExistentes) {
  const pool = new Map(); // workspace_id -> array de clientes
  for (const c of clientesExistentes) {
    const lista = pool.get(c.workspace_id) ?? [];
    lista.push({ ...c, isNew: false });
    pool.set(c.workspace_id, lista);
  }
  return pool;
}

function encontrarMatch(pool, workspaceId, { cpf, telefone, email }) {
  const lista = pool.get(workspaceId) ?? [];
  const cpfDig = digitos(cpf);
  const telDig = digitos(telefone);
  const mail = emailNorm(email);

  if (cpfDig) {
    const m = lista.find((c) => c.cpf_cnpj && digitos(c.cpf_cnpj) === cpfDig);
    if (m) return m;
  }
  if (mail) {
    const m = lista.find((c) => c.email && emailNorm(c.email) === mail);
    if (m) return m;
  }
  if (telDig) {
    const m = lista.find((c) => c.telefone && digitos(c.telefone) === telDig);
    if (m) return m;
  }
  return null;
}

async function garantirCliente(pool, workspaceId, dados, contadorNovos) {
  const existente = encontrarMatch(pool, workspaceId, dados);
  if (existente) return { cliente: existente, criado: false };

  const novoRegistro = {
    nome: dados.nome,
    cpf_cnpj: dados.cpf || null,
    telefone: dados.telefone || null,
    email: dados.email || null,
    workspace_id: workspaceId,
  };

  let clienteCriado;
  if (COMMIT) {
    const { data, error } = await sb.from('clientes').insert(novoRegistro).select().single();
    if (error) throw new Error(`Erro ao criar cliente "${dados.nome}": ${error.message}`);
    clienteCriado = { ...data, isNew: true };
  } else {
    contadorNovos.n += 1;
    clienteCriado = { ...novoRegistro, id: `NEW#${contadorNovos.n}`, isNew: true };
  }

  const lista = pool.get(workspaceId) ?? [];
  lista.push(clienteCriado);
  pool.set(workspaceId, lista);

  return { cliente: clienteCriado, criado: true };
}

async function main() {
  const [{ data: clientesExistentes, error: e1 }, { data: leads, error: e2 }, { data: obras, error: e3 }] =
    await Promise.all([
      sb.from('clientes').select('id, nome, cpf_cnpj, telefone, email, workspace_id'),
      sb.from('leads').select('id, nome, cpf, telefone, email, cliente_id, workspace_id').is('cliente_id', null),
      sb.from('obras').select('id, cliente, cpf, telefone, email, cliente_id, workspace_id, lead_id').is('cliente_id', null),
    ]);

  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;

  const pool = criarPool(clientesExistentes ?? []);
  const contadorNovos = { n: 0 };

  let leadsLigadosExistente = 0;
  let leadsClienteNovo = 0;
  const leadIdParaClienteId = new Map();

  for (const lead of leads ?? []) {
    if (!lead.nome?.trim()) continue; // não há o que cadastrar sem nome
    const { cliente, criado } = await garantirCliente(
      pool,
      lead.workspace_id,
      { nome: lead.nome, cpf: lead.cpf, telefone: lead.telefone, email: lead.email },
      contadorNovos
    );
    if (criado) leadsClienteNovo++; else leadsLigadosExistente++;

    leadIdParaClienteId.set(lead.id, cliente.id);
    if (COMMIT) {
      const { error } = await sb.from('leads').update({ cliente_id: cliente.id }).eq('id', lead.id);
      if (error) console.log(`✗ lead ${lead.nome}: ${error.message}`);
    }
  }

  let obrasHerdadasDoLead = 0;
  let obrasLigadasExistente = 0;
  let obrasClienteNovo = 0;

  for (const obra of obras ?? []) {
    const nome = obra.cliente?.trim();
    if (!nome) continue;

    // Se a obra veio de um lead que acabou de ganhar (ou já tinha) cliente_id,
    // é a mesma pessoa — herda direto, sem precisar bater CPF/e-mail/telefone.
    const clienteIdHerdado = obra.lead_id ? leadIdParaClienteId.get(obra.lead_id) : null;
    if (clienteIdHerdado) {
      obrasHerdadasDoLead++;
      if (COMMIT) {
        const { error } = await sb.from('obras').update({ cliente_id: clienteIdHerdado }).eq('id', obra.id);
        if (error) console.log(`✗ obra ${nome}: ${error.message}`);
      }
      continue;
    }

    const { cliente, criado } = await garantirCliente(
      pool,
      obra.workspace_id,
      { nome, cpf: obra.cpf, telefone: obra.telefone, email: obra.email },
      contadorNovos
    );
    if (criado) obrasClienteNovo++; else obrasLigadasExistente++;

    if (COMMIT) {
      const { error } = await sb.from('obras').update({ cliente_id: cliente.id }).eq('id', obra.id);
      if (error) console.log(`✗ obra ${nome}: ${error.message}`);
    }
  }

  console.log(`\nLeads processados: ${leads?.length ?? 0}`);
  console.log(`  → ligados a cliente já existente: ${leadsLigadosExistente}`);
  console.log(`  → novo cliente criado: ${leadsClienteNovo}`);
  console.log(`\nObras processadas: ${obras?.length ?? 0}`);
  console.log(`  → herdaram cliente_id do lead de origem: ${obrasHerdadasDoLead}`);
  console.log(`  → ligadas a cliente já existente: ${obrasLigadasExistente}`);
  console.log(`  → novo cliente criado: ${obrasClienteNovo}`);
  console.log(
    COMMIT
      ? '\n✅ Backfill concluído — nenhum cliente existente foi alterado, só criados/linkados novos.'
      : '\n=== DRY RUN — rode com --commit para gravar. ==='
  );
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
