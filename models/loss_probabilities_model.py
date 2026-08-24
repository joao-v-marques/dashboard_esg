from database.connect_db import get_db_connection

class LossProbability:
    def __init__(self, name, id=None, is_active=None):
        self.id = id
        self.name = name
        self.is_active = is_active

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "is_active": self.is_active
        }

class LossProbabilityModel:
    @staticmethod
    def get_all(include_inactive=False):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            if include_inactive:
                sql_query = """
                    SELECT *
                    FROM loss_probabilities
                    ORDER BY name
                """
            else:
                sql_query = """
                    SELECT *
                    FROM loss_probabilities
                    WHERE is_active = TRUE
                    ORDER BY name
                """

            cursor.execute(sql_query)

            loss_probabilities_data = cursor.fetchall()

            loss_probabilities = [
                LossProbability(**loss_probability)
                for loss_probability in loss_probabilities_data
            ]

            return loss_probabilities
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_by_id(loss_probability_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM loss_probabilities
                WHERE id = %s
            """
            values = (loss_probability_id,)

            cursor.execute(sql_query, values)
            loss_probability_data = cursor.fetchone()

            if loss_probability_data is None:
                return None

            return LossProbability(**loss_probability_data)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_by_name(loss_probability_name):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM loss_probabilities
                WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))
            """
            values = (loss_probability_name,)

            cursor.execute(sql_query, values)
            loss_probability_data = cursor.fetchone()

            if loss_probability_data is None:
                return None

            return LossProbability(**loss_probability_data)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def create(loss_probability):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                INSERT INTO loss_probabilities (name)
                VALUES (%s)
                RETURNING *
            """
            values = (loss_probability.name,)

            cursor.execute(sql_query, values)
            new_loss_probability = cursor.fetchone()

            conn.commit()

            return LossProbability(**new_loss_probability)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def update(loss_probability):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE loss_probabilities
                SET name = %s
                WHERE id = %s
                RETURNING *
            """
            values = (loss_probability.name, loss_probability.id)

            cursor.execute(sql_query, values)
            updated_loss_probability = cursor.fetchone()

            conn.commit()

            if updated_loss_probability is None:
                return None

            return LossProbability(**updated_loss_probability)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # Função de SOFT DELETE de uma loss_probabilities
    @staticmethod
    def set_active(loss_probability_id, is_active):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE loss_probabilities
                SET is_active = %s
                WHERE id = %s
                RETURNING *
            """
            values = (is_active, loss_probability_id)

            cursor.execute(sql_query, values)
            updated_loss_probability = cursor.fetchone()

            conn.commit()

            if updated_loss_probability is None:
                return None

            return LossProbability(**updated_loss_probability)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
