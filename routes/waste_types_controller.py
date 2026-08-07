from flask import Blueprint, jsonify
from services.waste_types_service import WasteTypeService

bp_waste_types = Blueprint("bp_waste_types", __name__)

@bp_waste_types.route("/api/waste-types", methods=['GET'])
def get_all():
    try:
        waste_types = WasteTypeService.get_all()

        return jsonify([
            waste_type.to_dict()
            for waste_type in waste_types
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500