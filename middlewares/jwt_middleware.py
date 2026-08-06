import jwt, os
from functools import wraps
from flask import request, jsonify, redirect, url_for

def _decode(token):
    return jwt.decode(
        token,
        os.getenv("SECRET_KEY"),
        algorithms=["HS256"]
    )

def _redirect_login(reason):
    # As chaves de reason são as mesmas que static/js/pages/login.js aceita em
    # NOTICES; nome fora dessa lista abre a tela sem aviso nenhum.
    return redirect(url_for("bp_render_login.render_login", reason=reason))

def token_required(f):
    """Para páginas: sem sessão válida, devolve o usuário para o login."""

    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get("token")

        if not token:
            return _redirect_login("login-required")

        try:
            request.user = _decode(token)
        except jwt.ExpiredSignatureError:
            return _redirect_login("session-expired")
        except jwt.InvalidTokenError:
            return _redirect_login("login-required")

        return f(*args, **kwargs)

    return decorated

def token_required_api(f):
    """
    Para rotas de API: sempre JSON, nunca redireciona.

    Um 302 para o HTML do login faz o fetch do front receber a página inteira
    com status 200 — o erro chega como sucesso e a tela não tem como reagir.
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get("token")

        if not token:
            return jsonify({
                "message": "Não autenticado"
            }), 401

        try:
            request.user = _decode(token)
        except jwt.ExpiredSignatureError:
            return jsonify({
                "message": "Token expirado"
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                "message": "Token inválido"
            }), 401

        return f(*args, **kwargs)

    return decorated
