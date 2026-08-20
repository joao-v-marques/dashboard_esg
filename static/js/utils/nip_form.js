/**
 * Formulário de NIP, compartilhado pelas duas telas do grupo.
 *
 * "Lançar NIP" (formulário de página inteira) e "Controle de NIP's" (modal de
 * edição) têm exatamente os mesmos campos, com os mesmos ids — a NIP cadastrada
 * numa é a mesma editada na outra. Duplicar máscara de CPF, validação e leitura
 * dos campos nos dois arquivos faria as duas telas divergirem na primeira
 * mudança de regra; aqui é um lugar só.
 *
 * O que é de cada página fica lá: a tabela e os filtros em controle_nips.js, o
 * envio e o que acontece depois dele em cada uma. Este módulo não faz fetch.
 *
 * Contrato com o HTML — os ids abaixo existem nas duas telas:
 *   nip-number, nip-notification-date, nip-demand-code, nip-protocol-code,
 *   nip-beneficiary-name, nip-beneficiary-cpf, nip-nature, nip-status,
 *   nip-description
 *   [data-error-for="<id>"]  mensagem de erro do campo de mesmo id
 *   [data-cpf-input]         campo de CPF que recebe a máscara
 *   [data-nip-number-input]  campo do número da NIP que recebe a máscara
 */

/* =========================================================================
   CPF

   A tabela guarda CHAR(11) — só dígito. A máscara é enfeite de digitação e de
   leitura; tudo que sai daqui para a API passa por cpfDigits() antes.
   ========================================================================= */

export const cpfDigits = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 11);

/** 11 dígitos viram "000.000.000-00". Menos que isso é formatado do jeito que dá. */
export function formatCpf(value) {
    const digits = cpfDigits(value);

    return digits
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

/**
 * Liga a máscara no campo de CPF.
 *
 * Reescreve o valor a cada tecla. O cursor não é preservado de propósito: ele
 * vai para o fim, que é onde a digitação de um CPF acontece — a alternativa
 * (calcular o deslocamento a cada pontuação inserida) só se paga em campo que
 * as pessoas editam pelo meio, e este não é.
 */
export function initCpfMask(root = document) {
    root.querySelectorAll("[data-cpf-input]").forEach((input) => {
        input.addEventListener("input", () => {
            input.value = formatCpf(input.value);
        });
    });
}

/* =========================================================================
   Número da NIP

   Código de identificação da notificação, no padrão "000000/2026": seis
   dígitos de sequência, barra, ano com quatro dígitos. É digitado por quem
   lança — vem da ANS, não é gerado pela aplicação — e é UNIQUE na tabela.

   Como no CPF, a barra é enfeite de digitação: o usuário digita só os dez
   dígitos e a máscara põe a pontuação. Diferente do CPF, porém, o valor vai
   formatado para a API, porque é assim que a coluna guarda (VARCHAR(15)) e
   assim que a NIP é lida e conferida no papel.
   ========================================================================= */

export const nipNumberDigits = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 10);

/** Padrão aceito pela validação e escrito pela máscara. */
export const NIP_NUMBER_PATTERN = /^\d{6}\/\d{4}$/;

/** 10 dígitos viram "000000/2026". Menos que isso é formatado do jeito que dá. */
export function formatNipNumber(value) {
    const digits = nipNumberDigits(value);

    return digits.replace(/^(\d{6})(\d)/, "$1/$2");
}

/**
 * Liga a máscara no campo do número da NIP.
 *
 * Mesmo desenho do CPF, e pelo mesmo motivo: o cursor vai para o fim porque é
 * onde a digitação de um código sequencial acontece.
 */
export function initNipNumberMask(root = document) {
    root.querySelectorAll("[data-nip-number-input]").forEach((input) => {
        input.addEventListener("input", () => {
            input.value = formatNipNumber(input.value);
        });
    });
}

/* =========================================================================
   Selects de natureza e status
   ========================================================================= */

/** Preenche um <select> a partir de uma lista de {id, name}. */
export function populateSelect(select, items, placeholder) {
    if (!select) return;

    select.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder;
    select.appendChild(empty);

    items.forEach((item) => {
        const option = document.createElement("option");
        option.value = String(item.id);
        option.textContent = item.name;
        select.appendChild(option);
    });
}

/* =========================================================================
   Datas

   A API pode devolver notification_date como "2026-08-07" (correto) ou como
   uma string HTTP tipo "Fri, 07 Aug 2026 00:00:00 GMT" (o que to_dict()
   devolve hoje, ver models/nips_model.py) — o construtor de Date do JS
   entende as duas. O timeZone: "UTC" na formatação evita o erro clássico de
   exibir o dia anterior: sem ele, meia-noite UTC vira a noite anterior em
   fuso negativo.
   ========================================================================= */

