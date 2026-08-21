from models.lawsuits_model import LawsuitModel, Lawsuit
from utils.exceptions import ValidationError
from utils.money import parse_money

# Piso do valor da causa, inclusivo: 100 passa, 99,99 não. Fica em constante
# porque a mesma regra vale no POST e no PUT — a de recurso é outra, e mora em
# lawsuit_appeals_service.py.
MINIMUM_CLAIM_VALUE = 100

class LawsuitService:
    def get_all():
        try:
            lawsuits = LawsuitModel.get_all()

            return lawsuits
        except Exception as e:
            raise Exception(str(e))

    def create(data):
        try:
            # parse_money devolve Decimal de 2 casas — é ele que vai para a
            # coluna NUMERIC(15, 2), nunca o float que veio do JSON. Também é
            # ele que recusa texto, nulo e negativo com 400, em vez de deixar
            # o erro nascer no banco como 500. Ver utils/money.py.
            claim_value = parse_money(data.get('claim_value'), "valor da causa", minimum=MINIMUM_CLAIM_VALUE)

            # COLOCAR VALIDAÇÕES AQUI DEPOIS

            lawsuit = Lawsuit(
                lawsuit_date=data['lawsuit_date'],
                case_number=data['case_number'],
                plaintiff=data['plaintiff'],
                defendant=data['defendant'],
                claim_value=claim_value,
                subject_matter_id=data['subject_matter_id'],
                proceeding_stage_id=data['proceeding_stage_id'],
                status_id=data['status_id'],
                loss_probability_id=data['loss_probability_id'],
                inserted_by=data['inserted_by']
            )

            new_lawsuit = LawsuitModel.create(lawsuit)

            return new_lawsuit
        # Sem este re-raise, o "except Exception" abaixo reembrulharia a
        # ValidationError num Exception genérico e o controller devolveria 500
        # para um valor inválido, que é caso de 400 — mesmo arranjo do update.
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))

    def update(data, current_user_id):
        try:
            lawsuit = LawsuitModel.get_by_id(data['id'])

            if not lawsuit:
                raise ValueError("Não foi encontrado registro de processo judicial com esse ID")

            if not isinstance(data, dict):
                raise ValidationError("Envie um corpo JSON com os dados do processo")

            # COLOCAR AS VALIDAÇÕES AQUI DEPOIS
            claim_value = parse_money(data.get('claim_value'), "valor da causa", minimum=MINIMUM_CLAIM_VALUE)

            new_lawsuit = Lawsuit(
                id=data['id'],
                lawsuit_date=data['lawsuit_date'],
                case_number=data['case_number'],
                plaintiff=data['plaintiff'],
                defendant=data['defendant'],
                claim_value=claim_value,
                subject_matter_id=data['subject_matter_id'],
                proceeding_stage_id=data['proceeding_stage_id'],
                status_id=data['status_id'],
                loss_probability_id=data['loss_probability_id'],
            )

            returned_lawsuit = LawsuitModel.update(new_lawsuit, current_user_id)

            return returned_lawsuit
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))
