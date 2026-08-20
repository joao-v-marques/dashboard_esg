from models.nips_model import NipModel, Nip
from utils.exceptions import ValidationError

class NipService:
    def get_all():
        try:
            nips = NipModel.get_all()

            return nips
        except Exception as e:
            raise Exception(str(e))

    def create(data):
        try:
            # COLOCAR VALIDAÇÕES AQUI DEPOIS

            nip = Nip(
                nip_number=data['nip_number'],
                notification_date=data['notification_date'],
                demand_code=data['demand_code'],
                protocol_code=data['protocol_code'],
                beneficiary_name=data['beneficiary_name'],
                beneficiary_cpf=data['beneficiary_cpf'],
                description=data['description'],
                status_id=data['status_id'],
                nature_id=data['nature_id'],
                inserted_by=data['inserted_by']
            )

            new_nip = NipModel.create(nip)

            return new_nip
        except Exception as e:
            raise Exception(str(e))

    def update(data, current_user_id):
        try:
            nip = NipModel.get_by_id(data['id'])

            if not nip:
                raise ValueError("Não foi encontrado registro de NIP com esse ID")

            if not isinstance(data, dict):
                raise ValidationError("Envie um corpo JSON com os dados do lançamento")

            # COLOCAR AS VALIDAÇÕES AQUI DEPOIS

            new_nip = Nip(
                id=data['id'],
                nip_number=data['nip_number'],
                notification_date=data['notification_date'],
                demand_code=data['demand_code'],
                protocol_code=data['protocol_code'],
                beneficiary_name=data['beneficiary_name'],
                beneficiary_cpf=data['beneficiary_cpf'],
                description=data['description'],
                status_id=data['status_id'],
                nature_id=data['nature_id'],
            )

            returned_nip = NipModel.update(new_nip, current_user_id)

            return returned_nip
        except ValidationError:
            raise
        except Exception as e:
            raise Exception(str(e))