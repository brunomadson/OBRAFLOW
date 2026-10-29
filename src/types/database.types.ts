export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          nome: string;
          tipo_conta: "PF" | "PJ";
          documento: string | null;
          slug: string | null;
          owner_id: string | null;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["workspaces"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          nome: string | null;
          cargo: string | null;
          cargo_id: string | null;
          ativo: boolean;
          avatar_url: string | null;
          setores: string[];
          workspace_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      cargos: {
        Row: {
          id: string;
          workspace_id: string;
          nome: string;
          sistema: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["cargos"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["cargos"]["Insert"]>;
      };
      permissoes_cargo: {
        Row: {
          id: string;
          cargo_id: string;
          setor: "comercial" | "obras" | "financeiro" | "notificacoes" | "configuracoes" | "metas" | "membros" | "integracoes" | "documentos" | "servicos-tecnicos";
          pode_visualizar: boolean;
          pode_criar: boolean;
          pode_editar: boolean;
          pode_excluir: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["permissoes_cargo"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["permissoes_cargo"]["Insert"]>;
      };
      leads: {
        Row: {
          id: string;
          nome: string;
          cpf: string | null;
          telefone: string | null;
          email: string | null;
          nascimento: string | null;
          origem: string;
          indicado_por: string | null;
          corretor: string | null;
          corretor_id: string | null;
          renda_bruta: number | null;
          tipo_renda: string | null;
          modalidade: string | null;
          dependente: boolean;
          fgts_3anos: boolean;
          cidade: string | null;
          tamanho_imovel: string | null;
          com_muro: "sem_muro" | "com_muro" | "muro_parcial" | null;
          data_contato: string | null;
          data_reuniao: string | null;
          responsavel_id: string | null;
          valor_caixa: number | null;
          valor_venda: number | null;
          valor_lote: number | null;
          valor_subsidio: number | null;
          valor_financiamento: number | null;
          recursos_proprios: number | null;
          anotacoes: string | null;
          etapa: string;
          enviado_para_obras: boolean;
          data_envio_obras: string | null;
          correspondente_id: string | null;
          cliente_id: string | null;
          reuniao_agendada: Json | null;
          workspace_id: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["leads"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
      };
      lead_log: {
        Row: {
          id: string;
          lead_id: string;
          etapa: string;
          dados_extras: Json | null;
          criado_em: string;
          criado_por: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["lead_log"]["Row"], "id" | "criado_em">;
        Update: never;
      };
      cidades: {
        Row: {
          id: string;
          nome: string;
          ativo: boolean;
          workspace_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["cidades"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["cidades"]["Insert"]>;
      };
      corretores: {
        Row: {
          id: string;
          nome: string;
          telefone: string | null;
          email: string | null;
          ativo: boolean;
          workspace_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["corretores"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["corretores"]["Insert"]>;
      };
      correspondentes: {
        Row: {
          id: string;
          nome: string;
          agencia: string | null;
          telefone: string | null;
          email: string | null;
          ativo: boolean;
          workspace_id: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["correspondentes"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["correspondentes"]["Insert"]>;
      };
      clientes: {
        Row: {
          id: string;
          nome: string;
          cpf_cnpj: string | null;
          telefone: string | null;
          email: string | null;
          workspace_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["clientes"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["clientes"]["Insert"]>;
      };
      catalogo_servicos: {
        Row: {
          id: string;
          nome: string;
          categoria: string | null;
          categoria_id: string | null;
          template_padrao_id: string | null;
          descricao: string | null;
          tarefas_padrao: Json;
          fases_execucao: Json;
          ativo: boolean;
          workspace_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["catalogo_servicos"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["catalogo_servicos"]["Insert"]>;
      };
      categorias_servico: {
        Row: {
          id: string;
          nome: string;
          ordem: number;
          ativo: boolean;
          workspace_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["categorias_servico"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["categorias_servico"]["Insert"]>;
      };
      templates_servico: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          fases_execucao: Json;
          tarefas_padrao: Json;
          ativo: boolean;
          workspace_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["templates_servico"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["templates_servico"]["Insert"]>;
      };
      indicadores: {
        Row: {
          id: string;
          nome: string;
          telefone: string | null;
          email: string | null;
          tipo: string | null;
          ativo: boolean;
          workspace_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["indicadores"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["indicadores"]["Insert"]>;
      };
      servicos: {
        Row: {
          id: string;
          cliente_id: string;
          catalogo_servico_id: string | null;
          etapa: string;
          status_execucao: string;
          valor_proposta: number | null;
          indicador_id: string | null;
          indicador_pct: number | null;
          responsavel_id: string | null;
          anotacoes: string | null;
          tarefas: Json;
          fase_execucao_id: string | null;
          template_id: string | null;
          proposta_id: string | null;
          composicao_custos: Json;
          cronograma_financeiro: Json;
          workspace_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["servicos"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["servicos"]["Insert"]>;
      };
      servico_log: {
        Row: {
          id: string;
          servico_id: string;
          etapa: string;
          dados_extras: Json | null;
          criado_em: string;
          criado_por: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["servico_log"]["Row"], "id" | "criado_em">;
        Update: never;
      };
      contas_bancarias: {
        Row: {
          id: string;
          nome: string;
          ativo: boolean;
          workspace_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["contas_bancarias"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["contas_bancarias"]["Insert"]>;
      };
      obras: {
        Row: {
          id: string;
          lead_id: string | null;
          nome: string;
          cpf: string | null;
          telefone: string | null;
          email: string | null;
          nascimento: string | null;
          cidade: string | null;
          modalidade: string | null;
          endereco: string | null;
          engenheiro: string | null;
          correspondente_id: string | null;
          corretor_id: string | null;
          cliente_id: string | null;
          tamanho_imovel: string | null;
          com_muro: string | null;
          valor_obra: number | null;
          valor_caixa: number | null;
          valor_venda: number | null;
          valor_lote: number | null;
          valor_subsidio: number | null;
          valor_financiamento: number | null;
          recursos_proprios: number | null;
          lucro_previsto_pct: number | null;
          renda_bruta: number | null;
          tipo_renda: string | null;
          dependente: boolean;
          fgts_3anos: boolean;
          responsavel_comercial_id: string | null;
          data_contato: string | null;
          data_reuniao: string | null;
          anotacoes_comercial: string | null;
          data_assinatura: string | null;
          previsao_termino: string | null;
          etapa: string;
          progresso: number;
          projeto: Json;
          licencas: Json;
          eng_caixa: Json;
          conformidade: Json;
          composicao_custos: Json | null;
          cronograma_financeiro: Json | null;
          workspace_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["obras"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["obras"]["Insert"]>;
      };
      obra_log: {
        Row: {
          id: string;
          obra_id: string;
          etapa: string;
          criado_em: string;
          criado_por: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["obra_log"]["Row"], "id" | "criado_em">;
        Update: never;
      };
      medicoes: {
        Row: {
          id: string;
          obra_id: string;
          nome: string;
          pct_solicitada: number | null;
          pct_liberada: number | null;
          valor_liberado: number | null;
          status: "a_solicitar" | "solicitada" | "laudo_emitido" | "paga";
          data_envio_caixa: string | null;
          data_laudo: string | null;
          data_liberacao: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["medicoes"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["medicoes"]["Insert"]>;
      };
      lancamentos: {
        Row: {
          id: string;
          obra_id: string | null;
          servico_id: string | null;
          tipo: "entrada" | "saida";
          categoria: string;
          grupo: string | null;
          descricao: string;
          valor: number;
          data: string;
          data_vencimento: string | null;
          data_confirmacao: string | null;
          forma_pagamento: string | null;
          status_pagamento: "pendente" | "pago" | "vencido";
          parcela_num: number | null;
          parcela_total: number | null;
          conta_bancaria_id: string | null;
          obs: string | null;
          workspace_id: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["lancamentos"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["lancamentos"]["Insert"]>;
      };
      recebimentos: {
        Row: {
          id: string;
          workspace_id: string | null;
          obra_id: string;
          origem_tipo: "medicao" | "recursos_proprios";
          medicao_id: string | null;
          lancamento_id: string | null;
          valor: number;
          data: string;
          forma_pagamento: string | null;
          obs: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["recebimentos"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["recebimentos"]["Insert"]>;
      };
      documentos: {
        Row: {
          id: string;
          lead_id: string | null;
          obra_id: string | null;
          servico_id: string | null;
          secao: string;
          tipo_doc: string;
          nome_arquivo: string;
          tamanho_bytes: number | null;
          mime_type: string | null;
          storage_path: string;
          usuario_id: string | null;
          ativo: boolean;
          workspace_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["documentos"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["documentos"]["Insert"]>;
      };
      config: {
        Row: {
          id: string;
          prazo_analise_credito: number;
          prazo_doc_parada: number;
          prazo_projeto_atrasado: number;
          prazo_pls_sem_retorno: number;
          prazo_pls_intervalo: number;
          prazo_laudo_atraso: number;
          prazo_previsao_termino: number;
          prazo_pagamento_vencido: number;
          prazo_contrato_parado: number;
          prazo_visita_tecnica: number;
          prazo_reuniao_sem_retorno: number;
          prazo_docs_incompletos: number;
          prazo_sem_atividade_lead: number;
          prazo_sem_atividade_obra: number;
          prazo_medicao_pendente: number;
          prazo_etapa_longa: number;
          prazo_doc_obra_parada: number;
          prazo_vistoria_atraso: number;
          prazo_habite_se: number;
          prazo_registro_atraso: number;
          prazo_pos_entrega: number;
          workspace_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["config"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["config"]["Insert"]>;
      };
      historico: {
        Row: {
          id: string;
          lead_id: string | null;
          obra_id: string | null;
          servico_id: string | null;
          tipo: "lead" | "comercial" | "obras" | "documento" | "medicao" | "sistema" | "servico_tecnico";
          acao: string;
          usuario_id: string | null;
          usuario_nome: string;
          setor: string | null;
          etapa: string | null;
          workspace_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["historico"]["Row"], "id" | "created_at">;
        Update: never;
      };
    };
  };
};
