"""
Erros de negócio que o controller traduz em status HTTP.

Existem para separar duas coisas que antes chegavam iguais no controller e
saíam as duas como 401: pedido mal formado e credencial que não confere.
Herdam de ValueError para não quebrar quem já captura ValueError.
"""

class ValidationError(ValueError):
    """Faltou campo ou o corpo veio errado -> 400."""

class AuthError(ValueError):
    """Credencial inválida ou sessão que não vale mais -> 401."""

class UpstreamError(Exception):
    """Uma API externa (ex.: certificados_cooperados) não respondeu ou respondeu com erro -> 502."""

class NotFoundError(Exception):
    """O recurso pedido pelo id não existe -> 404."""
