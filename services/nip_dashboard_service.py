from models.nip_dashboard_model import NipDashboardModel
from utils.exceptions import ValidationError

# Quais status contam como NIP resolvida.
#
# A regra é do negócio, não do banco: dos nove status cadastrados, só estes dois
# entram no numerador do indicador. Ficam por nome, e não por id, porque `name` é
# UNIQUE em nip_status e os ids são GENERATED ALWAYS AS IDENTITY — dependem da
# ordem do seed e não sobrevivem a uma recarga da base.
#
# Status novo que também deva contar como resolvido entra nesta lista e nada
# mais muda, nem no front-end.
STATUS_RESOLVIDAS = (
    "Finalizada - NIP Assistencial Inativa",
    "Finalizada - NIP Não Assistencial Inativa",
)

class NipDashboardService:
    @staticmethod
    def get_dashboard(de, ate):
        try:
            if not de:
                raise ValidationError("Informe a data inicial do período")

            if not ate:
                raise ValidationError("Informe a data final do período")

            if de > ate:
                raise ValidationError("A data inicial não pode ser depois da data final")

            raw = NipDashboardModel.get_dashboard_data(de, ate, STATUS_RESOLVIDAS)

            total = int(raw["resumo"]["total"])
            resolvidas = int(raw["resumo"]["resolvidas"])

            return {
                "periodo": {"de": de, "ate": ate},
                "resumo": {
                    "total": total,
                    "resolvidas": resolvidas,
                    # Período sem nenhuma NIP não tem percentual definido: vai
                    # null, e o cartão mostra travessão. Zero por cento diria
                    # que nenhuma das NIPs registradas foi resolvida, que é
                    # outra informação.
                    "pct_resolvidas": round(resolvidas / total * 100, 2) if total else None,
                },
            }
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))
