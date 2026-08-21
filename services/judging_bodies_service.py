from models.judging_bodies_model import JudgingBodyModel

class JudgingBodyService:
    def get_all():
        try:
            judging_bodies = JudgingBodyModel.get_all()

            return judging_bodies
        except Exception as e:
            raise Exception(str(e))
