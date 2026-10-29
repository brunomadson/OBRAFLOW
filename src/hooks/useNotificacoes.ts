"use client";
import { useMemo } from "react";
import type { Lead, Obra, Lancamento, Recebimento, ConfigPrazos, Notificacao, Servico } from "@/types/app.types";
import { horasDecorridas, diasDecorridos, diasUteisDecorridos, parseBRDate, fmtBRL } from "@/lib/utils";
import { calcularVisaoGeralObra } from "@/lib/visaoGeralObra";
import { calcularCronogramaMensal, calcularPrevistoNoPeriodo } from "@/lib/cronogramaFinanceiro";
import type { LancamentoComServico } from "@/services/lancamentosServico.service";

// Dias úteis restantes até uma data futura (0 se já passou ou é hoje).
function diasUteisAte(dataStr: string): number {
  const alvo = new Date(`${dataStr}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (alvo <= hoje) return 0;
  let count = 0;
  const cur = new Date(hoje);
  while (cur < alvo) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export function useNotificacoes(
  leads: Lead[],
  obras: Obra[],
  cfg: ConfigPrazos,
  lancamentos: Lancamento[],
  recebimentos: Recebimento[] = [],
  servicos: Servico[] = [],
  lancamentosServicos: LancamentoComServico[] = []
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
              href: `/comercial?lead=${lead.id}`,
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
              href: `/comercial?lead=${lead.id}`,
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
              href: `/comercial?lead=${lead.id}`,
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
              href: `/comercial?lead=${lead.id}`,
            });
          }
        }
      }
    });

    // ─── Obras ────────────────────────────────────────────────────────────────
    obras.forEach((obra) => {
      const obraNome = obra.cliente ?? obra.nome ?? "Obra";
      const lancamentosObra = lancamentos.filter((l) => l.obra_id === obra.id);
      const recebimentosObra = recebimentos.filter((r) => r.obra_id === obra.id);

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
                href: `/obras?obra=${obra.id}`,
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
                href: `/obras?obra=${obra.id}`,
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
              href: `/obras?obra=${obra.id}`,
            });
          }
        }

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
              href: `/obras?obra=${obra.id}`,
            });
          }
        }

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
                href: `/obras?obra=${obra.id}`,
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
                href: `/obras?obra=${obra.id}`,
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
        const ultimoLancamento = lancamentosObra
          .sort((a, b) => b.data.localeCompare(a.data))[0];
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
              href: `/obras?obra=${obra.id}`,
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
              href: `/obras?obra=${obra.id}`,
            });
          }
        }

        // ── Obra sem movimentação — nem lançamento, nem medição ───────────────
        const datasAtividade = [dataRef, ultimoLancamento?.data].filter(Boolean) as string[];
        if (datasAtividade.length > 0) {
          const diasSemMovimento = Math.min(...datasAtividade.map((d) => diasDecorridos(d) ?? Infinity));
          if (diasSemMovimento >= cfg.obra_sem_movimentacao_dias) {
            notifs.push({
              id: id(),
              tipo: "alerta",
              setor: "obras",
              titulo: `Obra sem movimentação — ${obraNome}`,
              mensagem: `${diasSemMovimento} dias sem nenhum lançamento financeiro ou atualização de medição.`,
              dias: diasSemMovimento,
              prazo: cfg.obra_sem_movimentacao_dias,
              unidade: "d",
              href: `/obras?obra=${obra.id}`,
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
                href: `/obras?obra=${obra.id}`,
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
                href: `/obras?obra=${obra.id}`,
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
                href: `/obras?obra=${obra.id}`,
              });
            }
          });

        // ── Valor medido menor que o previsto ──────────────────────────────────
        medicoes
          .filter((m) => m.status === "paga" && m.pct_liberada != null && m.pct_solicitada != null)
          .forEach((m) => {
            const diff = (m.pct_solicitada as number) - (m.pct_liberada as number);
            if (diff >= 2) {
              notifs.push({
                id: id(),
                tipo: "info",
                setor: "financeiro",
                titulo: `Medição liberada abaixo do previsto — ${obraNome} · ${m.nome}`,
                mensagem: `Solicitado ${m.pct_solicitada}%, liberado ${m.pct_liberada}% — ${diff.toFixed(1)} pontos abaixo.`,
                href: `/obras?obra=${obra.id}`,
              });
            }
          });
      }

      if (obra.previsao_termino && obra.etapa !== "entregue" && obra.etapa !== "stand_by") {
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
            href: `/obras?obra=${obra.id}`,
          });
        }
      }

      // ── Obra perto da entrega ────────────────────────────────────────────────
      if ((obra.progresso ?? 0) >= 95 && obra.etapa !== "entregue" && obra.etapa !== "stand_by") {
        notifs.push({
          id: id(),
          tipo: "info",
          setor: "obras",
          titulo: `Obra perto da entrega — ${obraNome}`,
          mensagem: `${obra.progresso}% concluído. Confirme Habite-se e prepare a entrega.`,
          href: `/obras?obra=${obra.id}`,
        });
      }

      // ══════════════════════════════════════════════════════════════════════
      // Financeiro por obra
      // ══════════════════════════════════════════════════════════════════════

      // ── Recebimento pendente (medição liberada sem repasse do cliente) ──────
      const pendenciasRecebimento: { titulo: string; saldo: number; dias: number | null }[] = [];
      (obra.medicoes ?? [])
        .filter((m) => (m.valor_liberado ?? 0) > 0)
        .forEach((m) => {
          const recebido = recebimentosObra.filter((r) => r.medicao_id === m.id).reduce((s, r) => s + r.valor, 0);
          const saldo = (m.valor_liberado ?? 0) - recebido;
          if (saldo > 0.01) {
            pendenciasRecebimento.push({ titulo: m.nome, saldo, dias: diasDecorridos(m.data_liberacao) });
          }
        });
      if ((obra.recursos_proprios ?? 0) > 0) {
        const recebidoRP = recebimentosObra.filter((r) => r.origem_tipo === "recursos_proprios").reduce((s, r) => s + r.valor, 0);
        const saldoRP = (obra.recursos_proprios ?? 0) - recebidoRP;
        if (saldoRP > 0.01) {
          pendenciasRecebimento.push({ titulo: "Recursos Próprios", saldo: saldoRP, dias: null });
        }
      }
      if (pendenciasRecebimento.length > 0) {
        const totalPendente = pendenciasRecebimento.reduce((s, p) => s + p.saldo, 0);
        const diasMax = Math.max(0, ...pendenciasRecebimento.map((p) => p.dias ?? 0));
        const tipo = diasMax >= cfg.recebimento_pendente_critico_dias ? "critico" : "alerta";
        if (diasMax >= cfg.recebimento_pendente_alerta_dias || pendenciasRecebimento.some((p) => p.dias === null)) {
          const detalhe = pendenciasRecebimento.map((p) => `${p.titulo}: ${fmtBRL(p.saldo)}`).join(" · ");
          notifs.push({
            id: id(),
            tipo,
            setor: "financeiro",
            titulo: `Recebimento pendente — ${obraNome}`,
            mensagem: `${fmtBRL(totalPendente)} liberado(s) sem repasse ainda (${detalhe}).${diasMax > 0 ? ` Até ${diasMax} dias parado.` : ""}`,
            dias: diasMax > 0 ? diasMax : undefined,
            prazo: cfg.recebimento_pendente_alerta_dias,
            unidade: "d",
            href: `/financeiro?obra=${obra.id}&aba=recebimentos`,
            acao: "Registrar recebimento",
          });
        }
      }

      // ── Contas a pagar (saídas vencidas / a vencer) ──────────────────────────
      lancamentosObra
        .filter((l) => l.tipo === "saida" && l.status_pagamento !== "pago" && l.data_vencimento)
        .forEach((l) => {
          const diasAtraso = diasUteisDecorridos(l.data_vencimento) ?? 0;
          const ehImposto = l.grupo === "Impostos";
          if (diasAtraso >= cfg.pagamento_dias_uteis) {
            notifs.push({
              id: id(),
              tipo: "critico",
              setor: "financeiro",
              titulo: `${ehImposto ? "Imposto vencido" : "Conta vencida"} — ${obraNome}`,
              mensagem: `${l.descricao} (${l.categoria}) — ${fmtBRL(l.valor)}, ${diasAtraso} dias úteis de atraso.`,
              dias: diasAtraso,
              prazo: cfg.pagamento_dias_uteis,
              unidade: "du",
              href: `/financeiro?obra=${obra.id}&aba=lancamentos`,
            });
          } else {
            const diasParaVencer = diasUteisAte(l.data_vencimento!);
            if (diasParaVencer <= cfg.pagamento_alerta_dias_uteis) {
              notifs.push({
                id: id(),
                tipo: "alerta",
                setor: "financeiro",
                titulo: `${ehImposto ? "Imposto a vencer" : "Conta a vencer"} — ${obraNome}`,
                mensagem: `${l.descricao} (${l.categoria}) — ${fmtBRL(l.valor)}, vence em ${diasParaVencer} dias úteis.`,
                dias: diasParaVencer,
                prazo: cfg.pagamento_alerta_dias_uteis,
                unidade: "du",
                href: `/financeiro?obra=${obra.id}&aba=lancamentos`,
              });
            }
          }
        });

      // ── Orçado × Realizado / Lucro (usa cronograma financeiro, se houver) ───
      if ((obra.cronograma_financeiro?.length ?? 0) > 0 && obra.data_inicio) {
        const linhas = calcularCronogramaMensal(obra, lancamentosObra);
        const linhasAteAgora = linhas.filter((l) => l.jaComecou);
        const totalSaidaPrevisto = linhasAteAgora.reduce((s, l) => s + l.saidaPrevisto, 0);
        const totalSaidaReal = linhasAteAgora.reduce((s, l) => s + (l.saidaReal ?? 0), 0);

        if (totalSaidaReal > totalSaidaPrevisto && totalSaidaPrevisto > 0) {
          notifs.push({
            id: id(),
            tipo: "critico",
            setor: "financeiro",
            titulo: `Custo acima do orçado — ${obraNome}`,
            mensagem: `Gasto ${fmtBRL(totalSaidaReal)}, orçado até agora ${fmtBRL(totalSaidaPrevisto)} — estouro de ${fmtBRL(totalSaidaReal - totalSaidaPrevisto)}.`,
            href: `/financeiro?obra=${obra.id}&aba=orcado_realizado`,
          });
        }

        // ── Receita do mês abaixo do previsto ──────────────────────────────────
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const { entradasPrevistas } = calcularPrevistoNoPeriodo(obra, inicioMes, hoje);
        const entradasRealizadasMes = lancamentosObra
          .filter((l) => l.tipo === "entrada" && l.status_pagamento === "pago" && new Date(`${l.data}T00:00:00`) >= inicioMes)
          .reduce((s, l) => s + l.valor, 0);
        if (entradasPrevistas > 0 && entradasRealizadasMes < entradasPrevistas * 0.7) {
          notifs.push({
            id: id(),
            tipo: "alerta",
            setor: "financeiro",
            titulo: `Receita do mês abaixo do previsto — ${obraNome}`,
            mensagem: `Recebido ${fmtBRL(entradasRealizadasMes)} de ${fmtBRL(entradasPrevistas)} previstos até hoje (${Math.round((entradasRealizadasMes / entradasPrevistas) * 100)}%).`,
            href: `/financeiro?obra=${obra.id}&aba=fluxo_caixa`,
          });
        }

        // ── Fluxo pode ficar negativo nos próximos 30 dias ─────────────────────
        const em30dias = new Date(hoje);
        em30dias.setDate(em30dias.getDate() + 30);
        const saldoFuturoAgora = lancamentosObra
          .filter((l) => l.status_pagamento === "pago")
          .reduce((s, l) => s + (l.tipo === "entrada" ? l.valor : -l.valor), 0);
        const previsto30 = calcularPrevistoNoPeriodo(obra, hoje, em30dias);
        const saldoProjetado = saldoFuturoAgora + previsto30.entradasPrevistas - previsto30.saidasPrevistas;
        if (saldoProjetado < 0) {
          notifs.push({
            id: id(),
            tipo: "alerta",
            setor: "financeiro",
            titulo: `Fluxo pode ficar negativo — ${obraNome}`,
            mensagem: `Projeção dos próximos 30 dias indica saldo de ${fmtBRL(saldoProjetado)}.`,
            href: `/financeiro?obra=${obra.id}&aba=fluxo_caixa`,
          });
        }
      }

      // ── Lucro previsto caindo ────────────────────────────────────────────────
      if ((obra.lucro_previsto_pct ?? 0) > 0) {
        const v = calcularVisaoGeralObra(obra, lancamentosObra, recebimentosObra);
        if (v.receitaRecebida > 0 && v.margemAtual < (obra.lucro_previsto_pct ?? 0) - 5) {
          notifs.push({
            id: id(),
            tipo: "alerta",
            setor: "financeiro",
            titulo: `Lucro abaixo do previsto — ${obraNome}`,
            mensagem: `Previsto ${obra.lucro_previsto_pct}%, margem atual ${v.margemAtual.toFixed(1)}%.`,
            href: `/financeiro?obra=${obra.id}&aba=visao_geral`,
          });
        }

        // ── Obra sem dinheiro suficiente pras próximas contas ──────────────────
        const proximasSaidas = lancamentosObra
          .filter((l) => l.tipo === "saida" && l.status_pagamento !== "pago" && l.data_vencimento && diasUteisAte(l.data_vencimento) <= cfg.pagamento_alerta_dias_uteis)
          .reduce((s, l) => s + l.valor, 0);
        if (proximasSaidas > v.saldoDisponivel && proximasSaidas > 0) {
          notifs.push({
            id: id(),
            tipo: "critico",
            setor: "financeiro",
            titulo: `Obra sem dinheiro suficiente — ${obraNome}`,
            mensagem: `Saldo disponível ${fmtBRL(v.saldoDisponivel)}, contas próximas somam ${fmtBRL(proximasSaidas)} — faltarão ${fmtBRL(proximasSaidas - v.saldoDisponivel)}.`,
            href: `/financeiro?obra=${obra.id}&aba=lancamentos`,
          });
        }
      }
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Financeiro da empresa (agregado, todas as obras)
    // ══════════════════════════════════════════════════════════════════════════
    const hoje = new Date();
    const mesAtualKey = hoje.toISOString().slice(0, 7);
    const mesAnteriorRef = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const mesAnteriorKey = mesAnteriorRef.toISOString().slice(0, 7);

    const somaPagos = (mesKey: string, tipo: "entrada" | "saida") =>
      lancamentos.filter((l) => l.tipo === tipo && l.status_pagamento === "pago" && l.data.startsWith(mesKey)).reduce((s, l) => s + l.valor, 0);

    const recAtual = somaPagos(mesAtualKey, "entrada");
    const recAnterior = somaPagos(mesAnteriorKey, "entrada");
    const saiAtual = somaPagos(mesAtualKey, "saida");
    const saiAnterior = somaPagos(mesAnteriorKey, "saida");
    const lucroAtualEmpresa = recAtual - saiAtual;
    const lucroAnteriorEmpresa = recAnterior - saiAnterior;

    if (recAnterior > 0 && recAtual < recAnterior * 0.85 && hoje.getDate() > 20) {
      notifs.push({
        id: id(),
        tipo: "alerta",
        setor: "financeiro",
        titulo: "Receita da empresa caiu",
        mensagem: `Receita deste mês (${fmtBRL(recAtual)}) está ${Math.round((1 - recAtual / recAnterior) * 100)}% abaixo do mês anterior (${fmtBRL(recAnterior)}).`,
        href: "/financeiro",
      });
    }
    if (lucroAnteriorEmpresa > 0 && lucroAtualEmpresa < lucroAnteriorEmpresa * 0.85 && hoje.getDate() > 20) {
      notifs.push({
        id: id(),
        tipo: "alerta",
        setor: "financeiro",
        titulo: "Lucro da empresa caiu",
        mensagem: `Saldo deste mês (${fmtBRL(lucroAtualEmpresa)}) está abaixo do mês anterior (${fmtBRL(lucroAnteriorEmpresa)}).`,
        href: "/financeiro",
      });
    }

    // ── Caixa abaixo do mínimo (opcional, definido em Configurações) ──────────
    if (cfg.caixa_minimo && cfg.caixa_minimo > 0) {
      const saldoTotal = lancamentos
        .filter((l) => l.status_pagamento === "pago")
        .reduce((s, l) => s + (l.tipo === "entrada" ? l.valor : -l.valor), 0);
      if (saldoTotal < cfg.caixa_minimo) {
        notifs.push({
          id: id(),
          tipo: "critico",
          setor: "financeiro",
          titulo: "Caixa abaixo do mínimo",
          mensagem: `Saldo total da empresa é ${fmtBRL(saldoTotal)}, abaixo do mínimo configurado de ${fmtBRL(cfg.caixa_minimo)}.`,
          href: "/financeiro",
        });
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Serviços Técnicos
    // ══════════════════════════════════════════════════════════════════════════
    servicos.forEach((servico) => {
      if (servico.etapa === "concluido") return;
      const nomeCliente = servico.cliente?.nome ?? "Cliente";

      // ── Serviço sem movimentação (nem avançou etapa, nem concluiu tarefa) ────
      const datasAtividade: string[] = [];
      (servico.log ?? []).forEach((l) => datasAtividade.push(l.criado_em));
      (servico.tarefas ?? []).forEach((t) => { if (t.feito && t.data_conclusao) datasAtividade.push(t.data_conclusao); });
      const dataRef = datasAtividade.sort().reverse()[0] ?? servico.updated_at ?? servico.created_at;
      const diasParado = diasDecorridos(dataRef) ?? 0;
      if (diasParado >= cfg.servico_sem_movimentacao_dias) {
        notifs.push({
          id: id(),
          tipo: "alerta",
          setor: "servicos-tecnicos",
          titulo: `Serviço sem movimentação — ${nomeCliente}`,
          mensagem: `${diasParado} dias sem avançar de etapa ou concluir tarefa.`,
          dias: diasParado,
          prazo: cfg.servico_sem_movimentacao_dias,
          unidade: "d",
          href: `/servicos-tecnicos?servico=${servico.id}`,
        });
      }

      // ── Tarefas vencidas (data_prevista passada, ainda não concluída) ────────
      const vencidas = (servico.tarefas ?? []).filter(
        (t) => !t.feito && t.data_prevista && (diasDecorridos(t.data_prevista) ?? -1) > 0
      );
      if (vencidas.length > 0) {
        const diasMax = Math.max(...vencidas.map((t) => diasDecorridos(t.data_prevista) ?? 0));
        notifs.push({
          id: id(),
          tipo: "alerta",
          setor: "servicos-tecnicos",
          titulo: `${vencidas.length} tarefa${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""} — ${nomeCliente}`,
          mensagem: `${vencidas.map((t) => t.texto).join(", ")} — até ${diasMax} dias de atraso.`,
          dias: diasMax,
          unidade: "d",
          href: `/servicos-tecnicos?servico=${servico.id}`,
        });
      }
    });

    // ── Comissão de indicação vencida / a vencer ────────────────────────────────
    lancamentosServicos
      .filter((l) => l.tipo === "saida" && l.categoria === "Comissão de Indicação" && l.status_pagamento !== "pago" && l.data_vencimento)
      .forEach((l) => {
        const nomeCliente = l.servico?.cliente?.nome ?? "Cliente";
        const diasAtraso = diasUteisDecorridos(l.data_vencimento) ?? 0;
        if (diasAtraso >= cfg.pagamento_dias_uteis) {
          notifs.push({
            id: id(),
            tipo: "critico",
            setor: "servicos-tecnicos",
            titulo: `Comissão vencida — ${nomeCliente}`,
            mensagem: `${l.descricao} — ${fmtBRL(l.valor)}, ${diasAtraso} dias úteis de atraso.`,
            dias: diasAtraso,
            prazo: cfg.pagamento_dias_uteis,
            unidade: "du",
            href: `/servicos-tecnicos?aba=financeiro`,
          });
        } else {
          const diasParaVencer = diasUteisAte(l.data_vencimento!);
          if (diasParaVencer <= cfg.pagamento_alerta_dias_uteis) {
            notifs.push({
              id: id(),
              tipo: "alerta",
              setor: "servicos-tecnicos",
              titulo: `Comissão a vencer — ${nomeCliente}`,
              mensagem: `${l.descricao} — ${fmtBRL(l.valor)}, vence em ${diasParaVencer} dias úteis.`,
              dias: diasParaVencer,
              prazo: cfg.pagamento_alerta_dias_uteis,
              unidade: "du",
              href: `/servicos-tecnicos?aba=financeiro`,
            });
          }
        }
      });

    return notifs.sort((a, b) => {
      const ordem = { critico: 0, alerta: 1, info: 2 };
      return ordem[a.tipo] - ordem[b.tipo];
    });
  }, [leads, obras, cfg, lancamentos, recebimentos, servicos, lancamentosServicos]);
}
