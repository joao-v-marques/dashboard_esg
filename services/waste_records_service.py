from models.waste_records_model import WasteRecordModel

class WasteRecordService:
    def get_all():
        try:
            waste_records = WasteRecordModel.get_all()

            return waste_records
        except Exception as e:
            raise Exception(str(e))