from models.waste_dashboard_model import WasteDashboardModel
from utils.exceptions import ValidationError

class WasteDashboardService:
    """
    Indicadores de resíduos de um período.

    Toda razão (percentual, média) é calculada aqui a partir do bruto — nunca
    guardada pronta e nunca obtida pela média de médias: a taxa de reciclagem
    do período é reciclado ÷ gerado do período inteiro, não a média das taxas
    mensais, que daria peso igual a um mês de 20 kg e a um de 2.000 kg.

    Ausência de dado sai como None, nunca como zero. Um período sem lançamento
    nenhum não tem taxa de reciclagem de 0% — ele não tem taxa, e o painel
    mostra travessão. Zero é uma afirmação sobre o dado; None é a ausência
    dele.
    """

    @staticmethod
    def _iso(valor):
        return valor.isoformat() if valor else None

    @staticmethod
    def get_dashboard(de, ate):
        try:
            if not de:
                raise ValidationError("Informe a data inicial do período")

            if not ate:
                raise ValidationError("Informe a data final do período")

            if de > ate:
                raise ValidationError("A data inicial não pode ser depois da data final")

            raw = WasteDashboardModel.get_dashboard_data(de, ate)

            serie_mensal = []
            kg_gerado_total = 0.0
            kg_reciclado_total = 0.0

            for row in raw["serie_mensal"]:
                kg_gerado = float(row["kg_gerado"])
                kg_reciclado = float(row["kg_reciclado"])

                serie_mensal.append({
                    "mes": row["mes"].isoformat(),
                    "kg_gerado": kg_gerado,
                    "kg_reciclado": kg_reciclado,
                    # O que não é reciclável vai para destinação final. É o
                    # complemento exato do reciclado, e sai calculado aqui para
                    # a barra empilhada do painel não ter que refazer a conta.
                    "kg_destinacao_final": round(kg_gerado - kg_reciclado, 3),
                    # % nunca é média entre meses — recalculado por mês, a
                    # partir do numerador e denominador daquele mês só. None no
                    # mês sem lançamento: ali não houve taxa, e a linha do
                    # gráfico precisa interromper em vez de cair a zero.
                    "pct_reciclado": round(kg_reciclado / kg_gerado * 100, 2) if kg_gerado else None,
                })

                kg_gerado_total += kg_gerado
                kg_reciclado_total += kg_reciclado

            composicao_por_tipo = [
                {
                    "id": row["id"],
                    "codigo": row["code"],
                    "tipo": row["tipo"],
                    "is_recyclable": row["is_recyclable"],
                    "kg": float(row["kg"]),
                    "pct": round(float(row["kg"]) / kg_gerado_total * 100, 2) if kg_gerado_total else None,
                }
                for row in raw["composicao_por_tipo"]
            ]

            por_unidade = []
            for row in raw["por_unidade"]:
                kg_gerado = float(row["kg_gerado"])
                kg_reciclado = float(row["kg_reciclado"])

                por_unidade.append({
                    "unidade": row["unidade"],
                    "kg_gerado": kg_gerado,
                    "kg_reciclado": kg_reciclado,
                    "kg_destinacao_final": round(kg_gerado - kg_reciclado, 3),
                    "pct_reciclado": round(kg_reciclado / kg_gerado * 100, 2) if kg_gerado else None,
                    "pct_do_total": round(kg_gerado / kg_gerado_total * 100, 2) if kg_gerado_total else None,
                })

            cobertura = raw["cobertura"] or {}
            lancamentos = int(cobertura.get("lancamentos") or 0)
            dias_com_lancamento = int(cobertura.get("dias_com_lancamento") or 0)
            unidades_com_lancamento = int(cobertura.get("unidades_com_lancamento") or 0)
            total_unidades = int((raw["total_unidades"] or {}).get("total") or 0)

            meses_com_lancamento = sum(1 for mes in serie_mensal if mes["kg_gerado"] > 0)

            # Os dois destaques da série. Saem de meses que tiveram lançamento —
            # incluir os meses zerados faria "melhor mês de reciclagem" apontar
            # para um mês sem coleta nenhuma.
            meses_com_dado = [mes for mes in serie_mensal if mes["kg_gerado"] > 0]
            pico_mensal = max(meses_com_dado, key=lambda mes: mes["kg_gerado"], default=None)
            melhor_mes_reciclagem = max(meses_com_dado, key=lambda mes: mes["pct_reciclado"], default=None)

            return {
                "periodo": {"de": de, "ate": ate},
                "resumo": {
                    "kg_gerado": round(kg_gerado_total, 3),
                    "kg_reciclado": round(kg_reciclado_total, 3),
                    "kg_destinacao_final": round(kg_gerado_total - kg_reciclado_total, 3),
                    # Mesma regra do loop acima: soma do período inteiro,
                    # não média dos percentuais mensais.
                    "pct_reciclado": round(kg_reciclado_total / kg_gerado_total * 100, 2) if kg_gerado_total else None,
                    # A média é por DIA COM COLETA, não por dia de calendário: a
                    # coleta é semanal, e dividir por 365 diria que a
                    # cooperativa gera 3 kg por dia todos os dias do ano.
                    "media_por_dia_coletado": round(kg_gerado_total / dias_com_lancamento, 3) if dias_com_lancamento else None,
                    "media_mensal": round(kg_gerado_total / meses_com_lancamento, 3) if meses_com_lancamento else None,
                    "lancamentos": lancamentos,
                    "dias_com_lancamento": dias_com_lancamento,
                    "meses_com_lancamento": meses_com_lancamento,
                    "meses_no_periodo": len(serie_mensal),
                    "unidades_com_lancamento": unidades_com_lancamento,
                    "total_unidades": total_unidades,
                    "primeiro_lancamento": WasteDashboardService._iso(cobertura.get("primeiro_lancamento")),
                    "ultimo_lancamento": WasteDashboardService._iso(cobertura.get("ultimo_lancamento")),
                },
                "destaques": {
                    "pico_mensal": pico_mensal,
                    "melhor_mes_reciclagem": melhor_mes_reciclagem,
                },
                "serie_mensal": serie_mensal,
                "composicao_por_tipo": composicao_por_tipo,
                "por_unidade": por_unidade,
            }
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))