export const toIsoDate = (value) => new Date(value).toISOString().slice(0, 10);

export const formatDate = (value) => new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });

/* =========================================================================
   Validação

   Mesmo desenho de js/pages/login.js e do modal de resíduos: campo inválido
   ganha aria-invalid e a mensagem aparece no .field__error de mesmo id.
   ========================================================================= */

const FIELDS = [
    { id: "nip-number", empty: "Informe o número da NIP." },
    { id: "nip-notification-date", empty: "Informe a data da notificação." },
    { id: "nip-demand-code", empty: "Informe o código da demanda." },
    { id: "nip-protocol-code", empty: "Informe o protocolo." },
    { id: "nip-beneficiary-name", empty: "Informe o nome do beneficiário." },
    { id: "nip-beneficiary-cpf", empty: "Informe o CPF do beneficiário." },
    { id: "nip-nature", empty: "Selecione a natureza." },
    { id: "nip-status", empty: "Selecione o status." },
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
 * Além do "não pode ficar em branco" de todo campo, dois têm formato próprio:
 * o CPF precisa dos 11 dígitos (a coluna é CHAR(11), e um CPF curto só
 * falharia lá no banco, com mensagem que não ajuda ninguém) e o número da NIP
 * precisa do padrão completo "000000/2026" — pela máscara ele nunca sai
 * malformado, mas sai pela metade se a pessoa parar de digitar no meio.
 *
 * O que esta validação não cobre é a unicidade do número: só o banco sabe se
 * ele já existe, e a resposta de erro do POST/PUT é que dá esse recado.
 */
export function validateForm() {
    const problems = [];

    FIELDS.forEach(({ id, empty }) => {
        const input = document.getElementById(id);
        if (!input || input.value.trim() === "") {
            problems.push({ id, message: empty });
            return;
        }

        if (id === "nip-beneficiary-cpf" && cpfDigits(input.value).length !== 11) {
            problems.push({ id, message: "O CPF precisa ter 11 dígitos." });
        }

        if (id === "nip-number" && !NIP_NUMBER_PATTERN.test(input.value.trim())) {
            problems.push({ id, message: "O número da NIP deve seguir o padrão 000000/2026." });
        }
    });

    return problems;
}

/* =========================================================================
   Leitura e escrita dos campos
   ========================================================================= */

/**
 * Monta o corpo da requisição a partir do que está na tela.
 *
 * Não inclui id, inserted_by nem nada de sessão: quem envia decide isso —
 * o POST manda inserted_by, o PUT manda o id. Ver o initForm() de cada página.
 */
export function readFormPayload() {
    return {
        nip_number: document.getElementById("nip-number").value.trim(),
        notification_date: document.getElementById("nip-notification-date").value,
        demand_code: document.getElementById("nip-demand-code").value.trim(),
        protocol_code: document.getElementById("nip-protocol-code").value.trim(),
        beneficiary_name: document.getElementById("nip-beneficiary-name").value.trim(),
        beneficiary_cpf: cpfDigits(document.getElementById("nip-beneficiary-cpf").value),
        description: document.getElementById("nip-description").value.trim(),
        status_id: Number(document.getElementById("nip-status").value),
        nature_id: Number(document.getElementById("nip-nature").value),
    };
}

/** Escreve uma NIP existente nos campos, para edição. */
export function fillForm(nip) {
    // Sem passar por formatNipNumber: o valor gravado já está no padrão (foi a
    // máscara que o escreveu), e reformatar um registro fora do padrão — se um
    // dia houver — o mutilaria em silêncio em vez de deixar a validação
    // apontar o problema na hora de salvar.
    document.getElementById("nip-number").value = nip.nip_number ?? "";
    document.getElementById("nip-notification-date").value = toIsoDate(nip.notification_date);
    document.getElementById("nip-demand-code").value = nip.demand_code ?? "";
    document.getElementById("nip-protocol-code").value = nip.protocol_code ?? "";
    document.getElementById("nip-beneficiary-name").value = nip.beneficiary_name ?? "";
    document.getElementById("nip-beneficiary-cpf").value = formatCpf(nip.beneficiary_cpf);
    document.getElementById("nip-nature").value = String(nip.nature_id);
    document.getElementById("nip-status").value = String(nip.status_id);
    document.getElementById("nip-description").value = nip.description ?? "";

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
