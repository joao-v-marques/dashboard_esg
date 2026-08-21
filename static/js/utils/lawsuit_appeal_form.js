/**
 * Formulário de recurso, usado no modal "Gerar Recurso" de Consultar Processos.
 *
 * lawsuit_id e appeal_sequence não estão aqui: o primeiro vem da linha da
 * tabela que abriu o modal (ver startCreatingAppeal() em controle_processos.js),
 * o segundo é calculado pelo backend (LawsuitAppealModel.create). Nenhum dos
 * dois é um campo do formulário.
 *
 * claimValueDigits/formatCurrency/claimValueNumber e formatCaseNumber não
 * estão aqui: a máscara de moeda não é específica de recurso, e o formato do
 * número do processo também não — os dois já existem em utils/lawsuit_form.js
 * e são importados de lá por quem precisa, em vez de duplicados.
 *
 * Contrato com o HTML — ids usados por este módulo:
 *   appeal-date, appeal-number, appeal-appellant, appeal-appellee,
 *   appeal-claim-value, appeal-judging-body, appeal-status,
 *   appeal-loss-probability
 *   [data-error-for="<id>"]  mensagem de erro do campo de mesmo id
 */

import { claimValueNumber } from "./lawsuit_form.js";

const FIELDS = [
    { id: "appeal-date", empty: "Informe a data do recurso." },
    { id: "appeal-number", empty: "Informe o número do recurso." },
    { id: "appeal-appellant", empty: "Informe o recorrente." },
    { id: "appeal-appellee", empty: "Informe o recorrido." },
    { id: "appeal-claim-value", empty: "Informe o valor da causa." },
    { id: "appeal-judging-body", empty: "Selecione o órgão julgador." },
    { id: "appeal-status", empty: "Selecione o status." },
    { id: "appeal-loss-probability", empty: "Selecione a probabilidade de perda." },
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
 * Devolve a lista de problemas, na ordem dos campos na tela. Lista vazia
 * significa formulário válido.
 *
 * appeal_number não tem regra de formato — diferente do número do processo,
 * é texto livre (o recurso pode ter numeração própria do tribunal/turma
 * recursal que não segue o padrão CNJ completo).
 */
export function validateForm() {
    const problems = [];

    FIELDS.forEach(({ id, empty }) => {
        const input = document.getElementById(id);
        if (!input || input.value.trim() === "") {
            problems.push({ id, message: empty });
        }
    });

    return problems;
}

/**
 * Monta o corpo da requisição a partir do que está na tela.
 *
 * Não inclui lawsuit_id nem inserted_by: quem chama decide isso — ver
 * initForm() em js/pages/controle_processos.js.
 */
export function readFormPayload() {
    return {
        appeal_date: document.getElementById("appeal-date").value,
        appeal_number: document.getElementById("appeal-number").value.trim(),
        appellant: document.getElementById("appeal-appellant").value.trim(),
        appellee: document.getElementById("appeal-appellee").value.trim(),
        claim_value: claimValueNumber(document.getElementById("appeal-claim-value").value),
        judging_body_id: Number(document.getElementById("appeal-judging-body").value),
        status_id: Number(document.getElementById("appeal-status").value),
        loss_probability_id: Number(document.getElementById("appeal-loss-probability").value),
    };
}

export function resetForm() {
    const form = document.querySelector("[data-appeal-form]");
    if (!form) return;

    form.reset();
    clearFormErrors();
}

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
