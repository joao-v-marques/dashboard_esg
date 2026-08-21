from models.lawsuits_model import LawsuitModel, Lawsuit

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
