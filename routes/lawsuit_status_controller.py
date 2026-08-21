from flask import Blueprint, jsonify
from services.lawsuit_status_service import LawsuitStatusService
from middlewares.jwt_middleware import token_required_api

bp_lawsuit_status = Blueprint("bp_lawsuit_status", __name__)

@bp_lawsuit_status.route("/api/lawsuit-status", methods=['GET'])
@token_required_api
def get_all():
    try:
        lawsuit_status = LawsuitStatusService.get_all()

        return jsonify([
            status.to_dict()
            for status in lawsuit_status
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
