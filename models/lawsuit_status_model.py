from database.connect_db import get_db_connection

class LawsuitStatus:
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

class LawsuitStatusModel:
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM lawsuit_status
            """
            cursor.execute(sql_query)

            lawsuit_status_data = cursor.fetchall()

            lawsuit_status = [
                LawsuitStatus(**status)
                for status in lawsuit_status_data
            ]

            return lawsuit_status
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
