// seed-teste-demo.mjs
// Popula o workspace da Concretize com dados de TESTE em todas as etapas de
// Comercial, Obras e Financeiro, para visualizar o funcionamento do sistema
// e das dashboards. Todo registro criado aqui tem o marcador SEED_MARKER no
// campo obs — use reset-teste-demo.mjs para apagar tudo de uma vez depois.
//
// Rodar com: node --env-file=.env.local seed-teste-demo.mjs

import { sb } from './supabase-admin.mjs';

export const SEED_MARKER = 'SEED_TESTE_2026';

const WORKSPACE_EMAIL = 'concretize.eng.contato@gmail.com';

// ─── Resolve workspace/usuário alvo ─────────────────────────────────────────
const { data: usersResp, error: usersErr } = await sb.auth.admin.listUsers();
if (usersErr) { console.error('Erro ao listar usuários:', usersErr.message); process.exit(1); }
const authUser = usersResp.users.find((u) => (u.email ?? '').toLowerCase() === WORKSPACE_EMAIL);
if (!authUser) { console.error(`Usuário ${WORKSPACE_EMAIL} não encontrado.`); process.exit(1); }

const { data: profile, error: profileErr } = await sb
  .from('profiles')
  .select('id, workspace_id, cargo')
  .eq('id', authUser.id)
  .single();
if (profileErr || !profile?.workspace_id) {
  console.error('Erro ao buscar profile/workspace:', profileErr?.message ?? 'workspace_id ausente');
  process.exit(1);
}

const WORKSPACE_ID = profile.workspace_id;
const RESPONSAVEL_ID = profile.id;
console.log(`Workspace alvo: ${WORKSPACE_ID}  (usuário ${WORKSPACE_EMAIL})\n`);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const CIDADES = ['Pedreiras', 'São Domingos do Maranhão', 'Trizidela do Vale', 'Lima Campos', 'Tuntum', 'Presidente Dutra'];
const ORIGENS = ['Captação ativa', 'Instagram', 'Indicação', 'Corretor', 'Tráfego pago'];
const TIPOS_RENDA = ['Carteira assinada', 'Contrato prefeitura/estado', 'Autônomo', 'Empresário', 'Aposentadoria'];
const MODALIDADES = ['Aquisição de terreno e Construção', 'Terreno próprio'];
const LOCAIS_REUNIAO = ['Escritório', 'Videoconferência (Meet)', 'Na casa do cliente'];
const MOTIVOS_REPROVACAO = ['Score de crédito insuficiente', 'Renda insuficiente', 'Restrição no CPF (SPC/Serasa)'];

function pick(arr, i) { return arr[i % arr.length]; }

// ═══════════════════════════════════════════════════════════════════════════
// 1. LEADS — 2 em cada etapa do funil comercial
// ═══════════════════════════════════════════════════════════════════════════
console.log('─ Leads ───────────────────────────────────────────');

const NOMES_LEAD = [
  'Ana Beatriz Souza', 'Carlos Eduardo Lima', 'Débora Ferreira', 'Elias Rocha',
  'Fabiana Martins', 'Gabriel Nunes', 'Helena Castro', 'Igor Almeida',
  'Juliana Prado', 'Kleber Santos', 'Larissa Gomes', 'Marcelo Vieira',
  'Natália Ribeiro', 'Otávio Barros',
];

const ETAPAS_LEAD_SEED = ['leads', 'simulacao', 'reuniao', 'documentacao', 'analise', 'reprovada', 'aprovada'];

// Nomes de corretores/indicadores usados quando origem = "Corretor" / "Indicação"
// (sem isso o indicador "Geradores de Negócio" mostra tudo como "sem nome")
const CORRETORES_SEED = ['André Almeida', 'Fernanda Sousa'];
const INDICADORES_SEED = ['Kawan (cliente antigo)', 'Rodriguinho (parceiro)'];

