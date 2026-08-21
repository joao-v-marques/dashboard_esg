/**
 * Formulário de cadastro de processo judicial ("Cadastrar Processo").
 *
 * Único hoje, mas separado de js/pages/lancar_processo.js pelo mesmo motivo de
 * utils/nip_form.js: quando a tela de consulta/edição existir, ela reusa esta
 * validação e esta leitura de campos em vez de duplicá-las.
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
 */

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
 * claim_value não tem regra própria além de "não vazio": o próprio
 * <input type="number" min="0"> já barra valor negativo ou não numérico antes
 * de chegar aqui.
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
        claim_value: Number(document.getElementById("lawsuit-claim-value").value),
        subject_matter_id: Number(document.getElementById("lawsuit-subject-matter").value),
        proceeding_stage_id: Number(document.getElementById("lawsuit-proceeding-stage").value),
        status_id: Number(document.getElementById("lawsuit-status").value),
        loss_probability_id: Number(document.getElementById("lawsuit-loss-probability").value),
    };
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
