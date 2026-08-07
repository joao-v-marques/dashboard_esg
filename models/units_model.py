from database.connect_db import get_db_connection

class Unit:
    def __init__(self, name, code, created_at=None, id=None):
        self.name = name
        self.code = code
        self.created_at = created_at
        self.id = id

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "created_at": self.created_at
        }

class UnitModel:
    # GET de todas as unit's cadastradas
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT id, name, code, created_at
                FROM units
            """
            cursor.execute(sql_query)
            unitsData = cursor.fetchall()

            units = [
                Unit(**unit)
                for unit in unitsData
            ]

            return units
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()