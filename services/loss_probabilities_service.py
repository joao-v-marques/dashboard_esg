from models.loss_probabilities_model import LossProbabilityModel, LossProbability
from utils.exceptions import ValidationError, NotFoundError

class LossProbabilityService:
    def get_all(include_inactive=False):
        try:
            loss_probabilities = LossProbabilityModel.get_all(include_inactive)

            return loss_probabilities
        except Exception as e:
            raise Exception(str(e))

    def create(data):
        try:
            if not isinstance(data, dict):
                raise ValidationError("Envie um corpo JSON com os dados da chance de perda")

            name = data.get("name")

            if not isinstance(name, str) or not name.strip():
                raise ValidationError("O nome da chance de perda é obrigatório")

            name = " ".join(name.split())

            if len(name) > 255:
                raise ValidationError("O nome da chance de perda deve ter no máximo 255 caracteres")

            existing_loss_probability = LossProbabilityModel.get_by_name(name)

            if existing_loss_probability:
                if existing_loss_probability.is_active:
                    raise ValidationError("Já existe uma chance de perda cadastrada com esse nome")

                # Tratamento para reativar Chance de perda caso um usuário tente cadastrar alguma já existente e inativa
                return LossProbabilityModel.set_active(existing_loss_probability.id, True)

            loss_probability = LossProbability(
                name=name
            )

            new_loss_probability = LossProbabilityModel.create(loss_probability)

            return new_loss_probability
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))

    def update(loss_probability_id, data):
        try:
            if not isinstance(data, dict):
                raise ValidationError("Envie um corpo JSON com os dados da chance de perda")

            name = data.get("name")

            if not isinstance(name, str) or not name.strip():
                raise ValidationError("O nome da chance de perda é obrigatório")

            name = " ".join(name.split())

            if len(name) > 255:
                raise ValidationError("O nome da chance de perda deve ter no máximo 255 caracteres")

            loss_probability = LossProbabilityModel.get_by_id(loss_probability_id)

            if loss_probability is None:
                raise NotFoundError("Chance de perda não encontrada")

            existing_loss_probability = LossProbabilityModel.get_by_name(name)

            # Bloqueia o nome de qualquer outro registro, ativo ou inativo, para não
            # ficarem duas chances de perda homônimas caso a inativa seja reativada depois
            if existing_loss_probability and existing_loss_probability.id != loss_probability_id:
                raise ValidationError("Já existe uma chance de perda cadastrada com esse nome")

            loss_probability.name = name

            return LossProbabilityModel.update(loss_probability)
        except (ValidationError, NotFoundError):
            raise
        except Exception as e:
            raise Exception(str(e))

    def delete(loss_probability_id):
        try:
            loss_probability = LossProbabilityModel.get_by_id(loss_probability_id)

            if loss_probability is None:
                raise NotFoundError("Chance de perda não encontrada")

            # Caso esteja inativa, devolve o registro como está
            if not loss_probability.is_active:
                return loss_probability

            return LossProbabilityModel.set_active(loss_probability_id, False)
        except (ValidationError, NotFoundError):
            raise
        except Exception as e:
            raise Exception(str(e))

    def reactivate(loss_probability_id):
        try:
            loss_probability = LossProbabilityModel.get_by_id(loss_probability_id)

            if loss_probability is None:
                raise NotFoundError("Chance de perda não encontrada")

            # Caso já esteja ativa, devolve o registro como está — mesmo desenho
            # idempotente do delete() acima: repetir a ação não é erro
            if loss_probability.is_active:
                return loss_probability

            return LossProbabilityModel.set_active(loss_probability_id, True)
        except (ValidationError, NotFoundError):
            raise
        except Exception as e:
            raise Exception(str(e))
