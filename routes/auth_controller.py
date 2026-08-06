from flask import Blueprint, request, jsonify, current_app
from services.auth_services import AuthService
from middlewares.jwt_middleware import token_required_api
from utils.exceptions import ValidationError, AuthError

bp_auth = Blueprint("bp_auth", __name__)

COOKIE_MAX_AGE = 8 * 60 * 60

# Endpoints de API ficam sob /api; as páginas ficam na raiz do prefixo. Isso
# também separa o POST de login (aqui) do GET que renderiza a tela (render_login),
# que antes dividiam o mesmo caminho.
@bp_auth.route("/api/login", methods=['POST'])
def user_login():
    try:
        # silent=True: corpo ausente ou Content-Type errado vira None, e o erro
        # sai como o nosso 400 em vez do 415 do Werkzeug virando 500 aqui.
        data = request.get_json(silent=True)

        token = AuthService.login(data)

        response = jsonify({
            "message": "Login realizado com sucesso"
        })

        response.set_cookie(
            'token',
            token,
            httponly=True,
            samesite='Lax',
            secure=False,
            max_age=COOKIE_MAX_AGE
        )

        return response, 200
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except AuthError as e:
        return jsonify({
            "message": str(e)
        }), 401
    except Exception:
        # str(e) na resposta entregava erro de driver e nome de coluna ao
        # cliente; o detalhe fica no log, o cliente recebe só o recado.
        current_app.logger.exception("Falha inesperada no login")

        return jsonify({
            "message": "Erro interno ao processar o login"
        }), 500

@bp_auth.route("/api/me", methods=['GET'])
@token_required_api
def get_me():
    try:
        user_id = request.user["id"]

        user = AuthService.get_me(user_id)

        return jsonify(user)
    except AuthError as e:
        return jsonify({
            "message": str(e)
        }), 401
    except Exception:
        current_app.logger.exception("Falha inesperada ao carregar o usuário")

        return jsonify({
            "message": "Erro interno ao carregar o usuário"
        }), 500

@bp_auth.route("/api/logout", methods=['POST'])
def logout():
    response = jsonify({
        "message": "Logout realizado com sucesso"
    })

    response.set_cookie(
        'token',
        '',
        httponly=True,
        samesite='Lax',
        secure=False,
        max_age=0
    )

    return response, 200
