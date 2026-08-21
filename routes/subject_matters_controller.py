from flask import Blueprint, jsonify
from services.subject_matters_services import SubjectMattersService
from middlewares.jwt_middleware import token_required_api

bp_subject_matters = Blueprint("bp_subject_matters", __name__)

@bp_subject_matters.route("/api/subject-matters", methods=['GET'])
@token_required_api
def get_all():
    try:
        subject_matters = SubjectMattersService.get_all()

        return jsonify([
            subject_matter.to_dict()
            for subject_matter in subject_matters
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