const leadsPayload = [];
let leadIdx = 0;
for (const etapa of ETAPAS_LEAD_SEED) {
  for (let n = 0; n < 2; n++) {
    const nome = `[TESTE] ${NOMES_LEAD[leadIdx]}`;
    const daysAgo = 60 - leadIdx * 3;
    const temReuniao = ['reuniao', 'documentacao', 'analise', 'reprovada', 'aprovada'].includes(etapa);
    const origem = pick(ORIGENS, leadIdx);

    leadsPayload.push({
      nome,
      telefone: `(99) 9${8000 + leadIdx}-${1000 + leadIdx}`,
      cidade: pick(CIDADES, leadIdx),
      origem,
      corretor: origem === 'Corretor' ? pick(CORRETORES_SEED, leadIdx) : null,
      indicado_por: origem === 'Indicação' ? pick(INDICADORES_SEED, leadIdx) : null,
      tipo_renda: pick(TIPOS_RENDA, leadIdx),
      modalidade: pick(MODALIDADES, leadIdx),
      renda_bruta: 2200 + (leadIdx % 5) * 400,
      valor_caixa: 170000 + (leadIdx % 6) * 8000,
      valor_venda: 160000 + (leadIdx % 6) * 7500,
      valor_subsidio: leadIdx % 3 === 0 ? 6000 : 0,
      com_conjuge: leadIdx % 2 === 0,
      dependente: leadIdx % 3 === 0,
      fgts_3anos: leadIdx % 4 === 0,
      etapa,
      obs: `Cliente de teste para visualização do pipeline. ${SEED_MARKER}`,
      data_contato: isoDaysAgo(daysAgo),
      data_reuniao: temReuniao ? isoDaysAgo(Math.max(daysAgo - 5, 1)) : null,
      local_reuniao: temReuniao ? pick(LOCAIS_REUNIAO, leadIdx) : null,
      responsavel_id: RESPONSAVEL_ID,
      workspace_id: WORKSPACE_ID,
    });
    leadIdx++;
  }
}

const { data: leadsInseridos, error: leadsInsErr } = await sb.from('leads').insert(leadsPayload).select('id, nome, etapa');
if (leadsInsErr) { console.error('✗ Erro ao inserir leads:', leadsInsErr.message); process.exit(1); }
console.log(`✓ ${leadsInseridos.length} leads criados`);

// Log de etapa (timeline) para cada lead — INSERT não dispara o trigger de log (só UPDATE)
const leadLogPayload = leadsInseridos.map((l) => ({
  lead_id: l.id,
  etapa: l.etapa,
  obs: l.etapa === 'reprovada' ? pick(MOTIVOS_REPROVACAO, 0) : null,
}));
const { error: leadLogErr } = await sb.from('lead_log').insert(leadLogPayload);
if (leadLogErr) console.log('  ✗ lead_log:', leadLogErr.message);
else console.log(`✓ ${leadLogPayload.length} entradas de histórico (lead_log)`);

// ═══════════════════════════════════════════════════════════════════════════
// 2. OBRAS — 1-2 em cada etapa de execução
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n─ Obras ───────────────────────────────────────────');

const NOMES_OBRA = [
  'Roberto Cardoso', 'Simone Alves', 'Thiago Farias', 'Vanessa Duarte',
  'William Teixeira', 'Yasmin Correia', 'Adriano Melo', 'Bianca Rodrigues',
  'César Nogueira', 'Daniela Pires',
];

const ETAPAS_OBRA_SEED = ['projeto', 'licencas', 'eng_caixa', 'conformidade', 'contrato', 'execucao', 'entregue'];
const PROGRESSO_POR_ETAPA = { projeto: 10, licencas: 25, eng_caixa: 40, conformidade: 55, contrato: 70, execucao: 85, entregue: 100 };

const item = (concluido) => (concluido ? 'concluido' : 'pendente');

