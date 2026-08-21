/**
 * Cadastrar Processo: formulário de cadastro de página inteira (POST /api/lawsuits).
 *
 * Contrato com o HTML (data-*):
 *   [data-lawsuit-form]         formulário; o submit é interceptado
 *   [data-lawsuit-form-fields]  <fieldset> que envolve os campos, nasce disabled
 *   [data-lawsuit-form-clear]   botão "Limpar"
 *   [data-lawsuit-submit]       botão de envio, nasce disabled
 *   [data-form-subject-matter] / [data-form-proceeding-stage] / [data-form-status] /
 *   [data-form-loss-probability]   selects preenchidos pela API
 *
 * Os campos e o botão nascem desabilitados e só liberam quando as quatro APIs
 * de apoio respondem: um formulário editável com seletor vazio convida a
 * pessoa a preencher os campos para descobrir no fim que não dá para escolher
 * a classificação.
 *
 * Depois de cadastrar, a tela continua aqui com o formulário limpo, em vez de
 * navegar para outro lugar — mesmo desenho de lancar_nip.js: lançamento tende
 * a ser feito um após o outro.
 */

import { API, PAGES } from "../utils/routes.js";
import { notifySuccess, notifyError } from "../utils/notyf.js";
import { populateSelect } from "../utils/nip_form.js";
import {
    clearFormErrors,
    setFieldError,
    validateForm,
    readFormPayload,
    setLoading,
    readJson,
} from "../utils/lawsuit_form.js";

let currentUser = null;

/* =========================================================================
   Carregamento
   ========================================================================= */

async function loadCurrentUser() {
    const response = await fetch(API.currentUser, { credentials: "same-origin" });

    if (response.status === 401) {
        window.location.replace(`${PAGES.login}?reason=session-expired`);
        return null;
    }

    if (!response.ok) throw new Error(`A API respondeu ${response.status}`);
    return response.json();
}

async function loadReferenceData() {
    const [subjectMattersResponse, proceedingStagesResponse, statusResponse, lossProbabilitiesResponse] = await Promise.all([
        fetch(API.subjectMatters, { credentials: "same-origin" }),
        fetch(API.proceedingStages, { credentials: "same-origin" }),
        fetch(API.lawsuitStatus, { credentials: "same-origin" }),
        fetch(API.lossProbabilities, { credentials: "same-origin" }),
    ]);

    if (!subjectMattersResponse.ok || !proceedingStagesResponse.ok || !statusResponse.ok || !lossProbabilitiesResponse.ok) {
        throw new Error("Falha ao carregar os dados de apoio do processo");
    }

    const subjectMatters = await subjectMattersResponse.json();
    const proceedingStages = await proceedingStagesResponse.json();
    const status = await statusResponse.json();
    const lossProbabilities = await lossProbabilitiesResponse.json();

    populateSelect(document.querySelector("[data-form-subject-matter]"), subjectMatters, "Selecione");
    populateSelect(document.querySelector("[data-form-proceeding-stage]"), proceedingStages, "Selecione");
    populateSelect(document.querySelector("[data-form-status]"), status, "Selecione");
    populateSelect(document.querySelector("[data-form-loss-probability]"), lossProbabilities, "Selecione");
}

/* =========================================================================
   Formulário
   ========================================================================= */

function resetForm() {
    const form = document.querySelector("[data-lawsuit-form]");
    if (!form) return;

    form.reset();
    clearFormErrors();
}

function initClear() {
    document.querySelector("[data-lawsuit-form-clear]")?.addEventListener("click", () => {
        resetForm();
        document.getElementById("lawsuit-case-number")?.focus();
    });
}

function initForm() {
    const form = document.querySelector("[data-lawsuit-form]");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearFormErrors();

        const problems = validateForm();
        if (problems.length) {
            problems.forEach(({ id, message }) => setFieldError(id, message));
            document.getElementById(problems[0].id)?.focus();
            return;
        }

        if (!currentUser) {
            notifyError("Não foi possível identificar o usuário logado. Atualize a página e tente de novo.");
            return;
        }

        const submit = form.querySelector("[data-lawsuit-submit]");
        setLoading(submit, true);

        // inserted_by vai no corpo porque é isso que LawsuitService.create espera
        // hoje (services/lawsuits_service.py) — mesmo arranjo do POST de NIP's.
        const payload = { ...readFormPayload(), inserted_by: currentUser.id };

        try {
            const response = await fetch(API.lawsuits, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(payload),
            });

            if (response.status === 201) {
                notifySuccess("Processo cadastrado com sucesso.");
                resetForm();
                document.getElementById("lawsuit-case-number")?.focus();
                return;
            }

            if (response.status === 401) {
                window.location.replace(`${PAGES.login}?reason=session-expired`);
                return;
            }

            const data = await readJson(response);
            notifyError(data?.message ?? "Não foi possível cadastrar o processo.");
            console.error(`A API respondeu ${response.status}`);
        } catch (error) {
            notifyError("Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.");
            console.error(error);
        } finally {
            setLoading(submit, false);
        }
    });
}

/* =========================================================================
   Ligação
   ========================================================================= */

async function loadPage() {
    try {
        const [user] = await Promise.all([loadCurrentUser(), loadReferenceData()]);
        if (!user) return; // já redirecionou para o login

        currentUser = user;

        const fields = document.querySelector("[data-lawsuit-form-fields]");
        if (fields) fields.disabled = false;

        const submit = document.querySelector("[data-lawsuit-submit]");
        if (submit) submit.disabled = false;
    } catch (error) {
        // Sem tabela para trocar por um card de erro: o formulário simplesmente
        // continua travado, e o toast diz por quê.
        notifyError("Não foi possível carregar as opções de classificação do processo. Atualize a página.");
        console.error(error);
    }
}

function init() {
    initClear();
    initForm();
    loadPage();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
