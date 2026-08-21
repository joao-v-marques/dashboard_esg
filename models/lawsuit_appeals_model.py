from database.connect_db import get_db_connection
from utils.money import money_to_float

class LawsuitAppeal:
    # Os campos *_name não existem na tabela lawsuit_appeals: vêm dos JOINs de
    # get_all, do mesmo jeito que status_name e nature_name em Nip.
    def __init__(self, lawsuit_id, appeal_date, appeal_number, appellant, appellee, claim_value, judging_body_id, status_id, loss_probability_id, appeal_sequence=None, inserted_by=None, created_at=None, updated_at=None, updated_by=None, is_active=None, id=None, judging_body_name=None, status_name=None, loss_probability_name=None, inserted_by_name=None, updated_by_name=None):
        self.id = id
        self.lawsuit_id = lawsuit_id
        self.appeal_date = appeal_date
        self.appeal_number = appeal_number
        self.appellant = appellant
        self.appellee = appellee
        self.claim_value = claim_value
        self.judging_body_id = judging_body_id
        self.judging_body_name = judging_body_name
        self.status_id = status_id
        self.status_name = status_name
        self.loss_probability_id = loss_probability_id
        self.loss_probability_name = loss_probability_name
        self.appeal_sequence = appeal_sequence
        self.inserted_by = inserted_by
        self.inserted_by_name = inserted_by_name
        self.created_at = created_at
        self.updated_at = updated_at
        self.updated_by = updated_by
        self.updated_by_name = updated_by_name
        self.is_active = is_active

    # claim_value sai por money_to_float pelo mesmo motivo do to_dict de
    # lawsuits_model.py: Decimal viraria string no JSON e quebraria conta e
    # gráfico em silêncio. Ver utils/money.py.
    def to_dict(self):
        return {
            "id": self.id,
            "lawsuit_id": self.lawsuit_id,
            "appeal_date": self.appeal_date,
            "appeal_number": self.appeal_number,
            "appellant": self.appellant,
            "appellee": self.appellee,
            "claim_value": money_to_float(self.claim_value),
            "judging_body_id": self.judging_body_id,
            "judging_body_name": self.judging_body_name,
            "status_id": self.status_id,
            "status_name": self.status_name,
            "loss_probability_id": self.loss_probability_id,
            "loss_probability_name": self.loss_probability_name,
            "appeal_sequence": self.appeal_sequence,
            "inserted_by": self.inserted_by,
            "inserted_by_name": self.inserted_by_name,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "updated_by": self.updated_by,
            "updated_by_name": self.updated_by_name,
            "is_active": self.is_active
        }

class LawsuitAppealModel:
    # GET dos recursos de um processo, na ordem em que foram gerados.
    @staticmethod
    def get_all(lawsuit_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            # updated_by entra por LEFT JOIN, e não INNER: ele é nulo até o
            # recurso ser editado pela primeira vez — mesmo raciocínio do
            # updated_by em lawsuits_model.py.
            sql_query = """
                SELECT a.id, a.lawsuit_id, a.appeal_date, a.appeal_number, a.appellant, a.appellee, a.claim_value,
                       a.judging_body_id, jb.name AS judging_body_name,
                       a.status_id, s.name AS status_name,
                       a.loss_probability_id, lp.name AS loss_probability_name,
                       a.appeal_sequence,
                       a.inserted_by, ui.name AS inserted_by_name,
                       a.created_at, a.updated_at,
                       a.updated_by, uu.name AS updated_by_name,
                       a.is_active
                FROM lawsuit_appeals a
                INNER JOIN judging_bodies jb ON jb.id = a.judging_body_id
                INNER JOIN lawsuit_status s ON s.id = a.status_id
                INNER JOIN loss_probabilities lp ON lp.id = a.loss_probability_id
                INNER JOIN users ui ON ui.id = a.inserted_by
                LEFT JOIN users uu ON uu.id = a.updated_by
                WHERE a.lawsuit_id = %s
                ORDER BY a.appeal_sequence
            """
            values = (lawsuit_id,)

            cursor.execute(sql_query, values)
            appeals_data = cursor.fetchall()

            appeals = [
                LawsuitAppeal(**appeal)
                for appeal in appeals_data
            ]

            return appeals
        except Exception as e:
            raise Exception(str(e))
        finally:
            if conn:
                conn.close()
            if cursor:
                cursor.close()

    # POST de um novo recurso. appeal_sequence não vem do chamador: é a
    # próxima sequência livre para o processo (lawsuit_id), calculada aqui
    # mesmo — UNIQUE(lawsuit_id, appeal_sequence) barra uma colisão rara entre
    # dois recursos gerados ao mesmo tempo para o mesmo processo.
    @staticmethod
    def create(appeal):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            cursor.execute(
                "SELECT COALESCE(MAX(appeal_sequence), 0) + 1 AS next_sequence FROM lawsuit_appeals WHERE lawsuit_id = %s",
                (appeal.lawsuit_id,)
            )
            appeal.appeal_sequence = cursor.fetchone()["next_sequence"]

            sql_query = """
                INSERT INTO lawsuit_appeals (lawsuit_id, appeal_date, appeal_number, appellant, appellee, claim_value, judging_body_id, status_id, loss_probability_id, appeal_sequence, inserted_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """
            values = (appeal.lawsuit_id, appeal.appeal_date, appeal.appeal_number, appeal.appellant, appeal.appellee, appeal.claim_value, appeal.judging_body_id, appeal.status_id, appeal.loss_probability_id, appeal.appeal_sequence, appeal.inserted_by)

            cursor.execute(sql_query, values)
            conn.commit()
            new_id = cursor.fetchone()["id"]

            appeal.id = new_id
            return appeal
        except Exception as e:
            raise Exception(str(e))
        finally:
            if conn:
                conn.close()
            if cursor:
                cursor.close()
