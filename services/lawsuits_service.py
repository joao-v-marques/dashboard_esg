from models.lawsuits_model import LawsuitModel, Lawsuit
from utils.exceptions import ValidationError

class LawsuitService:
    def get_all():
        try:
            lawsuits = LawsuitModel.get_all()

            return lawsuits
        except Exception as e:
            raise Exception(str(e))

    def create(data):
        try:
            # COLOCAR VALIDAÇÕES AQUI DEPOIS

            lawsuit = Lawsuit(
                lawsuit_date=data['lawsuit_date'],
                case_number=data['case_number'],
                plaintiff=data['plaintiff'],
                defendant=data['defendant'],
                claim_value=data['claim_value'],
                subject_matter_id=data['subject_matter_id'],
                proceeding_stage_id=data['proceeding_stage_id'],
                status_id=data['status_id'],
                loss_probability_id=data['loss_probability_id'],
                inserted_by=data['inserted_by']
            )

            new_lawsuit = LawsuitModel.create(lawsuit)

            return new_lawsuit
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

            new_lawsuit = Lawsuit(
                id=data['id'],
                lawsuit_date=data['lawsuit_date'],
                case_number=data['case_number'],
                plaintiff=data['plaintiff'],
                defendant=data['defendant'],
                claim_value=data['claim_value'],
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
