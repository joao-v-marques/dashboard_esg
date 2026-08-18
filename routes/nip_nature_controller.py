from flask import Blueprint, jsonify
from services.nip_nature_service import NipNatureService
from middlewares.jwt_middleware import token_required_api

bp_nip_natures = Blueprint("bp_nip_natures", __name__)

@bp_nip_natures.route("/api/nip-natures", methods=['GET'])
@token_required_api
def get_all():
    try:
        nip_natures = NipNatureService.get_all()

        return jsonify([
            nip_nature.to_dict()
            for nip_nature in nip_natures
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
