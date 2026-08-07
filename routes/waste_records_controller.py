from flask import Blueprint, jsonify
from services.waste_records_service import WasteRecordService

bp_waste_records = Blueprint("bp_waste_records", __name__)

@bp_waste_records.route("/api/waste-records", methods=['GET'])
def get_all():
    try:
        waste_records = WasteRecordService.get_all()

        return jsonify([
            waste_record.to_dict()
            for waste_record in waste_records
        ]), 201
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500