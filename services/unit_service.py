from models.units_model import UnitModel

class UnitService:
    def get_all():
        try:
            units = UnitModel.get_all()

            return units
        except Exception as e:
            raise Exception(str(e)) 