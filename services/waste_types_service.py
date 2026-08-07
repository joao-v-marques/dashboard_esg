from models.waste_types_model import WasteTypeModel

class WasteTypeService:
    def get_all():
        try:
            waste_types = WasteTypeModel.get_all()

            return waste_types
        except Exception as e:
            raise Exception(str(e))