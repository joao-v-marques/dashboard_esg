from database.connect_db import get_db_connection

class Lawsuit:
    # Os campos *_name não existem na tabela lawsuits: vêm dos JOINs de get_all,
    # do mesmo jeito que status_name e nature_name em Nip. Por isso são
    # opcionais — o INSERT não os usa.
    def __init__(self, lawsuit_date, case_number, plaintiff, defendant, claim_value, subject_matter_id, proceeding_stage_id, status_id, loss_probability_id, inserted_by=None, created_at=None, updated_at=None, updated_by=None, is_active=None, id=None, subject_matter_name=None, proceeding_stage_name=None, status_name=None, loss_probability_name=None, inserted_by_name=None, updated_by_name=None):
        self.id = id
        self.lawsuit_date = lawsuit_date
        self.case_number = case_number
        self.plaintiff = plaintiff
        self.defendant = defendant
        self.claim_value = claim_value
        self.subject_matter_id = subject_matter_id
        self.subject_matter_name = subject_matter_name
        self.proceeding_stage_id = proceeding_stage_id
        self.proceeding_stage_name = proceeding_stage_name
        self.status_id = status_id
        self.status_name = status_name
        self.loss_probability_id = loss_probability_id
        self.loss_probability_name = loss_probability_name
        self.inserted_by = inserted_by
        self.inserted_by_name = inserted_by_name
        self.created_at = created_at
        self.updated_at = updated_at
        self.updated_by = updated_by
        self.updated_by_name = updated_by_name
        self.is_active = is_active

    def to_dict(self):
        return {
            "id": self.id,
            "lawsuit_date": self.lawsuit_date,
            "case_number": self.case_number,
            "plaintiff": self.plaintiff,
            "defendant": self.defendant,
            "claim_value": self.claim_value,
            "subject_matter_id": self.subject_matter_id,
            "subject_matter_name": self.subject_matter_name,
            "proceeding_stage_id": self.proceeding_stage_id,
            "proceeding_stage_name": self.proceeding_stage_name,
            "status_id": self.status_id,
            "status_name": self.status_name,
            "loss_probability_id": self.loss_probability_id,
            "loss_probability_name": self.loss_probability_name,
            "inserted_by": self.inserted_by,
            "inserted_by_name": self.inserted_by_name,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "updated_by": self.updated_by,
            "updated_by_name": self.updated_by_name,
            "is_active": self.is_active
        }

class LawsuitModel:
    # GET ALL de todos os processos judiciais cadastrados na aplicação
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            # updated_by entra por LEFT JOIN, e não INNER: ele é nulo até o
            # processo ser editado pela primeira vez, e um INNER esconderia da
            # listagem justamente todo processo que nunca foi alterado.
            sql_query = """
                SELECT l.id, l.lawsuit_date, l.case_number, l.plaintiff, l.defendant, l.claim_value,
                       l.subject_matter_id, sm.name AS subject_matter_name,
                       l.proceeding_stage_id, ps.name AS proceeding_stage_name,
                       l.status_id, s.name AS status_name,
                       l.loss_probability_id, lp.name AS loss_probability_name,
                       l.inserted_by, ui.name AS inserted_by_name,
                       l.created_at, l.updated_at,
                       l.updated_by, uu.name AS updated_by_name,
                       l.is_active
                FROM lawsuits l
                INNER JOIN subject_matters sm ON sm.id = l.subject_matter_id
                INNER JOIN proceeding_stages ps ON ps.id = l.proceeding_stage_id
                INNER JOIN lawsuit_status s ON s.id = l.status_id
                INNER JOIN loss_probabilities lp ON lp.id = l.loss_probability_id
                INNER JOIN users ui ON ui.id = l.inserted_by
                LEFT JOIN users uu ON uu.id = l.updated_by
            """

            cursor.execute(sql_query)
            lawsuits_data = cursor.fetchall()

            lawsuits = [
                Lawsuit(**lawsuit)
                for lawsuit in lawsuits_data
            ]

            return lawsuits
        except Exception as e:
            raise Exception(str(e))
        finally:
            if conn:
                conn.close()
            if cursor:
                cursor.close()

    # GET by id
    @staticmethod
    def get_by_id(lawsuit_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM lawsuits
                WHERE id = %s
            """
            values = (lawsuit_id,)

            cursor.execute(sql_query, values)
            lawsuit_data = cursor.fetchone()

            # Sem o guard, id inexistente estoura em Lawsuit(**None) antes do
            # "if not lawsuit" do service conseguir devolver a mensagem certa.
            if not lawsuit_data:
                return None

            lawsuit = Lawsuit(**lawsuit_data)

            return lawsuit
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # POST de um novo processo judicial
    @staticmethod
    def create(lawsuit):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                INSERT INTO lawsuits (lawsuit_date, case_number, plaintiff, defendant, claim_value, subject_matter_id, proceeding_stage_id, status_id, loss_probability_id, inserted_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """
            values = (lawsuit.lawsuit_date, lawsuit.case_number, lawsuit.plaintiff, lawsuit.defendant, lawsuit.claim_value, lawsuit.subject_matter_id, lawsuit.proceeding_stage_id, lawsuit.status_id, lawsuit.loss_probability_id, lawsuit.inserted_by)

            cursor.execute(sql_query, values)
            conn.commit()
            new_id = cursor.fetchone()["id"]

            lawsuit.id = new_id
            return lawsuit
        except Exception as e:
            raise Exception(str(e))
        finally:
            if conn:
                conn.close()
            if cursor:
                cursor.close()

    # PUT de um processo judicial já existente
    @staticmethod
    def update(lawsuit, current_user_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE lawsuits
                SET
                    lawsuit_date = %s,
                    case_number = %s,
                    plaintiff = %s,
                    defendant = %s,
                    claim_value = %s,
                    subject_matter_id = %s,
                    proceeding_stage_id = %s,
                    status_id = %s,
                    loss_probability_id = %s,
                    updated_at = NOW(),
                    updated_by = %s
                WHERE id = %s
                RETURNING *
            """
            values = (
                lawsuit.lawsuit_date,
                lawsuit.case_number,
                lawsuit.plaintiff,
                lawsuit.defendant,
                lawsuit.claim_value,
                lawsuit.subject_matter_id,
                lawsuit.proceeding_stage_id,
                lawsuit.status_id,
                lawsuit.loss_probability_id,
                current_user_id,
                lawsuit.id
            )

            cursor.execute(sql_query, values)
            updated_lawsuit = cursor.fetchone()

            conn.commit()

            return Lawsuit(**updated_lawsuit)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if conn:
                conn.close()
            if cursor:
                cursor.close()
