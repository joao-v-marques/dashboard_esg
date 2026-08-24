from flask import Blueprint, jsonify, request
from services.loss_probabilities_service import LossProbabilityService
from middlewares.jwt_middleware import token_required_api
from utils.exceptions import ValidationError, NotFoundError

bp_loss_probabilities = Blueprint("bp_loss_probabilities", __name__)

@bp_loss_probabilities.route("/api/loss-probabilities", methods=['GET'])
@token_required_api
def get_all():
    try:
        # Pega a informação de se são apenas ativas ou inativas por query params
        include_inactive = request.args.get("include_inactive", "").lower() in ("true", "1")

        loss_probabilities = LossProbabilityService.get_all(include_inactive)

        return jsonify([
            loss_probability.to_dict()
            for loss_probability in loss_probabilities
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_loss_probabilities.route("/api/loss-probabilities", methods=['POST'])
@token_required_api
def create():
    try:
        data = request.get_json(silent=True)

        new_loss_probability = LossProbabilityService.create(data)

        return jsonify(new_loss_probability.to_dict()), 201
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_loss_probabilities.route("/api/loss-probabilities/<int:loss_probability_id>", methods=['PUT'])
@token_required_api
def update(loss_probability_id):
    try:
        data = request.get_json(silent=True)

        updated_loss_probability = LossProbabilityService.update(loss_probability_id, data)

        return jsonify(updated_loss_probability.to_dict()), 200
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

@bp_loss_probabilities.route("/api/loss-probabilities/<int:loss_probability_id>", methods=['DELETE'])
@token_required_api
def delete(loss_probability_id):
    try:
        deleted_loss_probability = LossProbabilityService.delete(loss_probability_id)

        return jsonify(deleted_loss_probability.to_dict()), 200
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

@bp_loss_probabilities.route("/api/loss-probabilities/<int:loss_probability_id>/reactivate", methods=['PATCH'])
@token_required_api
def reactivate(loss_probability_id):
    try:
        reactivated_loss_probability = LossProbabilityService.reactivate(loss_probability_id)

        return jsonify(reactivated_loss_probability.to_dict()), 200
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
