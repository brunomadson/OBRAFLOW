export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nome: string;
          cargo: string;
          cpf: string | null;
          email: string;
          status: "ativo" | "inativo" | "pendente";
          cor: string;
          setores: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
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
          anotacoes: string | null;
          etapa: string;
          enviado_para_obras: boolean;
          data_envio_obras: string | null;
          correspondente_id: string | null;
          reuniao_agendada: Json | null;
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
      correspondentes: {
        Row: {
          id: string;
          nome: string;
          agencia: string | null;
          telefone: string | null;
          email: string | null;
          ativo: boolean;
          created_at: string;
          created_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["correspondentes"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["correspondentes"]["Insert"]>;
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
          tamanho_imovel: string | null;
          com_muro: string | null;
          valor_obra: number | null;
          valor_caixa: number | null;
          valor_venda: number | null;
          valor_lote: number | null;
          valor_subsidio: number | null;
          valor_financiamento: number | null;
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
          status: "a_solicitar" | "solicitada" | "realizada" | "laudo_emitido" | "pagamento";
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
          tipo: "entrada" | "saida";
          categoria: string;
          descricao: string;
          valor: number;
          data: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["lancamentos"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["lancamentos"]["Insert"]>;
      };
      config: {
        Row: {
          id: string;
          chave: string;
          valor: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["config"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["config"]["Insert"]>;
      };
    };
  };
};
