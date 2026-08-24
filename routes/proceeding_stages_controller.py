from flask import Blueprint, jsonify, request
from services.proceeding_stages_service import ProceedingStageService
from middlewares.jwt_middleware import token_required_api
from utils.exceptions import ValidationError, NotFoundError

bp_proceeding_stages = Blueprint("bp_proceeding_stages", __name__)

@bp_proceeding_stages.route("/api/proceeding-stages", methods=['GET'])
@token_required_api
def get_all():
    try:
        # Pega a informação de se são apenas ativos ou inativos por query params
        include_inactive = request.args.get("include_inactive", "").lower() in ("true", "1")

        proceeding_stages = ProceedingStageService.get_all(include_inactive)

        return jsonify([
            proceeding_stage.to_dict()
            for proceeding_stage in proceeding_stages
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_proceeding_stages.route("/api/proceeding-stages", methods=['POST'])
@token_required_api
def create():
    try:
        data = request.get_json(silent=True)

        new_proceeding_stage = ProceedingStageService.create(data)

        return jsonify(new_proceeding_stage.to_dict()), 201
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_proceeding_stages.route("/api/proceeding-stages/<int:proceeding_stage_id>", methods=['PUT'])
@token_required_api
def update(proceeding_stage_id):
    try:
        data = request.get_json(silent=True)

        updated_proceeding_stage = ProceedingStageService.update(proceeding_stage_id, data)

        return jsonify(updated_proceeding_stage.to_dict()), 200
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

@bp_proceeding_stages.route("/api/proceeding-stages/<int:proceeding_stage_id>", methods=['DELETE'])
@token_required_api
def delete(proceeding_stage_id):
    try:
        deleted_proceeding_stage = ProceedingStageService.delete(proceeding_stage_id)

        return jsonify(deleted_proceeding_stage.to_dict()), 200
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

@bp_proceeding_stages.route("/api/proceeding-stages/<int:proceeding_stage_id>/reactivate", methods=['PATCH'])
@token_required_api
def reactivate(proceeding_stage_id):
    try:
        reactivated_proceeding_stage = ProceedingStageService.reactivate(proceeding_stage_id)

        return jsonify(reactivated_proceeding_stage.to_dict()), 200
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
