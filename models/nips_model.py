from database.connect_db import get_db_connection

class Nip:
    # Os campos *_name não existem na tabela nips: vêm dos JOINs de get_all/
    # get_by_id, do mesmo jeito que unit_name e inserted_by_name em
    # WasteRecord. Por isso são opcionais — o UPDATE usa RETURNING *, que
    # devolve só as colunas da própria tabela, e o objeto continua válido.
    def __init__(self, notification_date, demand_code, protocol_code, beneficiary_name, beneficiary_cpf, description, status_id, nature_id, nip_number, response_description, inserted_by=None, created_at=None, updated_at=None, updated_by=None, id=None, status_name=None, nature_name=None, inserted_by_name=None, updated_by_name=None):
        self.id = id
        self.nip_number = nip_number
        self.notification_date = notification_date
        self.demand_code = demand_code
        self.protocol_code = protocol_code
        self.beneficiary_name = beneficiary_name
        self.beneficiary_cpf = beneficiary_cpf
        self.description = description
        self.response_description = response_description
        self.status_id = status_id
        self.status_name = status_name
        self.nature_id = nature_id
        self.nature_name = nature_name
        self.inserted_by = inserted_by
        self.inserted_by_name = inserted_by_name
        self.created_at = created_at
        self.updated_at = updated_at
        self.updated_by = updated_by
        self.updated_by_name = updated_by_name

    def to_dict(self):
        return {
            "id": self.id,
            "nip_number": self.nip_number,
            "notification_date": self.notification_date,
            "demand_code": self.demand_code,
            "protocol_code": self.protocol_code,
            "beneficiary_name": self.beneficiary_name,
            "beneficiary_cpf": self.beneficiary_cpf,
            "description": self.description,
            "response_description": self.response_description,
            "status_id": self.status_id,
            "status_name": self.status_name,
            "nature_id": self.nature_id,
            "nature_name": self.nature_name,
            "inserted_by": self.inserted_by,
            "inserted_by_name": self.inserted_by_name,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "updated_by": self.updated_by,
            "updated_by_name": self.updated_by_name
        }

class NipModel:
    # GET ALL de todas as NIP's cadastrados na aplicação
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            # updated_by entra por LEFT JOIN, e não INNER: ele é nulo até a NIP
            # ser editada pela primeira vez, e um INNER esconderia da listagem
            # justamente toda NIP que nunca foi alterada.
            sql_query = """
                SELECT n.id, n.nip_number, n.notification_date, n.demand_code, n.protocol_code, n.response_description,
                       n.beneficiary_name, n.beneficiary_cpf, n.description,
                       n.status_id, s.name AS status_name,
                       n.nature_id, nt.name AS nature_name,
                       n.inserted_by, ui.name AS inserted_by_name,
                       n.created_at, n.updated_at,
                       n.updated_by, uu.name AS updated_by_name
                FROM nips n
                INNER JOIN nip_status s ON s.id = n.status_id
                INNER JOIN nip_natures nt ON nt.id = n.nature_id
                INNER JOIN users ui ON ui.id = n.inserted_by
                LEFT JOIN users uu ON uu.id = n.updated_by
            """

            cursor.execute(sql_query)
            nips_data = cursor.fetchall()

            nips = [
                Nip(**nip)
                for nip in nips_data
            ]

            return nips
        except Exception as e:
            raise Exception(str(e))
        finally:
            if conn:
                conn.close()
            if cursor:
                cursor.close()

    # GET by id
    @staticmethod
    def get_by_id(nip_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM nips
                WHERE id = %s
            """
            values = (nip_id,)

            cursor.execute(sql_query, values)
            nip_data = cursor.fetchone()

            # Sem o guard, id inexistente estoura em Nip(**None) antes do
            # "if not nip" do service conseguir devolver a mensagem certa.
            if not nip_data:
                return None

            nip = Nip(**nip_data)

            return nip
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # POST de uma nova NIP
    @staticmethod
    def create(nip):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                INSERT INTO nips (nip_number, notification_date, demand_code, protocol_code, beneficiary_name, beneficiary_cpf, description, status_id, nature_id, inserted_by, response_description)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """
            values = (nip.nip_number, nip.notification_date, nip.demand_code, nip.protocol_code, nip.beneficiary_name, nip.beneficiary_cpf, nip.description, nip.status_id, nip.nature_id, nip.inserted_by, nip.response_description)

            cursor.execute(sql_query, values)
            conn.commit()
            new_id = cursor.fetchone()["id"]

            nip.id = new_id
            return nip
        except Exception as e:
            raise Exception(str(e))
        finally:
            if conn:
                conn.close()
            if cursor:
                cursor.close()

    # PUT de uma NIP já existente
    @staticmethod
    def update(nip, current_user_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE nips
                SET
                    nip_number = %s,
                    notification_date = %s,
                    demand_code = %s,
                    protocol_code = %s,
                    beneficiary_name = %s,
                    beneficiary_cpf = %s,
                    description = %s,
                    response_description = %s,
                    status_id = %s,
                    nature_id = %s,
                    updated_at = NOW(),
                    updated_by = %s
                WHERE id = %s
                RETURNING *
            """
            values = (
                nip.nip_number,
                nip.notification_date,
                nip.demand_code,
                nip.protocol_code,
                nip.beneficiary_name,
                nip.beneficiary_cpf,
                nip.description,
                nip.response_description,
                nip.status_id,
                nip.nature_id,
                current_user_id,
                nip.id
            )

            cursor.execute(sql_query, values)
            updated_nip = cursor.fetchone()

            conn.commit()

            return Nip(**updated_nip)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if conn:
                conn.close()
            if cursor:
                cursor.close()
