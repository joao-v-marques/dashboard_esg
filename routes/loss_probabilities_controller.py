from flask import Blueprint, jsonify
from services.loss_probabilities_service import LossProbabilityService
from middlewares.jwt_middleware import token_required_api

bp_loss_probabilities = Blueprint("bp_loss_probabilities", __name__)

@bp_loss_probabilities.route("/api/loss-probabilities", methods=['GET'])
@token_required_api
def get_all():
    try:
        loss_probabilities = LossProbabilityService.get_all()

        return jsonify([
            loss_probability.to_dict()
            for loss_probability in loss_probabilities
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
