from database.connect_db import get_db_connection

class JudgingBody:
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

class JudgingBodyModel:
    @staticmethod
    def get_all(include_inactive=False):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            if include_inactive:
                sql_query = """
                    SELECT *
                    FROM judging_bodies
                    ORDER BY name
                """
            else:
                sql_query = """
                    SELECT *
                    FROM judging_bodies
                    WHERE is_active = TRUE
                    ORDER BY name
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

    @staticmethod
    def get_by_id(judging_body_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM judging_bodies
                WHERE id = %s
            """
            values = (judging_body_id,)

            cursor.execute(sql_query, values)
            judging_body_data = cursor.fetchone()

            if judging_body_data is None:
                return None

            return JudgingBody(**judging_body_data)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_by_name(judging_body_name):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM judging_bodies
                WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))
            """
            values = (judging_body_name,)

            cursor.execute(sql_query, values)
            judging_body_data = cursor.fetchone()

            if judging_body_data is None:
                return None

            return JudgingBody(**judging_body_data)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def create(judging_body):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                INSERT INTO judging_bodies (name)
                VALUES (%s)
                RETURNING *
            """
            values = (judging_body.name,)

            cursor.execute(sql_query, values)
            new_judging_body = cursor.fetchone()

            conn.commit()

            return JudgingBody(**new_judging_body)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def update(judging_body):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE judging_bodies
                SET name = %s
                WHERE id = %s
                RETURNING *
            """
            values = (judging_body.name, judging_body.id)

            cursor.execute(sql_query, values)
            updated_judging_body = cursor.fetchone()

            conn.commit()

            if updated_judging_body is None:
                return None

            return JudgingBody(**updated_judging_body)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # Função de SOFT DELETE de um judging_bodies
    @staticmethod
    def set_active(judging_body_id, is_active):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE judging_bodies
                SET is_active = %s
                WHERE id = %s
                RETURNING *
            """
            values = (is_active, judging_body_id)

            cursor.execute(sql_query, values)
            updated_judging_body = cursor.fetchone()

            conn.commit()

            if updated_judging_body is None:
                return None

            return JudgingBody(**updated_judging_body)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
