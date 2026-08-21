from models.proceeding_stages_model import ProceedingStageModel

class ProceedingStageService:
    def get_all():
        try:
            proceeding_stages = ProceedingStageModel.get_all()

            return proceeding_stages
        except Exception as e:
            raise Exception(str(e))
