from models.lawsuit_status_model import LawsuitStatusModel, LawsuitStatus
from utils.exceptions import ValidationError, NotFoundError

class LawsuitStatusService:
    def get_all(include_inactive=False):
        try:
            lawsuit_status = LawsuitStatusModel.get_all(include_inactive)

            return lawsuit_status
        except Exception as e:
            raise Exception(str(e))

    def create(data):
        try:
            if not isinstance(data, dict):
                raise ValidationError("Envie um corpo JSON com os dados do status")

            name = data.get("name")

            if not isinstance(name, str) or not name.strip():
                raise ValidationError("O nome do status é obrigatório")

            name = " ".join(name.split())

            if len(name) > 255:
                raise ValidationError("O nome do status deve ter no máximo 255 caracteres")

            existing_lawsuit_status = LawsuitStatusModel.get_by_name(name)

            if existing_lawsuit_status:
                if existing_lawsuit_status.is_active:
                    raise ValidationError("Já existe um status cadastrado com esse nome")

                # Tratamento para reativar Status caso um usuário tente cadastrar algum já existente e inativo
                return LawsuitStatusModel.set_active(existing_lawsuit_status.id, True)

            lawsuit_status = LawsuitStatus(
                name=name
            )

            new_lawsuit_status = LawsuitStatusModel.create(lawsuit_status)

            return new_lawsuit_status
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))

    def update(lawsuit_status_id, data):
        try:
            if not isinstance(data, dict):
                raise ValidationError("Envie um corpo JSON com os dados do status")

            name = data.get("name")

            if not isinstance(name, str) or not name.strip():
                raise ValidationError("O nome do status é obrigatório")

            name = " ".join(name.split())

            if len(name) > 255:
                raise ValidationError("O nome do status deve ter no máximo 255 caracteres")

            lawsuit_status = LawsuitStatusModel.get_by_id(lawsuit_status_id)

            if lawsuit_status is None:
                raise NotFoundError("Status não encontrado")

            existing_lawsuit_status = LawsuitStatusModel.get_by_name(name)

            # Bloqueia o nome de qualquer outro registro, ativo ou inativo, para não
            # ficarem dois status homônimos caso o inativo seja reativado depois
            if existing_lawsuit_status and existing_lawsuit_status.id != lawsuit_status_id:
                raise ValidationError("Já existe um status cadastrado com esse nome")

            lawsuit_status.name = name

            return LawsuitStatusModel.update(lawsuit_status)
        except (ValidationError, NotFoundError):
            raise
        except Exception as e:
            raise Exception(str(e))

    def delete(lawsuit_status_id):
        try:
            lawsuit_status = LawsuitStatusModel.get_by_id(lawsuit_status_id)

            if lawsuit_status is None:
                raise NotFoundError("Status não encontrado")

            # Caso esteja inativo, devolve o registro como está
            if not lawsuit_status.is_active:
                return lawsuit_status

            return LawsuitStatusModel.set_active(lawsuit_status_id, False)
        except (ValidationError, NotFoundError):
            raise
        except Exception as e:
            raise Exception(str(e))

    def reactivate(lawsuit_status_id):
        try:
            lawsuit_status = LawsuitStatusModel.get_by_id(lawsuit_status_id)

            if lawsuit_status is None:
                raise NotFoundError("Status não encontrado")

            # Caso já esteja ativo, devolve o registro como está — mesmo desenho
            # idempotente do delete() acima: repetir a ação não é erro
            if lawsuit_status.is_active:
                return lawsuit_status

            return LawsuitStatusModel.set_active(lawsuit_status_id, True)
        except (ValidationError, NotFoundError):
            raise
        except Exception as e:
            raise Exception(str(e))
