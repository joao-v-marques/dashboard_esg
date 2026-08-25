from flask import Blueprint, jsonify, request
from services.judging_bodies_service import JudgingBodyService
from middlewares.jwt_middleware import token_required_api
from utils.exceptions import ValidationError, NotFoundError

bp_judging_bodies = Blueprint("bp_judging_bodies", __name__)

@bp_judging_bodies.route("/api/judging-bodies", methods=['GET'])
@token_required_api
def get_all():
    try:
        # Pega a informação de se são apenas ativos ou inativos por query params
        include_inactive = request.args.get("include_inactive", "").lower() in ("true", "1")

        judging_bodies = JudgingBodyService.get_all(include_inactive)

        return jsonify([
            judging_body.to_dict()
            for judging_body in judging_bodies
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_judging_bodies.route("/api/judging-bodies", methods=['POST'])
@token_required_api
def create():
    try:
        data = request.get_json(silent=True)

        new_judging_body = JudgingBodyService.create(data)

        return jsonify(new_judging_body.to_dict()), 201
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_judging_bodies.route("/api/judging-bodies/<int:judging_body_id>", methods=['PUT'])
@token_required_api
def update(judging_body_id):
    try:
        data = request.get_json(silent=True)

        updated_judging_body = JudgingBodyService.update(judging_body_id, data)

        return jsonify(updated_judging_body.to_dict()), 200
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_judging_bodies.route("/api/judging-bodies/<int:judging_body_id>", methods=['DELETE'])
@token_required_api
def delete(judging_body_id):
    try:
        deleted_judging_body = JudgingBodyService.delete(judging_body_id)

        return jsonify(deleted_judging_body.to_dict()), 200
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_judging_bodies.route("/api/judging-bodies/<int:judging_body_id>/reactivate", methods=['PATCH'])
@token_required_api
def reactivate(judging_body_id):
    try:
        reactivated_judging_body = JudgingBodyService.reactivate(judging_body_id)

        return jsonify(reactivated_judging_body.to_dict()), 200
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
