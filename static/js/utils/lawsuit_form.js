/**
 * Formulário de processo judicial — mesmos campos em "Cadastrar Processo"
 * (js/pages/lancar_processo.js) e no modal de editar de "Consultar Processos"
 * (js/pages/controle_processos.js), com os mesmos ids nas duas telas: o
 * processo editado ali é a mesma entidade cadastrada aqui. Igual à relação
 * entre utils/nip_form.js e as duas telas de NIP's.
 *
 * populateSelect() não está aqui: é genérica (recebe {id, name}) e já existe em
 * utils/nip_form.js — importar de lá em vez de duplicar.
 *
 * Contrato com o HTML — ids usados por este módulo:
 *   lawsuit-date, lawsuit-case-number, lawsuit-plaintiff, lawsuit-defendant,
 *   lawsuit-claim-value, lawsuit-subject-matter, lawsuit-proceeding-stage,
 *   lawsuit-status, lawsuit-loss-probability
 *   [data-error-for="<id>"]        mensagem de erro do campo de mesmo id
 *   [data-case-number-input]       campo do número do processo (máscara abaixo)
 *   [data-currency-input]          campo do valor da causa (máscara abaixo)
 */

import { toIsoDate } from "./nip_form.js";

/* =========================================================================
   Número do processo

   Padrão CNJ (Resolução 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO — sete dígitos de
   sequência, dígito verificador, ano, órgão, tribunal e origem, sempre com 20
   dígitos ao todo. A pontuação é só enfeite de digitação — é assim que o
   processo é conferido no papel — mas é padrão da aplicação guardar apenas
   dígitos em todo campo numérico com máscara (mesmo raciocínio do CPF em
   utils/nip_form.js): o que sai daqui para a API já passa por
   caseNumberDigits() antes, em readFormPayload().
   ========================================================================= */

export const caseNumberDigits = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 20);

/** Padrão aceito pela validação e escrito pela máscara. */
export const CASE_NUMBER_PATTERN = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

/** 20 dígitos viram "0000000-00.0000.0.00.0000". Menos que isso é formatado do jeito que dá. */
export function formatCaseNumber(value) {
    const digits = caseNumberDigits(value);

    return digits
        .replace(/^(\d{7})(\d)/, "$1-$2")
        .replace(/^(\d{7})-(\d{2})(\d)/, "$1-$2.$3")
        .replace(/^(\d{7})-(\d{2})\.(\d{4})(\d)/, "$1-$2.$3.$4")
        .replace(/^(\d{7})-(\d{2})\.(\d{4})\.(\d)(\d)/, "$1-$2.$3.$4.$5")
        .replace(/^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})(\d)/, "$1-$2.$3.$4.$5.$6");
}

/**
 * Liga a máscara no campo do número do processo.
 *
 * Mesmo desenho do CPF/número da NIP: o cursor vai para o fim a cada tecla,
 * porque é onde a digitação de um código sequencial acontece.
 */
export function initCaseNumberMask(root = document) {
    root.querySelectorAll("[data-case-number-input]").forEach((input) => {
        input.addEventListener("input", () => {
            input.value = formatCaseNumber(input.value);
        });
    });
}

/* =========================================================================
   Valor da causa

   O campo é type="text", e não type="number": um <input type="number"> não
   aceita ponto de milhar nem vírgula decimal (o navegador só entende ponto),
   então formatar como "1.234,56" exige controlar o valor como texto, do
   mesmo jeito que o número do processo acima.

   Os dois últimos dígitos digitados são sempre os centavos — é assim que
   calculadora e caixa eletrônico tratam entrada de valor em dinheiro, e evita
   o usuário ter que digitar a vírgula. O corte em 15 dígitos acompanha
   NUMERIC(15, 2) da coluna claim_value (13 inteiros + 2 decimais).

   Como no número do processo, só o dígito importa: o que sai daqui para a API
   é number (ponto decimal), nunca o texto com separador de milhar — ver
   claimValueNumber() em readFormPayload().
   ========================================================================= */

export const claimValueDigits = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 15);

/** Dígitos viram "1.234,56": os dois últimos são centavos, o resto ganha separador de milhar. */
export function formatCurrency(value) {
    const digits = claimValueDigits(value);
    if (!digits) return "";

    const padded = digits.padStart(3, "0");
    const cents = padded.slice(-2);
    const integer = padded.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
    const integerWithSeparators = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    return `${integerWithSeparators},${cents}`;
}

/** Liga a máscara no campo de valor. Mesmo desenho das demais: cursor sempre no fim. */
export function initCurrencyMask(root = document) {
    root.querySelectorAll("[data-currency-input]").forEach((input) => {
        input.addEventListener("input", () => {
            input.value = formatCurrency(input.value);
        });
    });
}

/** Valor mascarado ("1.234,56") de volta a number (1234.56), pronto para a API. */
export function claimValueNumber(value) {
    const digits = claimValueDigits(value);
    return digits ? Number(digits) / 100 : 0;
}

/* =========================================================================
   Validação

   Mesmo desenho de utils/nip_form.js: campo inválido ganha aria-invalid e a
   mensagem aparece no .field__error de mesmo id.
   ========================================================================= */

