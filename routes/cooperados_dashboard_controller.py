from flask import Blueprint, jsonify, request
from services.cooperados_dashboard_service import CooperadosDashboardService
from utils.exceptions import UpstreamError, ValidationError
from middlewares.jwt_middleware import token_required_api

bp_cooperados_dashboard = Blueprint("bp_cooperados_dashboard", __name__)

@bp_cooperados_dashboard.route("/api/cooperados/dashboard", methods=['GET'])
@token_required_api
def get_dashboard():
    try:
        ano = request.args.get('ano')

        dashboard_data = CooperadosDashboardService.get_dashboard(ano)

        return jsonify(dashboard_data), 200
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except UpstreamError as e:
        # Validação de retorno de UpstreamError, caso a API do certificados_cooperados não tenha respondido
        return jsonify({
            "message": str(e)
        }), 502
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
