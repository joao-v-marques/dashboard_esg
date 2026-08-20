from flask import Blueprint, jsonify, request
from services.nip_dashboard_service import NipDashboardService
from utils.exceptions import ValidationError
from middlewares.jwt_middleware import token_required_api

bp_nip_dashboard = Blueprint("bp_nip_dashboard", __name__)

@bp_nip_dashboard.route("/api/juridico/dashboard", methods=['GET'])
@token_required_api
def get_dashboard():
    try:
        de = request.args.get('de')
        ate = request.args.get('ate')

        dashboard_data = NipDashboardService.get_dashboard(de, ate)

        return jsonify(dashboard_data), 200
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
