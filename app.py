import os
from flask import Flask, jsonify
from dotenv import load_dotenv
from waitress import serve
from configs import config_all

MAX_CONTENT_LENGTH = 21 * 1024 * 1024 # 21 MB (20 MB de arquivo + folga para os outros campos)

def create_app():
    load_dotenv()

    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

    config_all(app)
    # LIBERAR O cors()

    @app.errorhandler(413)
    def handle_request_entity_too_large(error):
        return jsonify({
            "message": "Os documentos anexados excedem o tamanho máximo permitido (20 MB no total). Reduza os arquivos e tente novamente."
        }), 413

    return app

if __name__ == '__main__':
    app = create_app()

    enviroment = os.getenv("FLASK_ENV", "development")

    if enviroment == "development":
        app.run(debug=True)
    else:
        print("Servidor Waitress iniciado com sucesso...")
        serve(app, host='0.0.0.0', port='5000', threads=8)        
