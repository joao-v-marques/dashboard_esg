from models.users_model import UserModel
from utils.jwt_handler import generated_token
from utils.security import verify_password
from utils.exceptions import ValidationError, AuthError

class AuthService:
    @staticmethod
    def login(data):
        # get_json(silent=True) devolve None quando o corpo falta ou não é JSON.
        if not isinstance(data, dict):
            raise ValidationError("Envie um corpo JSON com usuário e senha")

        username = (data.get('username') or "").strip()
        password = data.get('password') or ""

        if not username:
            raise ValidationError("O usuário é obrigatório")

        if not password:
            raise ValidationError("A senha é obrigatória")

        user = UserModel.get_by_username(username)

        if not user:
            raise AuthError("Usuário ou senha inválidos")

        if not verify_password(user.password_hash, password):
            raise AuthError("Usuário ou senha inválidos")

        token = generated_token(user)

        return token

    @staticmethod
    def get_me(user_id):
        user = UserModel.get_by_id(user_id)

        # Token assinado por nós, mas o usuário não existe mais: a sessão não
        # vale — 401 leva o front de volta ao login, que é o que resolve.
        if not user:
            raise AuthError("Sessão inválida")

        return user.to_dict()
