"use client";
import { createClient } from "@/lib/supabase/client";
import { getTemplatesServico } from "./templatesServico.service";
import { getCategoriasServico } from "./categoriasServico.service";
import type { CatalogoServico } from "@/types/app.types";

const supabase = createClient();

// Campos de verdade do item de catálogo (Sprint 13.8) — tarefas_padrao e
// fases_execucao NÃO entram aqui: quem edita fluxo de execução agora é o
// Template, nunca o cadastro do serviço em si.
type CatalogoServicoInput = Pick<CatalogoServico, "nome" | "categoria_id" | "template_padrao_id" | "descricao" | "ativo">;

export async function getCatalogoServicos(): Promise<CatalogoServico[]> {
  const [{ data, error }, templates, categorias] = await Promise.all([
    supabase.from("catalogo_servicos").select("*").order("nome"),
    getTemplatesServico(),
    getCategoriasServico(),
  ]);
  if (error) throw error;

  return ((data ?? []) as CatalogoServico[]).map((c) => {
    const template = templates.find((t) => t.id === c.template_padrao_id) ?? null;
    const categoriaServico = categorias.find((cat) => cat.id === c.categoria_id) ?? null;
    return {
      ...c,
      // Resolvidos a partir do template ligado — única fonte de verdade
      // pra quem lê CatalogoServico.tarefas_padrao/fases_execucao (Tarefas,
      // Cronograma, Gestão de Projetos, PDF), sem precisar mudar nenhum
      // desses lugares.
      tarefas_padrao: template?.tarefas_padrao ?? [],
      fases_execucao: template?.fases_execucao ?? [],
      categoriaServico,
    };
  });
}

export async function createCatalogoServico(input: CatalogoServicoInput): Promise<CatalogoServico> {
  const { data, error } = await supabase
    .from("catalogo_servicos")
    .insert(input as never)
    .select()
    .single();
  if (error) throw error;
  return data as CatalogoServico;
}

export async function updateCatalogoServico(id: string, input: Partial<CatalogoServicoInput>): Promise<CatalogoServico> {
  const { data, error } = await supabase
    .from("catalogo_servicos")
    .update(input as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as CatalogoServico;
}

// Bloqueia (FK sem cascade) se algum serviço do pipeline já usa esse item —
// intencional: apagar não pode arrancar o tipo de baixo de um serviço em
// andamento. O chamador trata esse erro com uma mensagem amigável.
export async function deleteCatalogoServico(id: string): Promise<void> {
  const { error } = await supabase.from("catalogo_servicos").delete().eq("id", id);
  if (error) throw error;
}
