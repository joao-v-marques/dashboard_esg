from flask import Blueprint, jsonify, request
from services.waste_dashboard_service import WasteDashboardService
from utils.exceptions import ValidationError
from middlewares.jwt_middleware import token_required_api

bp_waste_dashboard = Blueprint("bp_waste_dashboard", __name__)

@bp_waste_dashboard.route("/api/residuos/dashboard", methods=['GET'])
@token_required_api
def get_dashboard():
    try:
        de = request.args.get('de')
        ate = request.args.get('ate')

        dashboard_data = WasteDashboardService.get_dashboard(de, ate)

        return jsonify(dashboard_data), 200
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
