from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required

bp_render_home = Blueprint("bp_render_home", __name__)

@bp_render_home.route("/home", methods=['GET'])
@token_required
def render_home():
    return render_template("home.html")