/**
 * Consultar Processos: tabela só leitura dos processos judiciais cadastrados,
 * com um modal de "Gerar Recurso" por linha (POST /api/lawsuit-appeals).
 *
 * Contrato com o HTML (data-*):
 *   [data-new-lawsuit-link]   link para "Cadastrar Processo"; o href é escrito aqui
 *   [data-lawsuits-loading]   esqueleto; estado inicial
 *   [data-lawsuits-content]   card com a tabela; nasce hidden
 *   [data-lawsuits-error]     recado de falha; nasce hidden
 *   [data-lawsuits-body]      <tbody> onde as linhas são escritas
 *   [data-lawsuits-empty-row] linha fixa de "nenhum resultado"; só o texto e o
 *                             hidden dela mudam — nunca é removida do DOM
 *     [data-lawsuits-empty-message]
 *   [data-appeal-modal]       <dialog> do formulário de recurso
 *     [data-appeal-modal-close]     fecha (botão X e Cancelar)
 *     [data-appeal-modal-subtitle]  texto com o número do processo da linha
 *     [data-appeal-list-loading]    "Carregando..." da lista; estado inicial
 *     [data-appeal-list]            <ul> dos recursos já registrados
 *     [data-appeal-list-empty]      recado de "nenhum recurso ainda"
 *     [data-appeal-form]            formulário; o submit é interceptado
 *     [data-appeal-submit]          botão de enviar
 *   [data-form-judging-body] / [data-form-status] / [data-form-loss-probability]
 *                              selects do modal, preenchidos pela API
 *
 * A tela não cria nem edita processo — isso é "Cadastrar Processo", a outra
 * tela do grupo. O modal aqui lista os recursos do processo e cria mais um;
 * currentLawsuitId nunca é null enquanto o modal está aberto — quem abre é
 * sempre o botão "Gerar Recurso" de uma linha (ver startCreatingAppeal()).
 * Enviar o formulário não fecha o modal: a lista recarrega e os campos
 * limpam no lugar, para dar para gerar vários recursos seguidos.
 */

import { API, PAGES } from "../utils/routes.js";
import { notifySuccess, notifyError } from "../utils/notyf.js";
import { populateSelect, toIsoDate } from "../utils/nip_form.js";
import { formatCaseNumber, initCurrencyMask } from "../utils/lawsuit_form.js";
import { formatarNumero } from "../utils/format_ptbr.js";
import {
    clearFormErrors,
    setFieldError,
    validateForm,
    readFormPayload,
    resetForm,
    setLoading,
    readJson,
} from "../utils/lawsuit_appeal_form.js";
import { buildAppealButton } from "../utils/table_actions.js";

let allLawsuits = [];
let currentUser = null;

// Preenchido sempre que o modal abre, a partir da linha clicada — nunca é
// escolhido dentro do formulário. Ver startCreatingAppeal().
let currentLawsuitId = null;

/* =========================================================================
   Estado da página (carregando / conteúdo / erro)
   ========================================================================= */

function getPageElements() {
    return {
        loading: document.querySelector("[data-lawsuits-loading]"),
        content: document.querySelector("[data-lawsuits-content]"),
        error: document.querySelector("[data-lawsuits-error]"),
    };
}

function showState(name) {
    const elements = getPageElements();
    Object.entries(elements).forEach(([key, element]) => {
        if (element) element.hidden = key !== name;
    });
}

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
    const [judgingBodiesResponse, statusResponse, lossProbabilitiesResponse] = await Promise.all([
        fetch(API.judgingBodies, { credentials: "same-origin" }),
        fetch(API.lawsuitStatus, { credentials: "same-origin" }),
        fetch(API.lossProbabilities, { credentials: "same-origin" }),
    ]);

    if (!judgingBodiesResponse.ok || !statusResponse.ok || !lossProbabilitiesResponse.ok) {
        throw new Error("Falha ao carregar os dados de apoio do recurso");
    }

    const judgingBodies = await judgingBodiesResponse.json();
    const status = await statusResponse.json();
    const lossProbabilities = await lossProbabilitiesResponse.json();

    populateSelect(document.querySelector("[data-form-judging-body]"), judgingBodies, "Selecione");
    populateSelect(document.querySelector("[data-form-status]"), status, "Selecione");
    populateSelect(document.querySelector("[data-form-loss-probability]"), lossProbabilities, "Selecione");
}

async function loadLawsuits() {
    const response = await fetch(API.lawsuits, { credentials: "same-origin" });

    if (response.status === 401) {
        window.location.replace(`${PAGES.login}?reason=session-expired`);
        return;
    }

    if (!response.ok) throw new Error(`A API respondeu ${response.status}`);

    allLawsuits = await response.json();
    // Processo mais recente primeiro — o endpoint não garante ordem nenhuma.
    allLawsuits.sort((a, b) => toIsoDate(b.lawsuit_date).localeCompare(toIsoDate(a.lawsuit_date)));

    renderTable();
}

