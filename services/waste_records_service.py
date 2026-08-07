from models.waste_records_model import WasteRecordModel, WasteRecord
from utils.exceptions import ValidationError

# Esta é a data que começamos a fazer a reciclagem na SEDE, um pouco retroativo para evitar erros, vamos definir ela para evitar lançamentos antes de 07/26
MIN_RECORD_DATE = "2026-07-01"

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

    def create(data):
        try:
            if not isinstance(data, dict):
                raise ValidationError("Envie um corpo JSON com os dados do lançamento")

            record_date = data.get('record_date')

            if not record_date or record_date < MIN_RECORD_DATE:
                raise ValidationError("Lançamentos só são permitidos a partir de 01/07/2026")

            waste_record = WasteRecord(
                record_date=record_date,
                unit_id=data['unit_id'],
                waste_type_id=data['waste_type_id'],
                weight_kg=data['weight_kg'],
                observations=data['observations'],
                inserted_by=data['inserted_by']
            )

            new_waste_record = WasteRecordModel.create(waste_record)
            return new_waste_record
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))
