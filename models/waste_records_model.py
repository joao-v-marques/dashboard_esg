from psycopg.errors import UniqueViolation
from database.connect_db import get_db_connection
from utils.exceptions import ValidationError

class WasteRecord:
    def __init__(self, record_date, unit_id, waste_type_id, weight_kg, observations, inserted_by=None, created_at=None, updated_at=None, updated_by=None, id=None, unit_name=None, waste_type_name=None, inserted_by_name=None, updated_by_name=None):
        self.record_date = record_date
        self.unit_id = unit_id
        self.waste_type_id = waste_type_id
        self.weight_kg = weight_kg
        self.observations = observations
        self.inserted_by = inserted_by
        self.created_at = created_at
        self.updated_at = updated_at
        self.updated_by = updated_by
        self.id = id
        self.unit_name = unit_name
        self.waste_type_name = waste_type_name
        self.inserted_by_name = inserted_by_name
        self.updated_by_name = updated_by_name

    def to_dict(self):
        return {
            "id": self.id,
            "record_date": self.record_date,
            "unit_id": self.unit_id,
            "unit_name": self.unit_name,
            "waste_type_id": self.waste_type_id,
            "waste_type_name": self.waste_type_name,
            "weight_kg": self.weight_kg,
            "observations": self.observations,
            "inserted_by": self.inserted_by,
            "inserted_by_name": self.inserted_by_name,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "updated_by": self.updated_by,
            "updated_by_name": self.updated_by_name,
        }

    def created_to_dict(self):
        return {
            "id": self.id,
            "record_date": self.record_date,
            "unit_id": self.unit_id,
            "waste_type_id": self.waste_type_id,
            "weight_kg": self.weight_kg,
            "observations": self.observations,
            "inserted_by": self.inserted_by
        }

class WasteRecordModel:
    # GET de todos os Registros de Residuos cadastrados no sistema
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT wr.id, wr.record_date, wr.unit_id, u.name AS unit_name, wr.waste_type_id, wt.name AS waste_type_name, wr.weight_kg, wr.observations, wr.inserted_by, us.name AS inserted_by_name
                FROM waste_records wr
                INNER JOIN units u ON u.id = wr.unit_id
                INNER JOIN waste_types wt ON wt.id = wr.waste_type_id
                INNER JOIN users us ON us.id = wr.inserted_by
            """
            cursor.execute(sql_query)

            waste_records_data = cursor.fetchall()

            waste_records = [
                WasteRecord(**waste_record)
                for waste_record in waste_records_data
            ]

            return waste_records
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # GET de um Registro de Resíduo pelo ID
    @staticmethod
    def get_by_id(waste_record_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT wr.id, wr.record_date, wr.unit_id, u.name AS unit_name, wr.waste_type_id, wt.name AS waste_type_name, wr.weight_kg, wr.observations, wr.inserted_by, us.name AS inserted_by_name
                FROM waste_records wr
                INNER JOIN units u ON u.id = wr.unit_id
                INNER JOIN waste_types wt ON wt.id = wr.waste_type_id
                INNER JOIN users us ON us.id = wr.inserted_by
                WHERE wr.id = %s
            """
            values = (waste_record_id,)

            cursor.execute(sql_query, values)
            waste_record_data = cursor.fetchone()

            waste_record = WasteRecord(**waste_record_data)

            return waste_record
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # POST de um registro de Resíduo, realizado pelos colaboradores do compras
    @staticmethod
    def create(waste_record):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                INSERT INTO waste_records (record_date, unit_id, waste_type_id, weight_kg, observations, inserted_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id;
            """
            values = (waste_record.record_date, waste_record.unit_id, waste_record.waste_type_id, waste_record.weight_kg, waste_record.observations, waste_record.inserted_by)

            cursor.execute(sql_query, values)
            new_id = cursor.fetchone()["id"]

            conn.commit()

            waste_record.id = new_id
            return waste_record
        # Adicionado tratativa para erro de UniqueViolation, que é usado na tabela de residuos, antes estava indo tudo direto para o cliente
        except UniqueViolation:
            raise ValidationError(
                "Já existe um lançamento para esta data, unidade e tipo de resíduo. "
                "Edite o lançamento existente em vez de criar um novo."
            )
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # PUT de um cadastro já realizado, para corrigir erros caso já tenha lançado
    @staticmethod
    def update(waste_record, current_user_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE waste_records
                SET
                    record_date = %s,
                    unit_id = %s,
                    waste_type_id = %s,
                    weight_kg = %s,
                    observations = %s,
                    updated_at = NOW(),
                    updated_by = %s
                WHERE id = %s
                RETURNING *
            """
            values = (waste_record.record_date, waste_record.unit_id, waste_record.waste_type_id, waste_record.weight_kg, waste_record.observations, current_user_id, waste_record.id)

            cursor.execute(sql_query, values)
            updated_waste_record = cursor.fetchone()

            conn.commit()

            return WasteRecord(**updated_waste_record)
        except UniqueViolation:
            raise ValidationError(
                "Já existe um lançamento para esta data, unidade e tipo de resíduo. "
                "Altere as informações da edição e tente novamente."
            )
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()