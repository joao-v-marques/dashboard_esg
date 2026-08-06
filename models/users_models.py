from database.connect_db import get_db_connection

class User:
    def __init__(self, username, name, email, role_id, sector_id, role_name=None, sector_name=None, id=None, created_at=None, is_active=None, password_hash=None):
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
                SELECT u.id, u.username, u.name, u.email, u.role_id, r.description, u.sector_id, s.description, u.created_at, u.is_active 
                FROM users u
                WHERE u.username = %s
                INNER JOIN roles r ON r.id = u.role_id
                INNER JOIN sectors s ON s.id = u.sector_id
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

    @staticmethod
    def get_by_id(user_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT u.id, u.username, u.name, u.email, u.role_id, r.description, u.sector_id, s.description, u.created_at, u.is_active 
                FROM users u
                WHERE u.id = %s
                INNER JOIN roles r ON r.id = u.role_id
                INNER JOIN sectors s ON s.id = u.sector_id
            """
            values = (user_id,)

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