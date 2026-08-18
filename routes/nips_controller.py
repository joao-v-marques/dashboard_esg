from flask import Blueprint, jsonify, request
from services.nips_service import NipService
from utils.exceptions import ValidationError
from middlewares.jwt_middleware import token_required_api

bp_nips = Blueprint("bp_nips", __name__)

@bp_nips.route("/api/nips", methods=['GET'])
@token_required_api
def get_all():
    try:
        nips = NipService.get_all()

        return jsonify([
            nip.to_dict()
            for nip in nips
        ])
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_nips.route("/api/nips", methods=['POST'])
@token_required_api
def create():
    try:
        data = request.get_json()

        new_nip = NipService.create(data)

        return jsonify(new_nip.to_dict()), 201
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_nips.route("/api/nips", methods=['PUT'])
@token_required_api
def update():
    try:
        data = request.get_json()
        current_user_id = request.user["id"]

        updated_nip = NipService.update(data, current_user_id)

        return jsonify(updated_nip.to_dict()), 200
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500