/* =========================================================================
   Tabela

   Construída via DOM + textContent, nunca innerHTML com dado da API — mesmo
   cuidado de controle_nips.js: autor, réu e demais campos vêm de cadastro
   livre.
   ========================================================================= */

function buildCell({ label, text, cellClass, innerClass }) {
    const td = document.createElement("td");
    td.dataset.label = label;
    if (cellClass) td.className = cellClass;

    if (innerClass) {
        const span = document.createElement("span");
        span.className = innerClass;
        span.textContent = text;
        td.appendChild(span);
    } else {
        td.textContent = text;
    }

    return td;
}

/** Autor em cima, réu embaixo — mesmo truque de .beneficiary-cell em nips.css. */
function buildPartiesCell(lawsuit) {
    const td = document.createElement("td");
    td.dataset.label = "Partes";

    const wrap = document.createElement("span");
    wrap.className = "parties-cell";

    const plaintiff = document.createElement("span");
    plaintiff.textContent = lawsuit.plaintiff;

    const defendant = document.createElement("span");
    defendant.className = "table__secondary";
    defendant.textContent = lawsuit.defendant;

    wrap.append(plaintiff, defendant);
    td.appendChild(wrap);
    return td;
}

/**
 * Status como badge neutro.
 *
 * Sem cor por situação: diferente de nip_status (controle_nips.js), a tabela
 * lawsuit_status ainda não tem valores reais cadastrados — não há como saber
 * hoje quais nomes significam "aguardando" ou "finalizado". Colorir por
 * prefixo entra quando os status reais existirem.
 */
function buildStatusCell(lawsuit) {
    const td = document.createElement("td");
    td.dataset.label = "Status";

    const badge = document.createElement("span");
    badge.className = "badge badge--neutral";
    badge.textContent = lawsuit.status_name ?? "—";

    td.appendChild(badge);
    return td;
}

function buildActionsCell(lawsuit) {
    const td = document.createElement("td");
    td.dataset.label = "Ações";
    td.className = "table__actions";

    // O aria-label descreve a linha, não a coluna — mesmo motivo de
    // buildActionsCell em controle_nips.js. O número do processo é o código
    // que identifica o processo para quem o acompanha.
    td.appendChild(buildAppealButton({
        label: `Gerar recurso do processo ${formatCaseNumber(lawsuit.case_number)}`,
        onClick: () => startCreatingAppeal(lawsuit),
    }));

    return td;
}

function buildLawsuitRow(lawsuit) {
    const tr = document.createElement("tr");
    tr.dataset.lawsuitDate = toIsoDate(lawsuit.lawsuit_date);

    tr.appendChild(buildCell({
        label: "Nº do processo",
        text: formatCaseNumber(lawsuit.case_number),
        innerClass: "table__primary tabular",
    }));
    tr.appendChild(buildPartiesCell(lawsuit));
    tr.appendChild(buildStatusCell(lawsuit));
    tr.appendChild(buildCell({
        label: "Valor da causa",
        text: `R$ ${formatarNumero(Number(lawsuit.claim_value), 2)}`,
        innerClass: "tabular",
    }));
    tr.appendChild(buildActionsCell(lawsuit));

    return tr;
}

function renderTable() {
    const body = document.querySelector("[data-lawsuits-body]");
    if (!body) return;

    body.querySelectorAll("tr[data-lawsuit-date]").forEach((row) => row.remove());

    const emptyRow = document.querySelector("[data-lawsuits-empty-row]");
    const fragment = document.createDocumentFragment();
    allLawsuits.forEach((lawsuit) => fragment.appendChild(buildLawsuitRow(lawsuit)));

    if (emptyRow) body.insertBefore(fragment, emptyRow);
    else body.appendChild(fragment);

    if (emptyRow) {
        emptyRow.hidden = allLawsuits.length !== 0;

        const message = document.querySelector("[data-lawsuits-empty-message]");
        if (message) {
            message.textContent = 'Nenhum processo foi cadastrado ainda. Use o botão "Cadastrar Processo" para começar.';
        }
    }
}

/* =========================================================================
   Lista de recursos do processo, dentro do modal

   Só leitura — carregada sempre que o modal abre e recarregada depois de
   cada recurso novo. Constrói via DOM + textContent, nunca innerHTML com
   dado da API, mesmo cuidado do resto da tela.
   ========================================================================= */

function renderAppealList(appeals) {
    const listEl = document.querySelector("[data-appeal-list]");
    const emptyEl = document.querySelector("[data-appeal-list-empty]");
    if (!listEl) return;

    listEl.innerHTML = "";

    if (!appeals.length) {
        listEl.hidden = true;
        if (emptyEl) emptyEl.hidden = false;
        return;
    }

    if (emptyEl) emptyEl.hidden = true;
    listEl.hidden = false;

    appeals.forEach((appeal) => {
        const li = document.createElement("li");
        li.className = "appeal-list__item";

        const primary = document.createElement("span");
        primary.className = "table__primary";
        primary.textContent = `#${appeal.appeal_sequence} · ${appeal.appeal_number}`;

        const secondary = document.createElement("span");
        secondary.className = "table__secondary";
        secondary.textContent = `${appeal.judging_body_name ?? "—"} · ${appeal.status_name ?? "—"} · R$ ${formatarNumero(Number(appeal.claim_value), 2)}`;

        li.append(primary, secondary);
        listEl.appendChild(li);
    });
}

