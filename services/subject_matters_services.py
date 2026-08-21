from models.subject_matters_model import SubjectMattersModel

class SubjectMattersService:
    def get_all():
        try:
            subject_matters = SubjectMattersModel.get_all()

            return subject_matters
        except Exception as e:
            raise Exception(str(e))