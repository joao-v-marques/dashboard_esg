from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required

bp_render_lawsuits = Blueprint("bp_render_lawsuits", __name__)

@bp_render_lawsuits.route("/processos/cadastrar", methods=['GET'])
@token_required
def render_cadastrar_processo():
    return render_template("lancar_processo.html")
