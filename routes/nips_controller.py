from flask import Blueprint, jsonify, request
from services.nips_service import NipService

bp_nips = Blueprint("bp_nips", __name__)

@bp_nips.route("/api/nips", methods=['GET'])
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
def create():
    try:
        data = request.get_json()

        new_nip = NipService.create(data)

        return jsonify(new_nip.to_dict()), 201
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500