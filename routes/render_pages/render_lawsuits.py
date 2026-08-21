from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required

# Um blueprint só para as duas telas de processos judiciais: mesma família,
# mesmo motivo de bp_render_nips ter duas rotas (ver render_nips.py).
bp_render_lawsuits = Blueprint("bp_render_lawsuits", __name__)

@bp_render_lawsuits.route("/processos/cadastrar", methods=['GET'])
@token_required
def render_cadastrar_processo():
    return render_template("lancar_processo.html")

@bp_render_lawsuits.route("/processos/consultar", methods=['GET'])
@token_required
def render_consultar_processos():
    return render_template("controle_processos.html")
