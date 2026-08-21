from models.lawsuit_status_model import LawsuitStatusModel

class LawsuitStatusService:
    def get_all():
        try:
            lawsuit_status = LawsuitStatusModel.get_all()

            return lawsuit_status
        except Exception as e:
            raise Exception(str(e))