function checklistParaEtapa(etapaIdx) {
  const dt = (offset) => isoDaysAgo(90 - offset);
  return {
    projeto: {
      arquitetonico: item(etapaIdx >= 1), dtArquitetonico: etapaIdx >= 1 ? dt(10) : '',
      complementares: item(etapaIdx >= 1), dtComplementares: etapaIdx >= 1 ? dt(8) : '',
    },
    licencas: {
      art: item(etapaIdx >= 2), dtArt: etapaIdx >= 2 ? dt(20) : '',
      pci: item(etapaIdx >= 2), dtPci: etapaIdx >= 2 ? dt(19) : '',
      projetoLegal: item(etapaIdx >= 2), dtProjetoLegalSolicitado: etapaIdx >= 2 ? dt(25) : '', dtProjetoLegalAprovado: etapaIdx >= 2 ? dt(18) : '',
      usoOcupacao: item(etapaIdx >= 2), dtUsoOcupacaoSolicitado: etapaIdx >= 2 ? dt(24) : '', dtUsoOcupacaoAprovado: etapaIdx >= 2 ? dt(17) : '',
    },
    eng_caixa: {
      enviado: item(etapaIdx >= 3), dtEnviado: etapaIdx >= 3 ? dt(35) : '',
      solicitado: item(etapaIdx >= 3), dtSolicitado: etapaIdx >= 3 ? dt(33) : '',
      boletoPago: item(etapaIdx >= 3), dtBoletoPago: etapaIdx >= 3 ? dt(32) : '',
      vistoriaRealizada: item(etapaIdx >= 3), dtVistoria: etapaIdx >= 3 ? dt(30) : '',
      laudoEmitido: item(etapaIdx >= 3), dtLaudo: etapaIdx >= 3 ? dt(28) : '',
    },
    conformidade: {
      docsGerados: item(etapaIdx >= 4), dtDocsGerados: etapaIdx >= 4 ? dt(45) : '',
      docsAssinados: item(etapaIdx >= 4), dtDocsAssinados: etapaIdx >= 4 ? dt(43) : '',
      docsEnviados: item(etapaIdx >= 4), dtDocsEnviados: etapaIdx >= 4 ? dt(42) : '',
      conforme: item(etapaIdx >= 4), dtConforme: etapaIdx >= 4 ? dt(40) : '',
      inconforme: 'nao_necessario', dtInconforme: '',
    },
  };
}

const obrasPayload = [];
let obraIdx = 0;
for (let ei = 0; ei < ETAPAS_OBRA_SEED.length; ei++) {
  const etapa = ETAPAS_OBRA_SEED[ei];
  const qtd = etapa === 'execucao' ? 2 : 1; // mais obras na etapa mais "cheia"
  for (let n = 0; n < qtd; n++) {
    const nome = `[TESTE] ${NOMES_OBRA[obraIdx % NOMES_OBRA.length]}`;
    obrasPayload.push({
      cliente: nome,
      nome,
      telefone: `(99) 9${7000 + obraIdx}-${2000 + obraIdx}`,
      cidade: pick(CIDADES, obraIdx),
      modalidade: pick(MODALIDADES, obraIdx),
      engenheiro: pick(['Eng. Roberto Silva', 'Eng. Paula Costa', 'Dra. Ana Técnica'], obraIdx),
      endereco: `Rua Teste, ${100 + obraIdx} — ${pick(CIDADES, obraIdx)}/MA`,
      tamanho_imovel: pick(['57m²', '70m²', '80m²'], obraIdx),
      valor_obra: 165000 + (obraIdx % 5) * 9000,
      valor_caixa: 209000,
      valor_venda: 165000 + (obraIdx % 5) * 9000,
      valor_lote: 30000 + (obraIdx % 4) * 5000,
      valor_subsidio: obraIdx % 3 === 0 ? 6000 : 0,
      valor_financiamento: 150000 + (obraIdx % 5) * 8500,
      renda_bruta: 2400 + (obraIdx % 5) * 350,
      tipo_renda: pick(TIPOS_RENDA, obraIdx),
      data_inicio: isoDaysAgo(90 - ei * 10),
      prazo_conclusao: isoDaysAgo(-(180 - ei * 15)),
      data_assinatura: isoDaysAgo(90 - ei * 10 - 2),
      previsao_termino: isoDaysAgo(-(180 - ei * 15)),
      etapa,
      progresso: PROGRESSO_POR_ETAPA[etapa],
      obs: `Obra de teste para visualização do pipeline. ${SEED_MARKER}`,
      responsavel_id: RESPONSAVEL_ID,
      responsavel_comercial_id: RESPONSAVEL_ID,
      workspace_id: WORKSPACE_ID,
      ...checklistParaEtapa(ei),
    });
    obraIdx++;
  }
}

