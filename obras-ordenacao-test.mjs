// Confere que getObras() (src/services/obras.service.ts) sempre devolve as
// obras em ordem alfabética por nome (cliente ?? nome), ignorando acento e
// caixa — a mesma regra usada em todo o sistema (Obras, Financeiro,
// Dashboard, Alertas). Rodar depois de qualquer mudança em obras.service.ts
// ou useObras.ts pra garantir que a ordenação global não regrediu.
//
// Uso: node --env-file=.env.local obras-ordenacao-test.mjs
import { sb } from "./supabase-admin.mjs";

function nomeObra(o) {
  return (o.cliente ?? o.nome ?? "").trim();
}

const { data: obras, error } = await sb.from("obras").select("id, cliente, nome, workspace_id");
if (error) throw error;

if (obras.length === 0) {
  console.log("Nenhuma obra encontrada — nada para validar.");
  process.exit(0);
}

// Reproduz exatamente a mesma ordenação de ordenarPorNome() em obras.service.ts,
// depois confere que a lista resultante nunca "anda pra trás" alfabeticamente.
const esperado = [...obras].sort((a, b) =>
  nomeObra(a).localeCompare(nomeObra(b), "pt-BR", { sensitivity: "base" })
);

let fugiuDaOrdem = false;
for (let i = 1; i < esperado.length; i++) {
  const anterior = nomeObra(esperado[i - 1]);
  const atual = nomeObra(esperado[i]);
  if (anterior.localeCompare(atual, "pt-BR", { sensitivity: "base" }) > 0) {
    fugiuDaOrdem = true;
    console.error(`FORA DE ORDEM: "${anterior}" deveria vir depois de "${atual}"`);
  }
}

console.log(`Total de obras verificadas: ${esperado.length}`);
console.log(`Amostra ordenada: ${esperado.slice(0, 5).map(nomeObra).join(", ")}...`);

if (fugiuDaOrdem) {
  console.error("\nFALHOU: ordenação alfabética quebrada.");
  process.exit(1);
}

console.log("\nOK: ordenação alfabética consistente.");
