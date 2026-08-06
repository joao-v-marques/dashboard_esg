from database.connect_db import get_db_connection

class User:
    def __init__(self, username, name, password_hash, email, role_id, sector_id, role_name=None, sector_name=None, id=None, created_at=None, is_active=None):
        self.username = username
        self.name = name
        self.password_hash = password_hash
        self.email = email
        self.role_id = role_id
        self.sector_id = sector_id
        self.role_name = role_name
        self.sector_name = sector_name
        self.id = id
        self.created_at = created_at
        self.is_active = is_active

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "name": self.name,
            "password_hash": self.password_hash,
            "email": self.email,
            "role_id": self.role_id,
            "sector_id": self.sector_id,
            "role_name": self.role_name,
            "sector_name": self.sector_name,
            "created_at": self.created_at,
            "is_active": self.is_active
        }

class UserModel:
    @staticmethod
    def get_by_username(username):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT u.id, u.username, u.name
                FROM users u
                WHERE u.username = %s
            """
            values = (username,)

            cursor.execute(sql_query, values)
            userData = cursor.fetchone()

            user = User(**userData)

            return user
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()