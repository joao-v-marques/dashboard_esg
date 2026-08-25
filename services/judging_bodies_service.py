from models.judging_bodies_model import JudgingBodyModel, JudgingBody
from utils.exceptions import ValidationError, NotFoundError

class JudgingBodyService:
    def get_all(include_inactive=False):
        try:
            judging_bodies = JudgingBodyModel.get_all(include_inactive)

            return judging_bodies
        except Exception as e:
            raise Exception(str(e))

    def create(data):
        try:
            if not isinstance(data, dict):
                raise ValidationError("Envie um corpo JSON com os dados do órgão julgador")

            name = data.get("name")

            if not isinstance(name, str) or not name.strip():
                raise ValidationError("O nome do órgão julgador é obrigatório")

            name = " ".join(name.split())

            if len(name) > 255:
                raise ValidationError("O nome do órgão julgador deve ter no máximo 255 caracteres")

            existing_judging_body = JudgingBodyModel.get_by_name(name)

            if existing_judging_body:
                if existing_judging_body.is_active:
                    raise ValidationError("Já existe um órgão julgador cadastrado com esse nome")

                # Tratamento para reativar Órgão julgador caso um usuário tente cadastrar algum já existente e inativo
                return JudgingBodyModel.set_active(existing_judging_body.id, True)

            judging_body = JudgingBody(
                name=name
            )

            new_judging_body = JudgingBodyModel.create(judging_body)

            return new_judging_body
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))

    def update(judging_body_id, data):
        try:
            if not isinstance(data, dict):
                raise ValidationError("Envie um corpo JSON com os dados do órgão julgador")

            name = data.get("name")

            if not isinstance(name, str) or not name.strip():
                raise ValidationError("O nome do órgão julgador é obrigatório")

            name = " ".join(name.split())

            if len(name) > 255:
                raise ValidationError("O nome do órgão julgador deve ter no máximo 255 caracteres")

            judging_body = JudgingBodyModel.get_by_id(judging_body_id)

            if judging_body is None:
                raise NotFoundError("Órgão julgador não encontrado")

            existing_judging_body = JudgingBodyModel.get_by_name(name)

            if existing_judging_body and existing_judging_body.id != judging_body_id:
                raise ValidationError("Já existe um órgão julgador cadastrado com esse nome")

            judging_body.name = name

            return JudgingBodyModel.update(judging_body)
        except (ValidationError, NotFoundError):
            raise
        except Exception as e:
            raise Exception(str(e))

    def delete(judging_body_id):
        try:
            judging_body = JudgingBodyModel.get_by_id(judging_body_id)

            if judging_body is None:
                raise NotFoundError("Órgão julgador não encontrado")

            # Caso esteja inativo, devolve o registro como está
            if not judging_body.is_active:
                return judging_body

            return JudgingBodyModel.set_active(judging_body_id, False)
        except (ValidationError, NotFoundError):
            raise
        except Exception as e:
            raise Exception(str(e))

    def reactivate(judging_body_id):
        try:
            judging_body = JudgingBodyModel.get_by_id(judging_body_id)

            if judging_body is None:
                raise NotFoundError("Órgão julgador não encontrado")

            # Caso já esteja ativo, devolve o registro como está
            if judging_body.is_active:
                return judging_body

            return JudgingBodyModel.set_active(judging_body_id, True)
        except (ValidationError, NotFoundError):
            raise
        except Exception as e:
            raise Exception(str(e))
