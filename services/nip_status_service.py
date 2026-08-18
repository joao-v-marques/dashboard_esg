from models.nip_status_model import NipStatusModel

class NipStatusService:
    def get_all():
        try:
            nip_status = NipStatusModel.get_all()

            return nip_status
        except Exception as e:
            raise Exception(str(e))
