from models.nips_model import NipModel, Nip

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