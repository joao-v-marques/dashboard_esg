from models.loss_probabilities_model import LossProbabilityModel

class LossProbabilityService:
    def get_all():
        try:
            loss_probabilities = LossProbabilityModel.get_all()

            return loss_probabilities
        except Exception as e:
            raise Exception(str(e))
