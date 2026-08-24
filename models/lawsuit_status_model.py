from database.connect_db import get_db_connection

class LawsuitStatus:
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

class LawsuitStatusModel:
    @staticmethod
    def get_all(include_inactive=False):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            if include_inactive:
                sql_query = """
                    SELECT *
                    FROM lawsuit_status
                    ORDER BY name
                """
            else:
                sql_query = """
                    SELECT *
                    FROM lawsuit_status
                    WHERE is_active = TRUE
                    ORDER BY name
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

    @staticmethod
    def get_by_id(lawsuit_status_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM lawsuit_status
                WHERE id = %s
            """
            values = (lawsuit_status_id,)

            cursor.execute(sql_query, values)
            lawsuit_status_data = cursor.fetchone()

            if lawsuit_status_data is None:
                return None

            return LawsuitStatus(**lawsuit_status_data)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_by_name(lawsuit_status_name):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM lawsuit_status
                WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))
            """
            values = (lawsuit_status_name,)

            cursor.execute(sql_query, values)
            lawsuit_status_data = cursor.fetchone()

            if lawsuit_status_data is None:
                return None

            return LawsuitStatus(**lawsuit_status_data)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def create(lawsuit_status):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                INSERT INTO lawsuit_status (name)
                VALUES (%s)
                RETURNING *
            """
            values = (lawsuit_status.name,)

            cursor.execute(sql_query, values)
            new_lawsuit_status = cursor.fetchone()

            conn.commit()

            return LawsuitStatus(**new_lawsuit_status)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def update(lawsuit_status):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE lawsuit_status
                SET name = %s
                WHERE id = %s
                RETURNING *
            """
            values = (lawsuit_status.name, lawsuit_status.id)

            cursor.execute(sql_query, values)
            updated_lawsuit_status = cursor.fetchone()

            conn.commit()

            if updated_lawsuit_status is None:
                return None

            return LawsuitStatus(**updated_lawsuit_status)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # Função de SOFT DELETE de um lawsuit_status
    @staticmethod
    def set_active(lawsuit_status_id, is_active):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE lawsuit_status
                SET is_active = %s
                WHERE id = %s
                RETURNING *
            """
            values = (is_active, lawsuit_status_id)

            cursor.execute(sql_query, values)
            updated_lawsuit_status = cursor.fetchone()

            conn.commit()

            if updated_lawsuit_status is None:
                return None

            return LawsuitStatus(**updated_lawsuit_status)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
