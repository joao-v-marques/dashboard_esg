from flask import Blueprint, jsonify, request
from services.subject_matters_services import SubjectMattersService
from middlewares.jwt_middleware import token_required_api
from utils.exceptions import ValidationError, NotFoundError

bp_subject_matters = Blueprint("bp_subject_matters", __name__)

@bp_subject_matters.route("/api/subject-matters", methods=['GET'])
@token_required_api
def get_all():
    try:
        # Pega a informação de se são apenas ativos ou inativos por query params
        include_inactive = request.args.get("include_inactive", "").lower() in ("true", "1")

        subject_matters = SubjectMattersService.get_all(include_inactive)

        return jsonify([
            subject_matter.to_dict()
            for subject_matter in subject_matters
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_subject_matters.route("/api/subject-matters", methods=['POST'])
@token_required_api
def create():
    try:
        data = request.get_json(silent=True)

        new_subject_matter = SubjectMattersService.create(data)

        return jsonify(new_subject_matter.to_dict()), 201
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_subject_matters.route("/api/subject-matters/<int:subject_matter_id>", methods=['PUT'])
@token_required_api
def update(subject_matter_id):
    try:
        data = request.get_json(silent=True)

        updated_subject_matter = SubjectMattersService.update(subject_matter_id, data)

        return jsonify(updated_subject_matter.to_dict()), 200
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_subject_matters.route("/api/subject-matters/<int:subject_matter_id>", methods=['DELETE'])
@token_required_api
def delete(subject_matter_id):
    try:
        deleted_subject_matter = SubjectMattersService.delete(subject_matter_id)

        return jsonify(deleted_subject_matter.to_dict()), 200
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_subject_matters.route("/api/subject-matters/<int:subject_matter_id>/reactivate", methods=['PATCH'])
@token_required_api
def reactivate(subject_matter_id):
    try:
        reactivated_subject_matter = SubjectMattersService.reactivate(subject_matter_id)

        return jsonify(reactivated_subject_matter.to_dict()), 200
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
