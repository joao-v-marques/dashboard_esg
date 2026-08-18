from flask import Blueprint, jsonify
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