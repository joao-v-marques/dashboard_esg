"""
Cliente HTTP para a API do certificados_cooperados (outra aplicação, Java/Spring,
banco próprio). Autentica como o usuário técnico (COOPERADOS_API_USERNAME) e
reaproveita o JWT entre chamadas — evita logar de novo a cada KPI.

Duas regras seguram a aplicação de pé mesmo com o certificados_cooperados fora do
ar ou lento:

  1. Toda chamada de rede tem timeout explícito (REQUEST_TIMEOUT). Sem isso, uma
     chamada presa travaria uma thread do Waitress indefinidamente — com só 8
     threads (ver app.py), poucas chamadas penduradas bastam pra derrubar o
     resto da aplicação, não só a seção de Cooperados.
  2. Toda falha de rede/HTTP vira UpstreamError, nunca uma exceção não tratada.
     Quem chama (cooperados_dashboard_service.py) decide o que fazer; o
     controller nunca deixa isso virar um 500 genérico sem explicação.

Cache de token em variável de módulo: o processo do Flask é o único consumidor,
então não precisa de storage externo. _lock existe porque o Waitress serve com
várias threads (threads=8) e duas requisições podem achar o cache expirado ao
mesmo tempo.
"""

import os
import threading
import time

import jwt as pyjwt
import requests

from utils.exceptions import UpstreamError

_raw_base_url = os.getenv("COOPERADOS_API_BASE_URL")  # ex.: http://localhost:8080/certificados-cooperados
# Sem barra no final: montar path como f"{BASE_URL}/api/..." com uma barra
# sobrando dá URL duplamente barrada, que o Spring Security do outro app não
# reconhece como rota pública e redireciona pro login em vez de autenticar.
BASE_URL = _raw_base_url.rstrip("/") if _raw_base_url else _raw_base_url
USERNAME = os.getenv("COOPERADOS_API_USERNAME")
PASSWORD = os.getenv("COOPERADOS_API_PASSWORD")

# (timeout de conexão, timeout de leitura), em segundos.
REQUEST_TIMEOUT = (3, 5)

# Renova um pouco antes do exp real do JWT, pra nunca sair pra uma chamada com um
# token que expira no meio do caminho.
TOKEN_REFRESH_MARGIN_SECONDS = 60

# Fallback só usado se o token vier num formato que não dá pra decodificar (não
# deveria acontecer) — conservador o bastante pra não ficar reautenticando à toa.
FALLBACK_TOKEN_TTL_SECONDS = 3600

_lock = threading.Lock()
_cached_token = None
_cached_exp = 0.0


def _require_config():
    if not BASE_URL or not USERNAME or not PASSWORD:
        raise UpstreamError(
            "Integração com o certificados_cooperados não configurada "
            "(COOPERADOS_API_BASE_URL / COOPERADOS_API_USERNAME / COOPERADOS_API_PASSWORD)"
        )


def _login():
    """Autentica o usuário técnico e atualiza o cache. Chamado só dentro do _lock."""
    global _cached_token, _cached_exp

    _require_config()

    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/auth/login",
            json={"username": USERNAME, "password": PASSWORD},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise UpstreamError(f"Falha ao autenticar no certificados_cooperados: {e}") from e

    token = _parse_json(response, "login no certificados_cooperados").get("token")
    if not token:
        raise UpstreamError("Login no certificados_cooperados não retornou token")

    try:
        claims = pyjwt.decode(token, options={"verify_signature": False})
        exp = float(claims.get("exp") or (time.time() + FALLBACK_TOKEN_TTL_SECONDS))
    except pyjwt.PyJWTError:
        exp = time.time() + FALLBACK_TOKEN_TTL_SECONDS

    _cached_token = token
    _cached_exp = exp

    return token


def _get_token(force_refresh=False):
    with _lock:
        if not force_refresh and _cached_token and time.time() < (_cached_exp - TOKEN_REFRESH_MARGIN_SECONDS):
            return _cached_token

        return _login()


def get(path, params=None):
    """
    GET autenticado num endpoint do certificados_cooperados.

    path já vem com o /api/v1/... completo (sem o BASE_URL). Em caso de 401
    (token expirado por clock drift, ou revogado por algum motivo), reloga uma
    única vez e tenta de novo — sem loop, pra uma falha persistente não virar
    chamadas em cascata.
    """

    token = _get_token()
    response = _request(path, token, params)

    if response.status_code == 401:
        token = _get_token(force_refresh=True)
        response = _request(path, token, params)

    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        raise UpstreamError(f"{path} respondeu {response.status_code}") from e

    return _parse_json(response, path)


def _parse_json(response, context):
    try:
        return response.json()
    except ValueError as e:
        raise UpstreamError(f"Resposta inesperada (não é JSON) de {context}") from e


def _request(path, token, params):
    try:
        return requests.get(
            f"{BASE_URL}{path}",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=REQUEST_TIMEOUT,
        )
    except requests.exceptions.RequestException as e:
        raise UpstreamError(f"Falha ao chamar {path} no certificados_cooperados: {e}") from e
