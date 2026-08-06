from functools import wraps
from flask import request, jsonify

def role_required(*allowed_roles):
    def decorator(f):

        @wraps(f)
        def decorated(*args, **kwargs):
            user = getattr(request, "user", None)

            if not user:
                return jsonify({
                    "message": "Usuário não autenticado"
                }), 401
            
            user_role = user.get("role_name")

            if isinstance(user_role, str):
                user_role = user_role.lower()

            allowed_roles_normalized = {
                role.lower() if isinstance(role, str) else role
                for role in allowed_roles
            }

            if user_role not in allowed_roles_normalized:
                return jsonify({
                    "message": "Acesso negado"
                }), 403
            
            return f(*args, **kwargs)
        return decorated
    return decorator