from flask import Blueprint, jsonify
from services.proceeding_stages_service import ProceedingStageService
from middlewares.jwt_middleware import token_required_api

bp_proceeding_stages = Blueprint("bp_proceeding_stages", __name__)

@bp_proceeding_stages.route("/api/proceeding-stages", methods=['GET'])
@token_required_api
def get_all():
    try:
        proceeding_stages = ProceedingStageService.get_all()

        return jsonify([
            proceeding_stage.to_dict()
            for proceeding_stage in proceeding_stages
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
