from flask import Blueprint, jsonify, request
from services.waste_records_service import WasteRecordService

bp_waste_records = Blueprint("bp_waste_records", __name__)

@bp_waste_records.route("/api/waste-records", methods=['GET'])
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
def get_by_id(waste_record_id):
    try:
        waste_record = WasteRecordService.get_by_id(waste_record_id)

        return jsonify(waste_record.to_dict())
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
    