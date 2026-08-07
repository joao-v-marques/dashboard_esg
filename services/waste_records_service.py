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

    def update(data):
        try:
            if not isinstance(data, dict):
                raise ValidationError("Envie um corpo JSON com os dados do lançamento")

            required_fields = {
                'id': "O identificador do lançamento é obrigatório",
                'record_date': "A data do lançamento é obrigatória",
                'unit_id': "A unidade é obrigatória",
                'waste_type_id': "O tipo de resíduo é obrigatório",
                'weight_kg': "O peso é obrigatório",
                'observations': "As observações são obrigatórias",
                'updated_at': "A data de atualização é obrigatória",
                'updated_by': "O usuário responsável pela atualização é obrigatório",
            }

            for field, message in required_fields.items():
                if data.get(field) is None:
                    raise ValidationError(message)

            waste_record = WasteRecordModel.get_by_id(data['id'])

            if not waste_record:
                raise ValueError("Não foi encontrado registro de resíduos com esse ID")

            if not isinstance(data, dict):
                raise ValidationError("Envie um corpo JSON com os dados do lançamento")

            record_date = data.get('record_date')
            
            if not record_date or record_date < MIN_RECORD_DATE:
                raise ValidationError("Lançamentos só são permitidos a partir de 01/07/2026")

            new_waste_record = WasteRecord(
                id=data['id'],
                record_date=data['record_date'],
                unit_id=data['unit_id'],
                waste_type_id=data['waste_type_id'],
                weight_kg=data['weight_kg'],
                observations=data['observations'],
                updated_at=data['updated_at'],
                updated_by=data['updated_by']
            )

            new_waste_record = WasteRecordModel.update(new_waste_record)

            return new_waste_record
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))