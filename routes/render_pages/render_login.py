from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required

bp_render_login = Blueprint("bp_render_login", __name__)

@token_required
@bp_render_login.route("/login", methods=['GET'])
def render_login():
    return render_template("login.html")
