import psycopg, os
from psycopg.rows import dict_row

def get_db_connection():
    try:
        conn = psycopg.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            row_factory=dict_row
        )

        cursor = conn.cursor()

        return conn, cursor
    except Exception as e:
        raise Exception(f"Erro ao conectar com o PostgreSQL: {str(e)}")