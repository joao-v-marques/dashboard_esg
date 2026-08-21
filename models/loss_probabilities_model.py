from database.connect_db import get_db_connection

class LossProbability:
    def __init__(self, id, name, is_active=None):
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
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM loss_probabilities
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
