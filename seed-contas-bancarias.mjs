import { sb } from "./supabase-admin.mjs";

const WORKSPACE_ID = "88d8716f-083e-44bd-91f3-a391cda59d66";
const COMMIT = process.argv.includes("--commit");

const CONTAS = ["Santander", "Nubank-PJ", "Dinheiro", "Reserva de Emergência", "Cartão Alef", "Cartão Bruno", "Caixa Econômica Federal", "Bradesco"];

const { data: existentes, error: errExist } = await sb
  .from("contas_bancarias")
  .select("id, nome")
  .eq("workspace_id", WORKSPACE_ID);
if (errExist) throw errExist;

const nomesExistentes = new Set(existentes.map(c => c.nome));
const novas = CONTAS.filter(nome => !nomesExistentes.has(nome));

console.log(`Contas já existentes: ${existentes.length}`, existentes.map(c => c.nome));
console.log(`Contas novas a criar: ${novas.length}`, novas);

if (!COMMIT) {
  console.log("\n[DRY-RUN] Nenhuma alteração foi feita. Rode com --commit para gravar.");
  process.exit(0);
}

for (const nome of novas) {
  const { error } = await sb.from("contas_bancarias").insert({ nome, ativo: true, workspace_id: WORKSPACE_ID });
  if (error) throw error;
  console.log("Criada:", nome);
}

console.log("\nConcluído.");
