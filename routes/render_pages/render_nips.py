from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required

# Um blueprint só para as duas telas de NIP: elas são a mesma família e entram
# juntas no configs.py. As demais telas têm um arquivo cada porque são assuntos
# separados, não porque "um arquivo = uma rota" seja regra.
bp_render_nips = Blueprint("bp_render_nips", __name__)

# route por cima, token_required por baixo: na ordem inversa o route registraria
# a função sem proteção e o decorator embrulharia uma cópia que ninguém chama.
@bp_render_nips.route("/nips/lancar", methods=['GET'])
@token_required
def render_lancar_nip():
    return render_template("lancar_nip.html")

@bp_render_nips.route("/nips/controle", methods=['GET'])
@token_required
def render_controle_nips():
    return render_template("controle_nips.html")
