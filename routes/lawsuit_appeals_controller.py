from flask import Blueprint, jsonify, request
from services.lawsuit_appeals_service import LawsuitAppealService
from utils.exceptions import ValidationError
from middlewares.jwt_middleware import token_required_api

bp_lawsuit_appeals = Blueprint("bp_lawsuit_appeals", __name__)

# Sem GET de todos os recursos: hoje só existe a listagem de recursos de UM
# processo, aberta a partir da tela "Consultar Processos" — lawsuit_id é
# obrigatório, não um filtro opcional.
@bp_lawsuit_appeals.route("/api/lawsuit-appeals", methods=['GET'])
@token_required_api
def get_all():
    try:
        lawsuit_id = request.args.get('lawsuit_id')
        if not lawsuit_id:
            raise ValidationError("Informe lawsuit_id para listar os recursos do processo")

        appeals = LawsuitAppealService.get_all(lawsuit_id)

        return jsonify([
            appeal.to_dict()
            for appeal in appeals
        ])
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_lawsuit_appeals.route("/api/lawsuit-appeals", methods=['POST'])
@token_required_api
def create():
    try:
        data = request.get_json()

        new_appeal = LawsuitAppealService.create(data)

        return jsonify(new_appeal.to_dict()), 201
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
