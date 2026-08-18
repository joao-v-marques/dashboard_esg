from models.nip_nature_model import NipNatureModel

class NipNatureService:
    def get_all():
        try:
            nip_natures = NipNatureModel.get_all()

            return nip_natures
        except Exception as e:
            raise Exception(str(e))
