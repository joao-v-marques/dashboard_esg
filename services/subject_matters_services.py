from models.subject_matters_model import SubjectMattersModel, SubjectMatters
from utils.exceptions import ValidationError

class SubjectMattersService:
    def get_all():
        try:
            subject_matters = SubjectMattersModel.get_all()

            return subject_matters
        except Exception as e:
            raise Exception(str(e))

    def create(data):
        try:
            if not isinstance(data, dict):
                raise ValidationError("Envie um corpo JSON com os dados do objeto")

            name = data.get("name")

            if not isinstance(name, str) or not name.strip():
                raise ValidationError("O nome do objeto é obrigatório")

            name = " ".join(name.split())

            if len(name) > 255:
                raise ValidationError("O nome do objeto deve ter no máximo 255 caracteres")

            if SubjectMattersModel.get_by_name(name):
                raise ValidationError("Já existe um objeto cadastrado com esse nome")

            subject_matter = SubjectMatters(
                name=name
            )

            new_subject_matter = SubjectMattersModel.create(subject_matter)
        
            return new_subject_matter
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))