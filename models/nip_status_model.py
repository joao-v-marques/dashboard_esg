from database.connect_db import get_db_connection

class NipStatus:
    def __init__(self, name, description, id=None):
        self.id = id
        self.name = name
        self.description = description

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description
        }

class NipStatusModel:
    # GET de todos os status de NIP cadastrados no sistema
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM nip_status
            """
            cursor.execute(sql_query)
            nip_status_data = cursor.fetchall()

            nip_status = [
                NipStatus(**status)
                for status in nip_status_data
            ]

            return nip_status
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
