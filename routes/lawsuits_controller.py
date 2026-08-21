from flask import Blueprint, jsonify, request
from services.lawsuits_service import LawsuitService
from middlewares.jwt_middleware import token_required_api

bp_lawsuits = Blueprint("bp_lawsuits", __name__)

@bp_lawsuits.route("/api/lawsuits", methods=['GET'])
@token_required_api
def get_all():
    try:
        lawsuits = LawsuitService.get_all()

        return jsonify([
            lawsuit.to_dict()
            for lawsuit in lawsuits
        ])
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_lawsuits.route("/api/lawsuits", methods=['POST'])
@token_required_api
def create():
    try:
        data = request.get_json()

        new_lawsuit = LawsuitService.create(data)

        return jsonify(new_lawsuit.to_dict()), 201
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
