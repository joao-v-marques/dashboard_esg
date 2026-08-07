from database.connect_db import get_db_connection

class WasteType:
    def __init__(self, name, code, is_recyclable, id=None, created_at=None):
        self.name = name
        self.code = code
        self.is_recyclable = is_recyclable
        self.id = id
        self.created_at = created_at

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "is_recyclable": self.is_recyclable,
            "created_at": self.created_at
        }

class WasteTypeModel:
    # GET de todos os tipos de Resíduos cadastrados no sistema
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM waste_types
            """
            cursor.execute(sql_query)
            waste_types_data = cursor.fetchall()

            waste_types = [
                WasteType(**waste_type)
                for waste_type in waste_types_data
            ]

            return waste_types
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()