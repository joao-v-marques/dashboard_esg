from flask import Blueprint, jsonify, request
from services.lawsuit_status_service import LawsuitStatusService
from middlewares.jwt_middleware import token_required_api
from utils.exceptions import ValidationError, NotFoundError

bp_lawsuit_status = Blueprint("bp_lawsuit_status", __name__)

@bp_lawsuit_status.route("/api/lawsuit-status", methods=['GET'])
@token_required_api
def get_all():
    try:
        # Pega a informação de se são apenas ativos ou inativos por query params
        include_inactive = request.args.get("include_inactive", "").lower() in ("true", "1")

        lawsuit_status = LawsuitStatusService.get_all(include_inactive)

        return jsonify([
            status.to_dict()
            for status in lawsuit_status
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_lawsuit_status.route("/api/lawsuit-status", methods=['POST'])
@token_required_api
def create():
    try:
        data = request.get_json(silent=True)

        new_lawsuit_status = LawsuitStatusService.create(data)

        return jsonify(new_lawsuit_status.to_dict()), 201
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_lawsuit_status.route("/api/lawsuit-status/<int:lawsuit_status_id>", methods=['PUT'])
@token_required_api
def update(lawsuit_status_id):
    try:
        data = request.get_json(silent=True)

        updated_lawsuit_status = LawsuitStatusService.update(lawsuit_status_id, data)

        return jsonify(updated_lawsuit_status.to_dict()), 200
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

@bp_lawsuit_status.route("/api/lawsuit-status/<int:lawsuit_status_id>", methods=['DELETE'])
@token_required_api
def delete(lawsuit_status_id):
    try:
        deleted_lawsuit_status = LawsuitStatusService.delete(lawsuit_status_id)

        return jsonify(deleted_lawsuit_status.to_dict()), 200
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

@bp_lawsuit_status.route("/api/lawsuit-status/<int:lawsuit_status_id>/reactivate", methods=['PATCH'])
@token_required_api
def reactivate(lawsuit_status_id):
    try:
        reactivated_lawsuit_status = LawsuitStatusService.reactivate(lawsuit_status_id)

        return jsonify(reactivated_lawsuit_status.to_dict()), 200
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
