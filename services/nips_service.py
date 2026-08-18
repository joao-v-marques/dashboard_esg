from models.nips_model import NipModel

class NipService:
    def get_all():
        try:
            nips = NipModel.get_all()

            return nips
        except Exception as e:
            raise Exception(str(e))