from models.subject_matters_model import SubjectMattersModel, SubjectMatters
from utils.exceptions import ValidationError, NotFoundError

class SubjectMattersService:
    def get_all(include_inactive=False):
        try:
            subject_matters = SubjectMattersModel.get_all(include_inactive)

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

            existing_subject_matter = SubjectMattersModel.get_by_name(name)

            if existing_subject_matter:
                if existing_subject_matter.is_active:
                    raise ValidationError("Já existe um objeto cadastrado com esse nome")

                # Tratamento para reativar Objeto caso um usuário tente cadastrar algum já existente e inativo
                return SubjectMattersModel.set_active(existing_subject_matter.id, True)

            subject_matter = SubjectMatters(
                name=name
            )

            new_subject_matter = SubjectMattersModel.create(subject_matter)
        
            return new_subject_matter
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))

    def update(subject_matter_id, data):
        try:
            if not isinstance(data, dict):
                raise ValidationError("Envie um corpo JSON com os dados do objeto")

            name = data.get("name")

            if not isinstance(name, str) or not name.strip():
                raise ValidationError("O nome do objeto é obrigatório")

            name = " ".join(name.split())

            if len(name) > 255:
                raise ValidationError("O nome do objeto deve ter no máximo 255 caracteres")

            subject_matter = SubjectMattersModel.get_by_id(subject_matter_id)

            if subject_matter is None:
                raise NotFoundError("Objeto não encontrado")

            existing_subject_matter = SubjectMattersModel.get_by_name(name)

            # Bloqueia o nome de qualquer outro registro, ativo ou inativo, para não
            # ficarem dois objetos homônimos caso o inativo seja reativado depois
            if existing_subject_matter and existing_subject_matter.id != subject_matter_id:
                raise ValidationError("Já existe um objeto cadastrado com esse nome")

            subject_matter.name = name

            return SubjectMattersModel.update(subject_matter)
        except (ValidationError, NotFoundError):
            raise
        except Exception as e:
            raise Exception(str(e))

    def delete(subject_matter_id):
        try:
            subject_matter = SubjectMattersModel.get_by_id(subject_matter_id)

            if subject_matter is None:
                raise NotFoundError("Objeto não encontrado")

            # Caso esteja inativo, devolve o registro como está
            if not subject_matter.is_active:
                return subject_matter

            return SubjectMattersModel.set_active(subject_matter_id, False)
        except (ValidationError, NotFoundError):
            raise
        except Exception as e:
            raise Exception(str(e))

    def reactivate(subject_matter_id):
        try:
            subject_matter = SubjectMattersModel.get_by_id(subject_matter_id)

            if subject_matter is None:
                raise NotFoundError("Objeto não encontrado")

            # Caso já esteja ativo, devolve o registro como está — mesmo desenho
            # idempotente do delete() acima: repetir a ação não é erro
            if subject_matter.is_active:
                return subject_matter

            return SubjectMattersModel.set_active(subject_matter_id, True)
        except (ValidationError, NotFoundError):
            raise
        except Exception as e:
            raise Exception(str(e))
