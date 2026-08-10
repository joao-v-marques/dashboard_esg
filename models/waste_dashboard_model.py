from database.connect_db import get_db_connection

class WasteDashboardModel:
    @staticmethod
    def get_dashboard_data(de, ate):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            params = {"de": de, "ate": ate}

            serie_mensal_query = """
                WITH meses AS (
                    SELECT generate_series(
                        date_trunc('month', %(de)s::date),
                        date_trunc('month', %(ate)s::date),
                        interval '1 month'
                    )::date AS mes
                ),
                agregado AS (
                    SELECT
                        date_trunc('month', wr.record_date)::date AS mes,
                        SUM(wr.weight_kg) AS kg_gerado,
                        COALESCE(SUM(wr.weight_kg) FILTER (WHERE wt.is_recyclable), 0) AS kg_reciclado
                    FROM waste_records wr
                    JOIN waste_types wt ON wt.id = wr.waste_type_id
                    WHERE wr.record_date BETWEEN %(de)s::date AND %(ate)s::date
                    GROUP BY 1
                )
                SELECT
                    m.mes,
                    COALESCE(a.kg_gerado, 0) AS kg_gerado,
                    COALESCE(a.kg_reciclado, 0) AS kg_reciclado
                FROM meses m
                LEFT JOIN agregado a ON a.mes = m.mes
                ORDER BY m.mes;
            """
            cursor.execute(serie_mensal_query, params)
            serie_mensal = cursor.fetchall()

            composicao_por_tipo_query = """
                SELECT wt.name AS tipo, wt.is_recyclable, SUM(wr.weight_kg) AS kg
                FROM waste_records wr
                JOIN waste_types wt ON wt.id = wr.waste_type_id
                WHERE wr.record_date BETWEEN %(de)s::date AND %(ate)s::date
                GROUP BY wt.id, wt.name, wt.is_recyclable
                ORDER BY kg DESC;
            """
            cursor.execute(composicao_por_tipo_query, params)
            composicao_por_tipo = cursor.fetchall()

            por_unidade_query = """
                SELECT
                    u.name AS unidade,
                    SUM(wr.weight_kg) AS kg_gerado,
                    COALESCE(SUM(wr.weight_kg) FILTER (WHERE wt.is_recyclable), 0) AS kg_reciclado
                FROM waste_records wr
                JOIN units u ON u.id = wr.unit_id
                JOIN waste_types wt ON wt.id = wr.waste_type_id
                WHERE wr.record_date BETWEEN %(de)s::date AND %(ate)s::date
                GROUP BY u.id, u.name
                ORDER BY u.name;
            """
            cursor.execute(por_unidade_query, params)
            por_unidade = cursor.fetchall()

            return {
                "serie_mensal": serie_mensal,
                "composicao_por_tipo": composicao_por_tipo,
                "por_unidade": por_unidade,
            }
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
