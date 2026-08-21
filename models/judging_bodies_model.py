from database.connect_db import get_db_connection

class JudgingBody:
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

class JudgingBodyModel:
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM judging_bodies
            """
            cursor.execute(sql_query)

            judging_bodies_data = cursor.fetchall()

            judging_bodies = [
                JudgingBody(**judging_body)
                for judging_body in judging_bodies_data
            ]

            return judging_bodies
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
