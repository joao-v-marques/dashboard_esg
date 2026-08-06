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

    @property
    def initials(self):
        """
        Duas letras para o avatar: primeiro e último nome. Nome de uma palavra
        só usa as duas primeiras letras dela, e cadastro sem nome cai no
        username — o avatar não fica vazio havendo como identificar.
        """
        parts = (self.name or self.username or "").split()

        if not parts:
            return ""

        if len(parts) == 1:
            return parts[0][:2].upper()

        return (parts[0][0] + parts[-1][0]).upper()

    def to_dict(self):
        """
        Forma que sai na API.

        role e sector trazem o nome do perfil e do setor, não o id: é o nome
        que a tela traduz (static/js/utils/roles.js). Os ids ficam de fora
        porque são chave de tabela, e o que a tela não usa não trafega.
        """
        return {
            "id": self.id,
            "username": self.username,
            "name": self.name,
            "initials": self.initials,
            "email": self.email,
            "role": self.role_name,
            "sector": self.sector_name
        }

class UserModel:
    @staticmethod
    def get_by_username(username):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT u.id, u.username, u.name, u.email, u.password_hash, u.role_id, r.name AS role_name, u.sector_id, s.name AS sector_name, u.created_at, u.is_active 
                FROM users u
                INNER JOIN roles r ON r.id = u.role_id
                INNER JOIN sectors s ON s.id = u.sector_id
                WHERE u.username = %s
            """
            values = (username,)

            cursor.execute(sql_query, values)
            userData = cursor.fetchone()

            # Sem resultado é usuário inexistente, não erro: quem chamou decide
            # o que fazer. Antes, User(**None) estourava e virava 500.
            if not userData:
                return None

            user = User(**userData)

            return user
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
                SELECT u.id, u.username, u.name, u.email, u.role_id, r.name AS role_name, u.sector_id, s.name AS sector_name, u.created_at, u.is_active 
                FROM users u
                INNER JOIN roles r ON r.id = u.role_id
                INNER JOIN sectors s ON s.id = u.sector_id
                WHERE u.id = %s
            """
            values = (user_id,)

            cursor.execute(sql_query, values)
            userData = cursor.fetchone()

            if not userData:
                return None

            user = User(**userData)

            return user
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()