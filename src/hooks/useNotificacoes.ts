"use client";
import { useMemo } from "react";
import type { Lead, Obra, Lancamento, ConfigPrazos, Notificacao } from "@/types/app.types";
import { horasDecorridas, diasDecorridos, diasUteisDecorridos, parseBRDate } from "@/lib/utils";

export function useNotificacoes(
  leads: Lead[],
  obras: Obra[],
  cfg: ConfigPrazos,
  lancamentos: Lancamento[]
): Notificacao[] {
  return useMemo(() => {
    const notifs: Notificacao[] = [];
    let idCounter = 0;
    const id = () => ++idCounter;

    // ─── Comercial ────────────────────────────────────────────────────────────
    leads.forEach((lead) => {
      if (lead.etapa === "analise" && lead.correspondente_id) {
        const logAnalise = lead.log?.find((l) => l.etapa === "analise");
        if (logAnalise) {
          const horas = horasDecorridas(logAnalise.created_at) ?? 0;
          if (horas >= cfg.analise_credito_horas) {
            notifs.push({
              id: id(),
              tipo: "critico",
              setor: "comercial",
              titulo: `Análise vencida — ${lead.nome}`,
              mensagem: `${horas}h em análise de crédito. Prazo: ${cfg.analise_credito_horas}h. Cobrar retorno urgente!`,
              horas,
              prazo: cfg.analise_credito_horas,
              unidade: "h",
            });
          } else if (horas >= cfg.analise_credito_alerta_horas) {
            notifs.push({
              id: id(),
              tipo: "alerta",
              setor: "comercial",
              titulo: `Análise próxima do prazo — ${lead.nome}`,
              mensagem: `${horas}h de ${cfg.analise_credito_horas}h. Monitore o correspondente.`,
              horas,
              prazo: cfg.analise_credito_horas,
              unidade: "h",
            });
          }
        }
      }

      if (lead.etapa === "documentacao") {
        const logDoc = lead.log?.find((l) => l.etapa === "documentacao");
        if (logDoc) {
          const dias = diasDecorridos(logDoc.created_at) ?? 0;
          if (dias >= cfg.documentacao_critico_dias) {
            notifs.push({
              id: id(),
              tipo: "critico",
              setor: "comercial",
              titulo: `Documentação parada — ${lead.nome}`,
              mensagem: `${dias} dias em Documentação sem atualização. Acione o cliente.`,
              dias,
              prazo: cfg.documentacao_critico_dias,
              unidade: "d",
            });
          } else if (dias >= cfg.documentacao_alerta_dias) {
            notifs.push({
              id: id(),
              tipo: "alerta",
              setor: "comercial",
              titulo: `Documentação demorada — ${lead.nome}`,
              mensagem: `${dias} dias aguardando documentação.`,
              dias,
              prazo: cfg.documentacao_critico_dias,
              unidade: "d",
            });
          }
        }
      }
    });

    // ─── Obras ────────────────────────────────────────────────────────────────
    obras.forEach((obra) => {
      if (obra.etapa === "projeto") {
        if (!obra.projeto?.dtArquitetonico) {
          const logProjeto = obra.log?.find((l) => l.etapa === "projeto");
          if (logProjeto) {
            const dias = diasDecorridos(logProjeto.created_at) ?? 0;
            if (dias >= cfg.projeto_arquitetonico_dias) {
              notifs.push({
                id: id(),
                tipo: "critico",
                setor: "obras",
                titulo: `Projeto atrasado — ${obra.nome}`,
                mensagem: `${dias} dias sem concluir projeto arquitetônico. Prazo: ${cfg.projeto_arquitetonico_dias} dias.`,
                dias,
                prazo: cfg.projeto_arquitetonico_dias,
                unidade: "d",
              });
            } else if (dias >= cfg.projeto_arquitetonico_alerta) {
              notifs.push({
                id: id(),
                tipo: "alerta",
                setor: "obras",
                titulo: `Projeto próximo do prazo — ${obra.nome}`,
                mensagem: `${dias} de ${cfg.projeto_arquitetonico_dias} dias para entrega do arquitetônico.`,
                dias,
                prazo: cfg.projeto_arquitetonico_dias,
                unidade: "d",
              });
            }
          }
        }
      }

      // ─── Engenharia Caixa (vistoria/laudo) ────────────────────────────────────
      if (obra.etapa === "eng_caixa" && obra.eng_caixa) {
        const eng = obra.eng_caixa;
        const vistoriaOk = eng.vistoriaRealizada === "concluido";
        const laudoOk     = eng.laudoEmitido === "concluido";

        // 1. Alerta — Vistoria: dias desde a solicitação sem vistoria realizada.
        if (eng.dtSolicitado && !vistoriaOk) {
          const dias = diasDecorridos(eng.dtSolicitado) ?? 0;
          if (dias >= cfg.solicitacao_eng_alerta_dias) {
            notifs.push({
              id: id(),
              tipo: "critico",
              setor: "obras",
              titulo: `Vistoria pendente — ${obra.nome}`,
              mensagem: `${dias} dias desde a solicitação sem vistoria realizada. Prazo: ${cfg.solicitacao_eng_alerta_dias} dias.`,
              dias,
              prazo: cfg.solicitacao_eng_alerta_dias,
              unidade: "d",
            });
          }
        }

        // 2. Alerta — Laudo: dias desde a vistoria realizada sem laudo emitido.
        if (eng.dtVistoria && vistoriaOk && !laudoOk) {
          const dias = diasDecorridos(eng.dtVistoria) ?? 0;
          if (dias >= cfg.vistoria_eng_caixa_dias) {
            notifs.push({
              id: id(),
              tipo: "critico",
              setor: "obras",
              titulo: `Laudo pendente — ${obra.nome}`,
              mensagem: `${dias} dias desde a vistoria sem laudo emitido. Prazo: ${cfg.vistoria_eng_caixa_dias} dias.`,
              dias,
              prazo: cfg.vistoria_eng_caixa_dias,
              unidade: "d",
            });
          }
        }

        // 3. Prazo — Vistoria e Laudo: tempo total do processo (solicitação → laudo).
        if (eng.dtSolicitado) {
          if (laudoOk && eng.dtLaudo) {
            const inicio = parseBRDate(eng.dtSolicitado);
            const fim    = parseBRDate(eng.dtLaudo);
            const totalDias = inicio && fim ? Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) : 0;
            if (totalDias > cfg.laudo_eng_caixa_dias) {
              notifs.push({
                id: id(),
                tipo: "alerta",
                setor: "obras",
                titulo: `Prazo de engenharia excedido — ${obra.nome}`,
                mensagem: `Processo levou ${totalDias} dias da solicitação ao laudo. Prazo configurado: ${cfg.laudo_eng_caixa_dias} dias.`,
                dias: totalDias,
                prazo: cfg.laudo_eng_caixa_dias,
                unidade: "d",
              });
            }
          } else if (!laudoOk) {
            const dias = diasDecorridos(eng.dtSolicitado) ?? 0;
            if (dias >= cfg.laudo_eng_caixa_dias) {
              notifs.push({
                id: id(),
                tipo: "critico",
                setor: "obras",
                titulo: `Prazo de engenharia vencido — ${obra.nome}`,
                mensagem: `${dias} dias desde a solicitação sem laudo emitido. Prazo total: ${cfg.laudo_eng_caixa_dias} dias.`,
                dias,
                prazo: cfg.laudo_eng_caixa_dias,
                unidade: "d",
              });
            }
          }
        }
      }

      if (obra.etapa === "execucao") {
        const medicoes = obra.medicoes ?? [];
        const ultimaMed = medicoes
          .filter((m) => m.status !== "a_solicitar")
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
        const logExec = obra.log?.find((l) => l.etapa === "execucao");
        const dataRef = ultimaMed?.updated_at ?? logExec?.created_at;
        if (dataRef) {
          const dias = diasDecorridos(dataRef) ?? 0;
          if (dias >= cfg.pls_intervalo_dias) {
            notifs.push({
              id: id(),
              tipo: "critico",
              setor: "obras",
              titulo: `PLS atrasado — ${obra.nome}`,
              mensagem: `${dias} dias desde a última medição. Solicite nova PLS.`,
              dias,
              prazo: cfg.pls_intervalo_dias,
              unidade: "d",
            });
          } else if (dias >= cfg.pls_alerta_dias) {
            notifs.push({
              id: id(),
              tipo: "alerta",
              setor: "obras",
              titulo: `PLS próxima — ${obra.nome}`,
              mensagem: `${dias} dias desde a última medição. Prepare a próxima PLS.`,
              dias,
              prazo: cfg.pls_intervalo_dias,
              unidade: "d",
            });
          }
        }

        medicoes
          .filter((m) => m.status === "laudo_emitido" && m.data_laudo && !m.data_liberacao)
          .forEach((m) => {
            const dias = diasDecorridos(m.data_laudo) ?? 0;
            if (dias >= cfg.pagamento_apos_laudo_dias) {
              notifs.push({
                id: id(),
                tipo: "critico",
                setor: "financeiro",
                titulo: `Pagamento vencido — ${obra.nome} · ${m.nome}`,
                mensagem: `${dias} dias desde o laudo sem pagamento liberado.`,
                dias,
                prazo: cfg.pagamento_apos_laudo_dias,
                unidade: "d",
              });
            } else if (dias >= cfg.pagamento_apos_laudo_alerta) {
              notifs.push({
                id: id(),
                tipo: "alerta",
                setor: "financeiro",
                titulo: `Pagamento pendente — ${obra.nome} · ${m.nome}`,
                mensagem: `${dias} de ${cfg.pagamento_apos_laudo_dias} dias para liberação.`,
                dias,
                prazo: cfg.pagamento_apos_laudo_dias,
                unidade: "d",
              });
            }
          });

        medicoes
          .filter((m) => m.status === "solicitada" && m.data_envio_caixa && !m.data_laudo)
          .forEach((m) => {
            const dias = diasDecorridos(m.data_envio_caixa) ?? 0;
            if (dias >= cfg.laudo_apos_solicitada_dias) {
              notifs.push({
                id: id(),
                tipo: "critico",
                setor: "obras",
                titulo: `Laudo em atraso — ${obra.nome} · ${m.nome}`,
                mensagem: `${dias} dias desde o envio sem laudo. Pressione o engenheiro da Caixa.`,
                dias,
                prazo: cfg.laudo_apos_solicitada_dias,
                unidade: "d",
              });
            }
          });
      }

      if (obra.previsao_termino && obra.etapa !== "entregue") {
        const dias = diasUteisDecorridos(obra.previsao_termino) ?? 0;
        if (dias > 0) {
          notifs.push({
            id: id(),
            tipo: "critico",
            setor: "obras",
            titulo: `Prazo vencido — ${obra.nome}`,
            mensagem: `Previsão de término ${obra.previsao_termino} ultrapassada há ${dias} dias.`,
            dias,
            prazo: 0,
            unidade: "d",
          });
        }
      }
    });

    // unused param to avoid lint warning
    void lancamentos;

    return notifs.sort((a, b) => {
      const ordem = { critico: 0, alerta: 1, info: 2 };
      return ordem[a.tipo] - ordem[b.tipo];
    });
  }, [leads, obras, cfg, lancamentos]);
}
