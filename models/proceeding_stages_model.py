from database.connect_db import get_db_connection

class ProceedingStage:
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

class ProceedingStageModel:
    @staticmethod
    def get_all(include_inactive=False):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            if include_inactive:
                sql_query = """
                    SELECT *
                    FROM proceeding_stages
                    ORDER BY name
                """
            else:
                sql_query = """
                    SELECT *
                    FROM proceeding_stages
                    WHERE is_active = TRUE
                    ORDER BY name
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

    @staticmethod
    def get_by_id(proceeding_stage_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM proceeding_stages
                WHERE id = %s
            """
            values = (proceeding_stage_id,)

            cursor.execute(sql_query, values)
            proceeding_stage_data = cursor.fetchone()

            if proceeding_stage_data is None:
                return None

            return ProceedingStage(**proceeding_stage_data)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_by_name(proceeding_stage_name):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM proceeding_stages
                WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))
            """
            values = (proceeding_stage_name,)

            cursor.execute(sql_query, values)
            proceeding_stage_data = cursor.fetchone()

            if proceeding_stage_data is None:
                return None

            return ProceedingStage(**proceeding_stage_data)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def create(proceeding_stage):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                INSERT INTO proceeding_stages (name)
                VALUES (%s)
                RETURNING *
            """
            values = (proceeding_stage.name,)

            cursor.execute(sql_query, values)
            new_proceeding_stage = cursor.fetchone()

            conn.commit()

            return ProceedingStage(**new_proceeding_stage)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def update(proceeding_stage):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE proceeding_stages
                SET name = %s
                WHERE id = %s
                RETURNING *
            """
            values = (proceeding_stage.name, proceeding_stage.id)

            cursor.execute(sql_query, values)
            updated_proceeding_stage = cursor.fetchone()

            conn.commit()

            if updated_proceeding_stage is None:
                return None

            return ProceedingStage(**updated_proceeding_stage)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # Função de SOFT DELETE de um proceeding_stages
    @staticmethod
    def set_active(proceeding_stage_id, is_active):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE proceeding_stages
                SET is_active = %s
                WHERE id = %s
                RETURNING *
            """
            values = (is_active, proceeding_stage_id)

            cursor.execute(sql_query, values)
            updated_proceeding_stage = cursor.fetchone()

            conn.commit()

            if updated_proceeding_stage is None:
                return None

            return ProceedingStage(**updated_proceeding_stage)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