async function loadAppealsForLawsuit(lawsuitId) {
    const loadingEl = document.querySelector("[data-appeal-list-loading]");
    const listEl = document.querySelector("[data-appeal-list]");
    const emptyEl = document.querySelector("[data-appeal-list-empty]");

    if (loadingEl) loadingEl.hidden = false;
    if (listEl) listEl.hidden = true;
    if (emptyEl) emptyEl.hidden = true;

    try {
        const response = await fetch(`${API.lawsuitAppeals}?lawsuit_id=${lawsuitId}`, { credentials: "same-origin" });

        if (response.status === 401) {
            window.location.replace(`${PAGES.login}?reason=session-expired`);
            return;
        }

        if (!response.ok) throw new Error(`A API respondeu ${response.status}`);

        const appeals = await response.json();
        renderAppealList(appeals);
    } catch (error) {
        notifyError("Não foi possível carregar os recursos deste processo.");
        console.error(error);
    } finally {
        if (loadingEl) loadingEl.hidden = true;
    }
}

/* =========================================================================
   Modal de recurso
   ========================================================================= */

function openAppealModal() {
    const modal = document.querySelector("[data-appeal-modal]");
    if (!modal) return;

    modal.showModal();
    document.body.classList.add("no-scroll");
}

/**
 * Fecha e libera o scroll no mesmo golpe — mesmo raciocínio de closeModal()
 * em controle_nips.js: o evento "close" nem sempre dispara de forma
 * confiável, então depender só dele deixa o body preso em overflow: hidden.
 */
function closeModal(modal) {
    modal.close();
    document.body.classList.remove("no-scroll");
}

/** Abre o modal já vinculado ao processo da linha clicada. */
function startCreatingAppeal(lawsuit) {
    currentLawsuitId = lawsuit.id;

    const subtitle = document.querySelector("[data-appeal-modal-subtitle]");
    if (subtitle) subtitle.textContent = `Recurso do processo ${formatCaseNumber(lawsuit.case_number)}.`;

    resetForm();
    openAppealModal();
    loadAppealsForLawsuit(lawsuit.id);
}

function initModal() {
    const modal = document.querySelector("[data-appeal-modal]");
    if (!modal) return;

    document.querySelectorAll("[data-appeal-modal-close]").forEach((button) => {
        button.addEventListener("click", () => closeModal(modal));
    });

    // <dialog> não fecha ao clicar fora sozinho — só o clique no próprio
    // elemento (o backdrop), nunca num filho, chega até aqui.
    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal(modal);
    });

    modal.addEventListener("close", () => {
        document.body.classList.remove("no-scroll");
    });
}

/* =========================================================================
   Formulário de recurso
   ========================================================================= */

function initForm() {
    const form = document.querySelector("[data-appeal-form]");
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

        if (currentLawsuitId === null) {
            notifyError("Nenhum processo selecionado. Feche o formulário e tente de novo.");
            return;
        }

        if (!currentUser) {
            notifyError("Não foi possível identificar o usuário logado. Atualize a página e tente de novo.");
            return;
        }

        const submit = form.querySelector("[data-appeal-submit]");
        setLoading(submit, true);

        const payload = {
            ...readFormPayload(),
            lawsuit_id: currentLawsuitId,
            inserted_by: currentUser.id,
        };

        try {
            const response = await fetch(API.lawsuitAppeals, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(payload),
            });

            if (response.status === 201) {
                notifySuccess("Recurso gerado com sucesso.");
                resetForm();
                document.getElementById("appeal-number")?.focus();
                // Não fecha o modal: o processo pode ter mais de um recurso,
                // e a lista recém-atualizada mostra o que acabou de ser
                // criado sem precisar reabrir.
                await loadAppealsForLawsuit(currentLawsuitId);
                return;
            }

            if (response.status === 401) {
                window.location.replace(`${PAGES.login}?reason=session-expired`);
                return;
            }

            const data = await readJson(response);
            notifyError(data?.message ?? "Não foi possível gerar o recurso.");
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
    showState("loading");

    // O href sai de PAGES para o prefixo da aplicação continuar em um lugar só
    // (utils/routes.js), em vez de literal no HTML.
    const newLink = document.querySelector("[data-new-lawsuit-link]");
    if (newLink) newLink.href = PAGES.lawsuitCreate;

    try {
        const [user] = await Promise.all([loadCurrentUser(), loadReferenceData(), loadLawsuits()]);
        if (!user) return; // já redirecionou para o login

        currentUser = user;
        showState("content");
    } catch (error) {
        showState("error");
        console.error(error);
    }
}

function init() {
    initCurrencyMask();
    initModal();
    initForm();
    loadPage();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
