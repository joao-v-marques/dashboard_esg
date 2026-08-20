from database.connect_db import get_db_connection

class NipDashboardModel:
    # O recorte do período é sempre por notification_date — a data em que a ANS
    # notificou a operadora. É a data que a NIP tem desde o primeiro dia, ao
    # contrário de created_at (quando alguém digitou no sistema) e de updated_at
    # (que muda a cada edição e faria uma NIP antiga migrar de período).
    @staticmethod
    def get_dashboard_data(de, ate, status_resolvidas):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            params = {
                "de": de,
                "ate": ate,
                "status_resolvidas": list(status_resolvidas),
            }

            # Um SELECT só: total e resolvidas saem da mesma varredura, então
            # os dois números são sempre do mesmo instante — dois COUNTs em
            # queries separadas podem cair em lados diferentes de um INSERT.
            resumo_query = """
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE s.name = ANY(%(status_resolvidas)s)) AS resolvidas
                FROM nips n
                INNER JOIN nip_status s ON s.id = n.status_id
                WHERE n.notification_date BETWEEN %(de)s::date AND %(ate)s::date;
            """
            cursor.execute(resumo_query, params)
            resumo = cursor.fetchone()

            return {
                "resumo": resumo,
            }
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
