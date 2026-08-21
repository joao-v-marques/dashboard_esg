/**
 * Formatação de número, percentual e período em pt-BR.
 *
 * Um lugar só para a vírgula decimal e o ponto de milhar. O painel compara
 * números de setores diferentes lado a lado, e "1.284" com "1284" na mesma
 * tela é o tipo de detalhe que faz a diretoria desconfiar do dado inteiro.
 *
 * Convenções:
 *   - variação de um valor absoluto vai em %; variação de um valor que já é
 *     percentual vai em p.p. (ponto percentual) — somar 2% a 41% dá 43%, não
 *     41,82%, e o rótulo precisa dizer qual das duas contas foi feita.
 *   - ausência de dado é sempre o travessão, nunca zero: zero é um valor.
 */

/** O que aparece no lugar de um número que não existe. */
export const SEM_DADO = "—";

/**
 * Número com casas decimais fixas.
 * `decimais` é o mínimo E o máximo de propósito: uma coluna onde 41,18 fica
 * embaixo de 7 perde o alinhamento que o tabular-nums existe para dar.
 */
export function formatarNumero(valor, decimais = 0) {
    if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return SEM_DADO;

    return Number(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: decimais,
        maximumFractionDigits: decimais,
    });
}

/**
 * Valor em reais: "R$ 1.234,56".
 *
 * Sempre duas casas, mesmo em valor redondo — coluna de dinheiro com "1.000"
 * embaixo de "1.234,56" perde o alinhamento, e nota fiscal nenhuma escreve
 * "R$ 1.000".
 *
 * A API entrega claim_value como NÚMERO (ver money_to_float em utils/money.py):
 * o Number() aqui é só para o caso de a função ser chamada com o texto de um
 * campo de formulário.
 */
export function formatarMoeda(valor) {
    if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return SEM_DADO;

    return `R$ ${formatarNumero(Number(valor), 2)}`;
}

/** Contagem inteira (pessoas, ocorrências, registros). */
export function formatarInteiro(valor) {
    return formatarNumero(valor, 0);
}

/** Percentual com duas casas — o padrão que os endpoints já devolvem arredondado. */
export function formatarPercentual(valor, decimais = 2) {
    return formatarNumero(valor, decimais);
}

/**
 * Variação entre dois períodos, pronta para o card.
 *
 * Devolve null quando não há com o que comparar (primeiro período da base, ou
 * setor sem comparativo ligado) — o card então simplesmente não mostra a
 * linha, em vez de mostrar "0%" e sugerir estabilidade onde há ausência.
 *
 * @param {number} atual
 * @param {number} anterior
 * @param {object} opcoes
 * @param {"maior"|"menor"} opcoes.melhorQuando  qual direção é boa notícia.
 * @param {boolean} opcoes.pontosPercentuais     valor já é % (variação em p.p.).
 */
export function calcularVariacao(atual, anterior, { melhorQuando = "maior", pontosPercentuais = false } = {}) {
    if (atual === null || atual === undefined) return null;
    if (anterior === null || anterior === undefined) return null;

    const a = Number(atual);
    const b = Number(anterior);
    if (Number.isNaN(a) || Number.isNaN(b)) return null;

    // Base zero não tem variação percentual definida. Sem esta guarda o card
    // mostraria "Infinity%" no primeiro período com lançamento.
    if (!pontosPercentuais && b === 0) return null;

    const delta = pontosPercentuais ? a - b : (a - b) / Math.abs(b) * 100;
    const subiu = delta > 0;

    // A cor expressa a avaliação, não a direção: menos resíduo gerado é boa
    // notícia mesmo caindo (ver o comentário de .stat__delta--good).
    let avaliacao = "neutra";
    if (delta !== 0) {
        const bom = melhorQuando === "maior" ? subiu : !subiu;
        avaliacao = bom ? "boa" : "ruim";
    }

    const sinal = delta > 0 ? "+" : delta < 0 ? "−" : "";
    const unidade = pontosPercentuais ? " p.p." : "%";

    return {
        delta,
        avaliacao,
        direcao: delta >= 0 ? "up" : "down",
        texto: `${sinal}${formatarNumero(Math.abs(delta), 2)}${unidade}`,
    };
}

/** "01/01/2026" a partir de "2026-01-01", sem passar por Date (e sem fuso). */
export function formatarDataISO(iso) {
    if (!iso) return SEM_DADO;

    const [ano, mes, dia] = String(iso).split("-");
    if (!ano || !mes || !dia) return String(iso);

    return `${dia}/${mes}/${ano}`;
}

const MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Nome do mês por número 1–12 — usado no seletor de mês/ano. */
export function nomeDoMes(mes) {
    return MESES[Number(mes) - 1] ?? "";
}
