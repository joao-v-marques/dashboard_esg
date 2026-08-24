from database.connect_db import get_db_connection

class SubjectMatters:
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

class SubjectMattersModel:
    @staticmethod
    def get_all(include_inactive=False):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            if include_inactive:
                sql_query = """
                    SELECT *
                    FROM subject_matters
                    ORDER BY name
                """
            else:
                sql_query = """
                    SELECT *
                    FROM subject_matters
                    WHERE is_active = TRUE
                    ORDER BY name
                """

            cursor.execute(sql_query)

            subject_matters_data = cursor.fetchall()

            subject_matters = [
                SubjectMatters(**subject_matter)
                for subject_matter in subject_matters_data
            ]

            return subject_matters
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_by_id(subject_matter_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM subject_matters
                WHERE id = %s
            """
            values = (subject_matter_id,)

            cursor.execute(sql_query, values)
            subject_matter_data = cursor.fetchone()

            if subject_matter_data is None:
                return None

            return SubjectMatters(**subject_matter_data)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_by_name(subject_matter_name):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM subject_matters
                WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))
            """
            values = (subject_matter_name,)

            cursor.execute(sql_query, values)
            subject_matter_data = cursor.fetchone()

            if subject_matter_data is None:
                return None

            return SubjectMatters(**subject_matter_data)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def create(subject_matter):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                INSERT INTO subject_matters (name)
                VALUES (%s)
                RETURNING *
            """
            values = (subject_matter.name,)

            cursor.execute(sql_query, values)
            new_subject_matter = cursor.fetchone()

            conn.commit()

            return SubjectMatters(**new_subject_matter)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # Função de SOFT DELETE de um subject_matters
    @staticmethod
    def set_active(subject_matter_id, is_active):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE subject_matters
                SET is_active = %s
                WHERE id = %s
                RETURNING *
            """
            values = (is_active, subject_matter_id)

            cursor.execute(sql_query, values)
            updated_subject_matter = cursor.fetchone()

            conn.commit()

            if updated_subject_matter is None:
                return None

            return SubjectMatters(**updated_subject_matter)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
