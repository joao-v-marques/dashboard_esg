from datetime import datetime

from services import cooperados_client
from utils.exceptions import UpstreamError, ValidationError


class CooperadosDashboardService:
    @staticmethod
    def get_dashboard(ano):
        try:
            year = CooperadosDashboardService._parse_year(ano)

            bands_raw = cooperados_client.get("/api/v1/bonus-points/bands-report", params={"year": year})
            annual_report_raw = cooperados_client.get("/api/v1/cooperative-members/annual-report", params={"year": year})
            surveys_raw = cooperados_client.get("/api/v1/satisfaction-surveys", params={"order": "desc"})
            occurrences_raw = cooperados_client.get("/api/v1/occurrences")

            return {
                "ano": year,
                "cooperados_por_faixa": CooperadosDashboardService._faixas(bands_raw),
                "capacitados_cooperativismo": CooperadosDashboardService._capacitados_cooperativismo(annual_report_raw),
                "horas_treinamento_por_cooperado": CooperadosDashboardService._horas_treinamento(annual_report_raw),
                "indice_satisfacao": CooperadosDashboardService._indice_satisfacao(surveys_raw, year),
                "manifestacoes_registradas": CooperadosDashboardService._manifestacoes_registradas(occurrences_raw, year),
            }
        except (ValidationError, UpstreamError):
            raise
        except Exception as e:
            raise Exception(str(e))

    @staticmethod
    def _parse_year(ano):
        if not ano:
            return datetime.now().year

        try:
            return int(ano)
        except (TypeError, ValueError):
            raise ValidationError("Ano inválido")

    @staticmethod
    def _faixas(bands_raw):
        total_members = bands_raw["totalMembers"]

        return [
            {
                "faixa": band["band"],
                "de": band["lowerBoundPercent"],
                "ate": band["upperBoundPercent"],
                "quantidade": band["memberCount"],
                # Mesma regra do resto do dashboard: % sempre recalculado a partir
                # do numerador/denominador brutos, nunca guardado pronto na fonte.
                "percentual": round(band["memberCount"] / total_members * 100, 2) if total_members else 0,
            }
            for band in bands_raw["bands"]
        ]

    @staticmethod
    def _capacitados_cooperativismo(annual_report_raw):
        total_members = annual_report_raw["totalMembers"]
        trained = annual_report_raw["membersTrainedInCooperativism"]

        # O card mostra o absoluto junto do %, então os dois vao no payload —
        # e o % segue a mesma regra do resto do dashboard: recalculado aqui a
        # partir do numerador/denominador brutos.
        return {
            "quantidade": trained,
            "total": total_members,
            "percentual": round(trained / total_members * 100, 2) if total_members else 0,
        }

    @staticmethod
    def _horas_treinamento(annual_report_raw):
        # Sai do mesmo /annual-report que alimenta o card de capacitados: o
        # indicador não custa nenhuma chamada a mais ao certificados_cooperados.
        #
        # A lista é dos cooperados ativos, e traz todos eles — quem não lançou
        # curso no ano aparece zerado, que é a informação que interessa aqui.
        # A carga vai em minutos, como o curso é lançado lá; converter para
        # horas é do front, para o número exibido e o exportado nascerem da
        # mesma conta.
        #
        # totalMinutes é lido com .get() de propósito: ele só existe a partir da
        # versão do certificados_cooperados que o devolve no relatório anual.
        # Com a versão anterior no ar o campo vem None, a coluna mostra travessão
        # e o resto da aba — capacitados, satisfação, manifestações e faixas —
        # continua de pé. Derrubar quatro indicadores que funcionam por causa de
        # um quinto que ainda não tem fonte seria o pior dos dois erros, e zero
        # também não serve: diria "ninguém se treinou", que é outra afirmação.
        cooperados = [
            {
                "cooperado": member["name"],
                "cursos": member["totalCourses"],
                "minutos": member.get("totalMinutes"),
            }
            for member in annual_report_raw["members"]
        ]

        # Maior carga primeiro: a leitura do painel é quem se formou mais e quem
        # ficou para trás. O desempate por nome mantém a ordem estável entre dois
        # cooperados com a mesma carga horária — e é também a ordem inteira
        # enquanto a carga não existir, porque aí todos valem o mesmo.
        cooperados.sort(key=lambda cooperado: (-(cooperado["minutos"] or 0), cooperado["cooperado"]))

        return cooperados

    @staticmethod
    def _indice_satisfacao(surveys_raw, year):
        # /satisfaction-surveys não filtra por ano — filtra aqui. Sem pesquisa
        # cadastrada para o ano pedido, o indicador vem nulo (nunca de outro ano
        # com o rótulo do ano errado).
        survey = next((s for s in surveys_raw if s["surveyYear"] == year), None)

        return float(survey["satisfactionIndex"]) if survey else None

    @staticmethod
    def _manifestacoes_registradas(occurrences_raw, year):
        # /occurrences também não filtra por ano — mesma lógica do índice de
        # satisfação acima, e mesmo aviso: traz tudo e filtra aqui.
        prefix = f"{year}-"

        return sum(1 for occurrence in occurrences_raw if occurrence["occurrenceDate"].startswith(prefix))
