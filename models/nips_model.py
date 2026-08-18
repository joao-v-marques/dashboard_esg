from database.connect_db import get_db_connection

class Nip:
    def __init__(self, notification_date, demand_code, protocol_code, beneficiary_name, beneficiary_cpf, description, status_id, nature_id, inserted_by=None, created_at=None, updated_at=None, updated_by=None, id=None):
        self.id = id
        self.notification_date = notification_date
        self.demand_code = demand_code
        self.protocol_code = protocol_code
        self.beneficiary_name = beneficiary_name
        self.beneficiary_cpf = beneficiary_cpf
        self.description = description
        self.status_id = status_id
        self.nature_id = nature_id
        self.inserted_by = inserted_by
        self.created_at = created_at
        self.updated_at = updated_at
        self.updated_by = updated_by

    def to_dict(self):
        return {
            "id": self.id,
            "notification_date": self.notification_date,
            "demand_code": self.demand_code,
            "protocol_code": self.protocol_code,
            "beneficiary_name": self.beneficiary_name,
            "beneficiary_cpf": self.beneficiary_cpf,
            "description": self.description,
            "status_id": self.status_id,
            "nature_id": self.nature_id,
            "inserted_by": self.inserted_by,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "updated_by": self.updated_by
        }

class NipModel:
    # GET ALL de todas as NIP's cadastrados na aplicação
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM nips
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
                INSERT INTO nips (notification_date, demand_code, protocol_code, beneficiary_name, beneficiary_cpf, description, status_id, nature_id, inserted_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """
            values = (nip.notification_date, nip.demand_code, nip.protocol_code, nip.beneficiary_name, nip.beneficiary_cpf, nip.description, nip.status_id, nip.nature_id, nip.inserted_by)

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
                    notification_date = %s,
                    demand_code = %s,
                    protocol_code = %s,
                    beneficiary_name = %s,
                    beneficiary_cpf = %s,
                    description = %s,
                    status_id = %s,
                    nature_id = %s,
                    updated_at = NOW(),
                    updated_by = %s
                WHERE id = %s
                RETURNING *
            """
            values = (
                nip.notification_date,
                nip.demand_code,
                nip.protocol_code,
                nip.beneficiary_name,
                nip.beneficiary_cpf,
                nip.description,
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
