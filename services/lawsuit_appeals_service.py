from models.lawsuit_appeals_model import LawsuitAppealModel, LawsuitAppeal

class LawsuitAppealService:
    def get_all(lawsuit_id):
        try:
            appeals = LawsuitAppealModel.get_all(lawsuit_id)

            return appeals
        except Exception as e:
            raise Exception(str(e))

    def create(data):
        try:
            # COLOCAR VALIDAÇÕES AQUI DEPOIS

            appeal = LawsuitAppeal(
                lawsuit_id=data['lawsuit_id'],
                appeal_date=data['appeal_date'],
                appeal_number=data['appeal_number'],
                appellant=data['appellant'],
                appellee=data['appellee'],
                claim_value=data['claim_value'],
                judging_body_id=data['judging_body_id'],
                status_id=data['status_id'],
                loss_probability_id=data['loss_probability_id'],
                inserted_by=data['inserted_by']
            )

            new_appeal = LawsuitAppealModel.create(appeal)

            return new_appeal
        except Exception as e:
            raise Exception(str(e))
