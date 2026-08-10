from models.waste_dashboard_model import WasteDashboardModel
from utils.exceptions import ValidationError

class WasteDashboardService:
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
                    # % nunca é média entre meses — recalculado por mês, a
                    # partir do numerador e denominador daquele mês só.
                    "pct_reciclado": round(kg_reciclado / kg_gerado * 100, 2) if kg_gerado else 0,
                })

                kg_gerado_total += kg_gerado
                kg_reciclado_total += kg_reciclado

            composicao_por_tipo = [
                {
                    "tipo": row["tipo"],
                    "is_recyclable": row["is_recyclable"],
                    "kg": float(row["kg"]),
                }
                for row in raw["composicao_por_tipo"]
            ]

            por_unidade = [
                {
                    "unidade": row["unidade"],
                    "kg_gerado": float(row["kg_gerado"]),
                    "kg_reciclado": float(row["kg_reciclado"]),
                }
                for row in raw["por_unidade"]
            ]

            return {
                "periodo": {"de": de, "ate": ate},
                "resumo": {
                    "kg_gerado": round(kg_gerado_total, 3),
                    "kg_reciclado": round(kg_reciclado_total, 3),
                    # Mesma regra do loop acima: soma do período inteiro,
                    # não média dos percentuais mensais.
                    "pct_reciclado": round(kg_reciclado_total / kg_gerado_total * 100, 2) if kg_gerado_total else 0,
                },
                "serie_mensal": serie_mensal,
                "composicao_por_tipo": composicao_por_tipo,
                "por_unidade": por_unidade,
            }
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))
