import { sb } from "./supabase-admin.mjs";

const WORKSPACE_ID = "88d8716f-083e-44bd-91f3-a391cda59d66";

const { data: cat, error: eCat } = await sb.from("categorias_servico").select("*").eq("workspace_id", WORKSPACE_ID);
console.log("categorias_servico:", eCat ? `ERRO: ${eCat.message}` : `ok, ${cat.length} linhas`);

const { data: tpl, error: eTpl } = await sb.from("templates_servico").select("*").eq("workspace_id", WORKSPACE_ID);
console.log("templates_servico:", eTpl ? `ERRO: ${eTpl.message}` : `ok, ${tpl.length} linhas`);
if (tpl?.length) {
  for (const t of tpl) {
    console.log(`  - "${t.nome}" | etapas: ${t.tarefas_padrao.length} | fases: ${t.fases_execucao.length}`);
  }
}

const { data: cs, error: eCs } = await sb.from("catalogo_servicos").select("id, nome, categoria_id, template_padrao_id, tarefas_padrao, fases_execucao").eq("workspace_id", WORKSPACE_ID);
console.log("catalogo_servicos:", eCs ? `ERRO: ${eCs.message}` : `ok, ${cs.length} linhas`);
if (cs?.length) {
  for (const c of cs) {
    console.log(`  - "${c.nome}" | categoria_id: ${c.categoria_id ?? "—"} | template_padrao_id: ${c.template_padrao_id ?? "—"} | (colunas antigas ainda com: ${c.tarefas_padrao.length} etapas / ${c.fases_execucao.length} fases)`);
  }
}

const { data: sv, error: eSv } = await sb.from("servicos").select("id, template_id, proposta_id").eq("workspace_id", WORKSPACE_ID).limit(3);
console.log("servicos.template_id/proposta_id:", eSv ? `ERRO: ${eSv.message}` : `ok, colunas presentes (amostra: ${sv.length})`);
