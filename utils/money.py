from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from utils.exceptions import ValidationError

# Duas casas: é o que a coluna guarda, e arredondar aqui evita a surpresa de
# mandar 1234.567 e o banco guardar 1234.57 sem ninguém ficar sabendo.
CENTS = Decimal("0.01")

# Teto de NUMERIC(15, 2) — 13 dígitos inteiros. Sem esta guarda, um valor maior
# vira "numeric field overflow" cru do Postgres devolvido como 500; com ela,
# vira 400 com recado em português.
MAX_VALUE = Decimal("9999999999999.99")


def to_decimal(value, label):
    """
    Aceita number e string numérica; recusa o resto.

    A string existe porque nem todo cliente da API é o formulário da aplicação
    (o formulário manda number — ver claimValueNumber() em
    utils/lawsuit_form.js). Vem em formato pt-BR ("1.234,56") ou com ponto
    decimal ("1234.56"): quando os dois separadores aparecem, o ponto é milhar;
    quando só a vírgula aparece, ela é a decimal.
    """
    # bool é subclasse de int em Python: sem esta linha, True viraria R$ 1,00.
    if isinstance(value, bool) or value is None:
        raise ValidationError(f"Informe o {label}")

    if isinstance(value, Decimal):
        return value

    if isinstance(value, int):
        return Decimal(value)

    if isinstance(value, float):
        # str() primeiro: Decimal(0.1) é 0.1000000000000000055511151231257827,
        # Decimal("0.1") é 0.1.
        return Decimal(str(value))

    if isinstance(value, str):
        text = value.strip()
        if not text:
            raise ValidationError(f"Informe o {label}")

        if "," in text:
            text = text.replace(".", "").replace(",", ".") if "." in text else text.replace(",", ".")

        try:
            return Decimal(text)
        except InvalidOperation:
            raise ValidationError(f"O {label} deve ser um valor numérico")

    raise ValidationError(f"O {label} deve ser um valor numérico")


def parse_money(value, label, minimum=None):
    """
    Devolve o valor como Decimal de 2 casas, pronto para ir ao banco.

    `minimum` é inclusivo: minimum=100 aceita exatamente 100. Negativo nunca
    passa — valor de causa não é dívida do autor.

    Levanta ValidationError (-> 400 no controller) em qualquer entrada que não
    seja um número utilizável, em vez de deixar o texto chegar na coluna
    NUMERIC e voltar como erro de banco em 500.
    """
    number = to_decimal(value, label)

    # NaN e Infinity chegam por JSON em clientes que aceitam JSON5/Python
    # (json.loads aceita NaN e Infinity por padrão), e passariam por Decimal
    # sem reclamar — is_finite() é o que os barra.
    if not number.is_finite():
        raise ValidationError(f"O {label} deve ser um valor numérico")

    number = number.quantize(CENTS, rounding=ROUND_HALF_UP)

    if number < 0:
        raise ValidationError(f"O {label} não pode ser negativo")

    if minimum is not None and number < Decimal(minimum):
        raise ValidationError(f"O {label} deve ser no mínimo R$ {format_money(minimum)}")

    if number > MAX_VALUE:
        raise ValidationError(f"O {label} excede o máximo permitido (R$ {format_money(MAX_VALUE)})")

    return number


def money_to_float(value):
    """
    Decimal -> float, para o JSON sair com número e não com string.

    None continua None: ausência de valor não é zero (mesma regra do
    waste_dashboard_service). Só é chamado na borda da resposta — nunca antes
    de uma conta.
    """
    if value is None:
        return None

    return float(value)


def format_money(value):
    """Decimal -> "1.234,56", para a mensagem de erro falar a língua da tela."""
    text = f"{Decimal(value).quantize(CENTS, rounding=ROUND_HALF_UP):,.2f}"
    return text.replace(",", "\x00").replace(".", ",").replace("\x00", ".")