const { data: obrasInseridas, error: obrasInsErr } = await sb.from('obras').insert(obrasPayload).select('id, cliente, etapa');
if (obrasInsErr) { console.error('✗ Erro ao inserir obras:', obrasInsErr.message); process.exit(1); }
console.log(`✓ ${obrasInseridas.length} obras criadas`);

const obraLogPayload = obrasInseridas.map((o) => ({ obra_id: o.id, etapa: o.etapa }));
const { error: obraLogErr } = await sb.from('obra_log').insert(obraLogPayload);
if (obraLogErr) console.log('  ✗ obra_log:', obraLogErr.message);
else console.log(`✓ ${obraLogPayload.length} entradas de histórico (obra_log)`);

// Medições para obras em execução/entregues
const obrasComMedicao = obrasInseridas.filter((o) => ['execucao', 'entregue'].includes(o.etapa));
const medicoesPayload = [];
for (const o of obrasComMedicao) {
  medicoesPayload.push({
    obra_id: o.id, nome: 'Medição 1', numero_medicao: 1,
    pct_solicitada: 30, pct_liberada: 30, valor_liberado: 51000,
    status: 'paga', data_envio_caixa: isoDaysAgo(40), data_laudo: isoDaysAgo(35), data_liberacao: isoDaysAgo(30),
    valor: 51000, data_envio: isoDaysAgo(40),
  });
  if (o.etapa === 'execucao') {
    medicoesPayload.push({
      obra_id: o.id, nome: 'Medição 2', numero_medicao: 2,
      pct_solicitada: 30, pct_liberada: 0, valor_liberado: 0,
      status: 'solicitada', data_envio_caixa: isoDaysAgo(5), data_laudo: null, data_liberacao: null,
      valor: 51000, data_envio: isoDaysAgo(5),
    });
  }
}
if (medicoesPayload.length) {
  const { error: medErr } = await sb.from('medicoes').insert(medicoesPayload);
  if (medErr) console.log('  ✗ medicoes:', medErr.message);
  else console.log(`✓ ${medicoesPayload.length} medições criadas`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. LANÇAMENTOS — Financeiro (entradas e saídas, pagos/pendentes/vencidos)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n─ Financeiro ──────────────────────────────────────');

const obraIds = obrasInseridas.map((o) => o.id);

const lancamentosPayload = [
  // Entradas ligadas a obras (recebimento de medições) — grupo "Receita Obras"
  // (ver GRUPO_DE_CATEGORIA em src/constants/financeiro.ts: categorias reais
  // determinam o grupo usado nos gráficos "por grupo" do Dashboard e do DRE)
  ...obraIds.slice(0, 4).map((obra_id, i) => ({
    descricao: `[TESTE] Recebimento medição — obra ${i + 1}`,
    valor: 51000 + i * 3000, tipo: 'entrada', categoria: 'Medição Caixa', grupo: 'Receita Obras',
    data: isoDaysAgo(30 - i * 3), data_vencimento: isoDaysAgo(30 - i * 3), data_confirmacao: isoDaysAgo(30 - i * 3),
    forma_pagamento: 'Transferência', status_pagamento: 'pago', obra_id,
    obs: SEED_MARKER,
  })),
  // Saídas ligadas a obras (custos de material/mão de obra) — grupo "Custo Obra"
  ...obraIds.slice(0, 3).map((obra_id, i) => ({
    descricao: `[TESTE] Compra de material — obra ${i + 1}`,
    valor: 8500 + i * 1200, tipo: 'saida', categoria: 'Material de construção', grupo: 'Custo Obra',
    data: isoDaysAgo(20 - i * 2), data_vencimento: isoDaysAgo(20 - i * 2), data_confirmacao: isoDaysAgo(20 - i * 2),
    forma_pagamento: 'Pix', status_pagamento: 'pago', obra_id,
    obs: SEED_MARKER,
  })),
  ...obraIds.slice(3, 6).map((obra_id, i) => ({
    descricao: `[TESTE] Mão de obra — equipe ${i + 1}`,
    valor: 6200 + i * 500, tipo: 'saida', categoria: 'Mão de obra', grupo: 'Custo Obra',
    data: isoDaysAgo(10 - i), data_vencimento: isoDaysAgo(2 - i), data_confirmacao: null,
    forma_pagamento: 'Pix', status_pagamento: 'pendente', obra_id,
    obs: SEED_MARKER,
  })),
  // Comissões e impostos (sem obra vinculada)
  {
    descricao: '[TESTE] Comissão corretor — indicação SD',
    valor: 3200, tipo: 'saida', categoria: 'Comissão corretor', grupo: 'Comercial',
    data: isoDaysAgo(15), data_vencimento: isoDaysAgo(15), data_confirmacao: isoDaysAgo(15),
    forma_pagamento: 'Pix', status_pagamento: 'pago', obra_id: null, obs: SEED_MARKER,
  },
  {
    descricao: '[TESTE] DAS — Simples Nacional',
    valor: 1450, tipo: 'saida', categoria: 'DAS / Simples Nacional', grupo: 'Impostos',
    data: isoDaysAgo(3), data_vencimento: isoDaysAgo(-17), data_confirmacao: null,
    forma_pagamento: 'Boleto', status_pagamento: 'pendente', obra_id: null, obs: SEED_MARKER,
  },
  {
    descricao: '[TESTE] Aluguel escritório',
    valor: 1800, tipo: 'saida', categoria: 'Aluguel', grupo: 'Administrativo',
    data: isoDaysAgo(40), data_vencimento: isoDaysAgo(45), data_confirmacao: null,
    forma_pagamento: 'Boleto', status_pagamento: 'vencido', obra_id: null, obs: SEED_MARKER,
  },
  // Entrada de sinal/entrada de venda — grupo "Receita Obras"
  {
    descricao: '[TESTE] Entrada — venda de imóvel',
    valor: 15000, tipo: 'entrada', categoria: 'Adiantamento cliente', grupo: 'Receita Obras',
    data: isoDaysAgo(5), data_vencimento: isoDaysAgo(5), data_confirmacao: isoDaysAgo(5),
    forma_pagamento: 'Pix', status_pagamento: 'pago', obra_id: obraIds[6] ?? null, obs: SEED_MARKER,
  },
  {
    descricao: '[TESTE] Parcela financiamento — 1/3',
    valor: 12000, tipo: 'entrada', categoria: 'Medição Caixa', grupo: 'Receita Obras',
    data: isoDaysAgo(1), data_vencimento: isoDaysAgo(-9), data_confirmacao: null,
    forma_pagamento: 'Transferência', status_pagamento: 'pendente', obra_id: obraIds[7] ?? null,
    parcela_num: 1, parcela_total: 3, obs: SEED_MARKER,
  },
].map((l) => ({ ...l, workspace_id: WORKSPACE_ID }));

const { data: lancInseridos, error: lancErr } = await sb.from('lancamentos').insert(lancamentosPayload).select('id');
if (lancErr) { console.error('✗ Erro ao inserir lançamentos:', lancErr.message); process.exit(1); }
console.log(`✓ ${lancInseridos.length} lançamentos criados`);

// ─── Resumo ────────────────────────────────────────────────────────────────
console.log('\n─ Resumo ──────────────────────────────────────────');
console.log(`  Leads:        ${leadsInseridos.length}  (2 em cada uma das 7 etapas)`);
console.log(`  Obras:        ${obrasInseridas.length}  (distribuídas nas 7 etapas)`);
console.log(`  Medições:     ${medicoesPayload.length}`);
console.log(`  Lançamentos:  ${lancInseridos.length}  (entradas e saídas, pago/pendente/vencido)`);
console.log('\n✅  Seed de teste concluído! Recarregue o app para ver os dados.');
console.log(`    Para apagar tudo depois, rode: node reset-teste-demo.mjs\n`);
