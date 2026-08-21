from database.connect_db import get_db_connection

class ProceedingStage:
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

class ProceedingStageModel:
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM proceeding_stages
            """
            cursor.execute(sql_query)

            proceeding_stages_data = cursor.fetchall()

            proceeding_stages = [
                ProceedingStage(**proceeding_stage)
                for proceeding_stage in proceeding_stages_data
            ]

            return proceeding_stages
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
