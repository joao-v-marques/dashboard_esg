import jwt, os
from datetime import datetime, timedelta

def generated_token(user):
    payload = {
        "id": user.id,
        "username": user.username,
        "role_name": user.role_name,
        "sector_name": user.sector_name,
        "exp": datetime.utcnow() + timedelta(hours=8)
    }

    token = jwt.encode(
        payload,
        os.getenv("SECRET_KEY"),
        algorithm="HS256"
    )

    return token