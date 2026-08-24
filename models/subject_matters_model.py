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
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM subject_matters
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
                RETURNING id
            """
            values = (subject_matter.name,)

            cursor.execute(sql_query, values)
            new_id = cursor.fetchone()["id"]

            subject_matter.id = new_id

            conn.commit()

            return subject_matter
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()