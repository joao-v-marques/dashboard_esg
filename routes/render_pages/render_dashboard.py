from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required

bp_render_dashboard = Blueprint("bp_render_dashboard", __name__)

# route por cima, token_required por baixo: na ordem inversa o route registraria
# a função sem proteção e o decorator embrulharia uma cópia que ninguém chama.
@bp_render_dashboard.route("/dashboard", methods=['GET'])
@token_required
def render_dashboard():
    return render_template("dashboard.html")
