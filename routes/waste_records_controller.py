from flask import Blueprint, jsonify, request
from services.waste_records_service import WasteRecordService
from utils.exceptions import ValidationError
from middlewares.jwt_middleware import token_required_api

bp_waste_records = Blueprint("bp_waste_records", __name__)

@bp_waste_records.route("/api/waste-records", methods=['GET'])
@token_required_api
def get_all():
    try:
        waste_records = WasteRecordService.get_all()

        return jsonify([
            waste_record.to_dict()
            for waste_record in waste_records
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_waste_records.route("/api/waste-records/<int:waste_record_id>", methods=['GET'])
@token_required_api
def get_by_id(waste_record_id):
    try:
        waste_record = WasteRecordService.get_by_id(waste_record_id)

        return jsonify(waste_record.to_dict())
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_waste_records.route("/api/waste-records", methods=['POST'])
@token_required_api
def create():
    try:
        data = request.get_json()

        created_waste_record = WasteRecordService.create(data)

        return jsonify(created_waste_record.created_to_dict()), 201
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_waste_records.route("/api/waste-records", methods=['PUT'])
@token_required_api
def update():
    try:
        data = request.get_json()
        current_user_id = request.user["id"]

        updated_waste_record = WasteRecordService.update(data, current_user_id)

        return jsonify(updated_waste_record.to_dict()), 200
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500