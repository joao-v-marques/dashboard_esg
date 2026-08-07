from flask import Blueprint, jsonify
from services.unit_service import UnitService

bp_unit = Blueprint("bp_unit", __name__)

@bp_unit.route("/api/units", methods=['GET'])
def get_all():
    try:
        units = UnitService.get_all()

        return jsonify([
            unit.to_dict()
            for unit in units
        ])
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500