from flask import Blueprint, jsonify
from services.judging_bodies_service import JudgingBodyService
from middlewares.jwt_middleware import token_required_api

bp_judging_bodies = Blueprint("bp_judging_bodies", __name__)

@bp_judging_bodies.route("/api/judging-bodies", methods=['GET'])
@token_required_api
def get_all():
    try:
        judging_bodies = JudgingBodyService.get_all()

        return jsonify([
            judging_body.to_dict()
            for judging_body in judging_bodies
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
