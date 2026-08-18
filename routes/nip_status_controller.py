from flask import Blueprint, jsonify
from services.nip_status_service import NipStatusService
from middlewares.jwt_middleware import token_required_api

bp_nip_status = Blueprint("bp_nip_status", __name__)

@bp_nip_status.route("/api/nip-status", methods=['GET'])
@token_required_api
def get_all():
    try:
        nip_status = NipStatusService.get_all()

        return jsonify([
            status.to_dict()
            for status in nip_status
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
