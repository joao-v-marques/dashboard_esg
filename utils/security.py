from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

# configurações recomendadas para aplicações web
password_hasher = PasswordHasher()

# função para gerar o hash da senha
def hash_password(password: str) -> str:
    return password_hasher.hash(password)

# função que verifica se a senha informada corresponde ao hash
def verify_password(stored_hash: str, password: str) -> bool:
    try:
        return password_hasher.verify(stored_hash, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False