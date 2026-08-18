from database.connect_db import get_db_connection

class NipNature:
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

class NipNatureModel:
    # GET de todas as naturezas de NIP cadastradas no sistema
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM nip_natures
            """
            cursor.execute(sql_query)
            nip_natures_data = cursor.fetchall()

            nip_natures = [
                NipNature(**nip_nature)
                for nip_nature in nip_natures_data
            ]

            return nip_natures
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
