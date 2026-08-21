from models.lawsuit_appeals_model import LawsuitAppealModel, LawsuitAppeal
from utils.exceptions import ValidationError
from utils.money import parse_money

class LawsuitAppealService:
    def get_all(lawsuit_id):
        try:
            appeals = LawsuitAppealModel.get_all(lawsuit_id)

            return appeals
        except Exception as e:
            raise Exception(str(e))

    def create(data):
        try:
            # Sem piso, diferente do valor da causa do processo (que tem o de
            # MINIMUM_CLAIM_VALUE, em lawsuits_service.py): o recurso pode
            # discutir só parte do que se discutiu na origem, e não existe
            # ainda regra de negócio dizendo qual é o mínimo dessa parte.
            # parse_money continua garantindo o essencial — número de verdade,
            # não negativo, 2 casas, dentro do teto de NUMERIC(15, 2).
            claim_value = parse_money(data.get('claim_value'), "valor do recurso")

            # COLOCAR VALIDAÇÕES AQUI DEPOIS

            appeal = LawsuitAppeal(
                lawsuit_id=data['lawsuit_id'],
                appeal_date=data['appeal_date'],
                appeal_number=data['appeal_number'],
                appellant=data['appellant'],
                appellee=data['appellee'],
                claim_value=claim_value,
                judging_body_id=data['judging_body_id'],
                status_id=data['status_id'],
                loss_probability_id=data['loss_probability_id'],
                inserted_by=data['inserted_by']
            )

            new_appeal = LawsuitAppealModel.create(appeal)

            return new_appeal
        # Valor inválido é 400, e não 500: sem o re-raise, o except abaixo
        # apagaria o tipo da exceção. Mesmo arranjo de lawsuits_service.py.
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))