const FIELDS = [
    { id: "lawsuit-date", empty: "Informe a data do processo." },
    { id: "lawsuit-case-number", empty: "Informe o número do processo." },
    { id: "lawsuit-plaintiff", empty: "Informe o autor (requerente)." },
    { id: "lawsuit-defendant", empty: "Informe o réu (requerido)." },
    { id: "lawsuit-claim-value", empty: "Informe o valor da causa." },
    { id: "lawsuit-subject-matter", empty: "Selecione o objeto/assunto." },
    { id: "lawsuit-proceeding-stage", empty: "Selecione o estágio processual." },
    { id: "lawsuit-status", empty: "Selecione o status." },
    { id: "lawsuit-loss-probability", empty: "Selecione a probabilidade de perda." },
];

export function setFieldError(id, message) {
    const input = document.getElementById(id);
    const target = document.querySelector(`[data-error-for="${id}"]`);

    if (input) input.setAttribute("aria-invalid", "true");
    if (target) {
        target.textContent = message;
        target.hidden = false;
    }
}

export function clearFormErrors() {
    FIELDS.forEach(({ id }) => {
        const input = document.getElementById(id);
        const target = document.querySelector(`[data-error-for="${id}"]`);

        if (input) input.removeAttribute("aria-invalid");
        if (target) {
            target.hidden = true;
            target.textContent = "";
        }
    });
}

/**
 * Devolve a lista de problemas, na ordem dos campos na tela — quem chama
 * aponta o foco para o primeiro. Lista vazia significa formulário válido.
 *
 * claim_value não tem regra própria além de "não vazio": a máscara em
 * initCurrencyMask() já garante que o que está no campo é sempre dígito, e um
 * valor incompleto ("0,05" digitando "5") ainda é um valor válido — só falta
 * mesmo se ninguém digitar nada.
 *
 * O número do processo precisa do padrão CNJ completo — pela máscara ele
 * nunca sai malformado, mas sai pela metade se a pessoa parar de digitar no
 * meio (mesmo raciocínio do número da NIP em utils/nip_form.js). O que esta
 * validação não cobre é a unicidade: só o banco sabe se o processo já existe,
 * e a resposta de erro do POST é que dá esse recado.
 */
export function validateForm() {
    const problems = [];

    FIELDS.forEach(({ id, empty }) => {
        const input = document.getElementById(id);
        if (!input || input.value.trim() === "") {
            problems.push({ id, message: empty });
            return;
        }

        if (id === "lawsuit-case-number" && !CASE_NUMBER_PATTERN.test(input.value.trim())) {
            problems.push({ id, message: "O número do processo deve seguir o padrão 0000000-00.0000.0.00.0000." });
        }
    });

    return problems;
}

/* =========================================================================
   Leitura dos campos
   ========================================================================= */

/**
 * Monta o corpo da requisição a partir do que está na tela.
 *
 * Não inclui inserted_by: quem envia decide isso — ver initForm() em
 * js/pages/lancar_processo.js, mesmo arranjo do POST de NIP's.
 */
export function readFormPayload() {
    return {
        lawsuit_date: document.getElementById("lawsuit-date").value,
        case_number: caseNumberDigits(document.getElementById("lawsuit-case-number").value),
        plaintiff: document.getElementById("lawsuit-plaintiff").value.trim(),
        defendant: document.getElementById("lawsuit-defendant").value.trim(),
        claim_value: claimValueNumber(document.getElementById("lawsuit-claim-value").value),
        subject_matter_id: Number(document.getElementById("lawsuit-subject-matter").value),
        proceeding_stage_id: Number(document.getElementById("lawsuit-proceeding-stage").value),
        status_id: Number(document.getElementById("lawsuit-status").value),
        loss_probability_id: Number(document.getElementById("lawsuit-loss-probability").value),
    };
}

/**
 * Escreve um processo existente nos campos, para edição.
 *
 * case_number e claim_value passam pelas próprias máscaras (formatCaseNumber,
 * formatCurrency) para a tela mostrar exatamente o que a digitação mostraria
 * — a coluna guarda só dígito nos dois casos. claim_value chega como Decimal
 * (string, ex. "1234.56"); Math.round(... * 100) recupera os "centavos" que
 * formatCurrency espera receber como dígitos.
 */
export function fillForm(lawsuit) {
    document.getElementById("lawsuit-case-number").value = formatCaseNumber(lawsuit.case_number);
    document.getElementById("lawsuit-date").value = toIsoDate(lawsuit.lawsuit_date);
    document.getElementById("lawsuit-plaintiff").value = lawsuit.plaintiff ?? "";
    document.getElementById("lawsuit-defendant").value = lawsuit.defendant ?? "";
    document.getElementById("lawsuit-claim-value").value = formatCurrency(String(Math.round(Number(lawsuit.claim_value) * 100)));
    document.getElementById("lawsuit-subject-matter").value = String(lawsuit.subject_matter_id);
    document.getElementById("lawsuit-proceeding-stage").value = String(lawsuit.proceeding_stage_id);
    document.getElementById("lawsuit-status").value = String(lawsuit.status_id);
    document.getElementById("lawsuit-loss-probability").value = String(lawsuit.loss_probability_id);

    clearFormErrors();
}

/* =========================================================================
   Utilidades de envio
   ========================================================================= */

export function setLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.classList.toggle("is-loading", loading);
}

/** Resposta de erro pode não trazer JSON — o toast cai no texto padrão. */
export async function readJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}
