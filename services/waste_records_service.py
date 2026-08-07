from models.waste_records_model import WasteRecordModel

class WasteRecordService:
    def get_all():
        try:
            waste_records = WasteRecordModel.get_all()

            return waste_records
        except Exception as e:
            raise Exception(str(e))

    def get_by_id(waste_record_id):
        try:
            waste_record = WasteRecordModel.get_by_id(waste_record_id)

            return waste_record
        except Exception as e:
            raise Exception(str(e))