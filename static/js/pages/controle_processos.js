/**
 * Consultar Processos: tabela dos processos judiciais cadastrados, com dois
 * modais por linha — "Editar" (PUT /api/lawsuits) e "Gerar Recurso"
 * (POST /api/lawsuit-appeals, com lista dos recursos já registrados).
 *
 * Contrato com o HTML (data-*):
 *   [data-new-lawsuit-link]   link para "Cadastrar Processo"; o href é escrito aqui
 *   [data-filter-search]      busca livre (nº do processo, autor, réu, objeto, vara)
 *   [data-filter-subject-matter] / [data-filter-proceeding-stage] /
 *   [data-filter-status] / [data-filter-loss-probability]   selects de filtro
 *   [data-filter-date-from] / [data-filter-date-to]         período do processo
 *   [data-filter-value-min] / [data-filter-value-max]       faixa do valor da causa
 *   [data-filter-clear]       limpa os campos acima
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
 *   [data-appeal-judging-body] / [data-appeal-status] / [data-appeal-loss-probability]
 *                              selects do modal de recurso, preenchidos pela API
 *   [data-lawsuit-edit-modal]       <dialog> do formulário de edição de processo
 *     [data-lawsuit-edit-modal-close] fecha (botão X e Cancelar)
 *     [data-lawsuit-edit-form]        formulário; o submit é interceptado
 *     [data-lawsuit-edit-submit]      botão de salvar
 *   [data-lawsuit-subject-matter] / [data-lawsuit-proceeding-stage] /
 *   [data-lawsuit-status] / [data-lawsuit-loss-probability]
 *                              selects do modal de edição, preenchidos pela API
 *
 * A tela não cria processo — isso é "Cadastrar Processo", a outra tela do
 * grupo. currentLawsuitId (recurso) e currentEditingLawsuitId (edição) nunca
 * são null enquanto o respectivo modal está aberto — quem abre é sempre um
 * botão de linha (ver startCreatingAppeal() e startEditingLawsuit()).
 * Enviar o formulário de recurso não fecha o modal: a lista recarrega e os
 * campos limpam no lugar, para dar para gerar vários recursos seguidos.
 * Enviar o de edição fecha o modal e recarrega a tabela, como em
 * controle_nips.js.
 *
 * status_id e loss_probability_id existem nos dois formulários (recurso e
 * edição de processo, mesmas tabelas de apoio) — e agora também na barra de
 * filtros, três ocorrências do mesmo select na mesma página. Por isso cada um
 * usa atributo data-* prefixado pelo seu dono (data-appeal-status /
 * data-lawsuit-status / data-filter-status), em vez do data-form-* genérico de
 * outras telas: um atributo só faria populateSelect() (que usa querySelector, e
 * pega só o primeiro elemento) preencher o select errado.
 */

import { API, PAGES } from "../utils/routes.js";
import { notifySuccess, notifyError } from "../utils/notyf.js";
import { populateSelect, toIsoDate } from "../utils/nip_form.js";
import {
    formatCaseNumber,
    initCaseNumberMask,
    initCurrencyMask,
    fillForm as fillLawsuitForm,
    validateForm as validateLawsuitForm,
    readFormPayload as readLawsuitFormPayload,
    clearFormErrors as clearLawsuitFormErrors,
    setFieldError as setLawsuitFieldError,
    claimValueNumber,
} from "../utils/lawsuit_form.js";
import { formatarMoeda } from "../utils/format_ptbr.js";
import { syncFilterClear } from "../utils/filters.js";
import {
    clearFormErrors,
    setFieldError,
    validateForm,
    readFormPayload,
    resetForm,
    setLoading,
    readJson,
} from "../utils/lawsuit_appeal_form.js";
import { buildEditButton, buildAppealButton } from "../utils/table_actions.js";

let allLawsuits = [];
let currentUser = null;

// Preenchido sempre que o modal de edição abre, a partir da linha clicada.
// Ver startEditingLawsuit().
let currentEditingLawsuitId = null;

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
    const [
        subjectMattersResponse,
        proceedingStagesResponse,
        judgingBodiesResponse,
        statusResponse,
        lossProbabilitiesResponse,
    ] = await Promise.all([
        fetch(API.subjectMatters, { credentials: "same-origin" }),
        fetch(API.proceedingStages, { credentials: "same-origin" }),
        fetch(API.judgingBodies, { credentials: "same-origin" }),
        fetch(API.lawsuitStatus, { credentials: "same-origin" }),
        fetch(API.lossProbabilities, { credentials: "same-origin" }),
    ]);

    if (!subjectMattersResponse.ok || !proceedingStagesResponse.ok || !judgingBodiesResponse.ok || !statusResponse.ok || !lossProbabilitiesResponse.ok) {
        throw new Error("Falha ao carregar os dados de apoio do processo e do recurso");
    }

    const subjectMatters = await subjectMattersResponse.json();
    const proceedingStages = await proceedingStagesResponse.json();
    const judgingBodies = await judgingBodiesResponse.json();
    const status = await statusResponse.json();
    const lossProbabilities = await lossProbabilitiesResponse.json();

    // Barra de filtros. As mesmas listas dos modais, com o placeholder que
    // significa "não filtrar por este campo" em vez de "escolha um".
    populateSelect(document.querySelector("[data-filter-subject-matter]"), subjectMatters, "Todos");
    populateSelect(document.querySelector("[data-filter-proceeding-stage]"), proceedingStages, "Todos");
    populateSelect(document.querySelector("[data-filter-status]"), status, "Todos");
    populateSelect(document.querySelector("[data-filter-loss-probability]"), lossProbabilities, "Todas");

    // Modal de recurso.
    populateSelect(document.querySelector("[data-appeal-judging-body]"), judgingBodies, "Selecione");
    populateSelect(document.querySelector("[data-appeal-status]"), status, "Selecione");
    populateSelect(document.querySelector("[data-appeal-loss-probability]"), lossProbabilities, "Selecione");

    // Modal de edição de processo.
    populateSelect(document.querySelector("[data-lawsuit-subject-matter]"), subjectMatters, "Selecione");
    populateSelect(document.querySelector("[data-lawsuit-proceeding-stage]"), proceedingStages, "Selecione");
    populateSelect(document.querySelector("[data-lawsuit-status]"), status, "Selecione");
    populateSelect(document.querySelector("[data-lawsuit-loss-probability]"), lossProbabilities, "Selecione");
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

/**
 * Número do processo em cima, objeto/assunto embaixo.
 *
 * O objeto é um dos filtros da barra, e filtrar por um dado que não aparece em
 * coluna nenhuma esconde linhas por um critério que ninguém consegue conferir
 * no resultado. Como linha secundária ele não custa coluna nova (a tabela já
 * tem min-width: 960px) e ainda entra no textContent que a busca livre varre.
 */
function buildCaseCell(lawsuit) {
    const td = document.createElement("td");
    td.dataset.label = "Nº do processo";

    const wrap = document.createElement("span");
    wrap.className = "case-cell";

    const caseNumber = document.createElement("span");
    caseNumber.className = "table__primary tabular";
    caseNumber.textContent = formatCaseNumber(lawsuit.case_number);

    const subjectMatter = document.createElement("span");
    subjectMatter.className = "table__secondary";
    subjectMatter.textContent = lawsuit.subject_matter_name ?? "—";

    wrap.append(caseNumber, subjectMatter);
    td.appendChild(wrap);
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
 * Status como badge neutro, com a probabilidade de perda embaixo.
 *
 * Sem cor por situação: diferente de nip_status (controle_nips.js), a tabela
 * lawsuit_status ainda não tem valores reais cadastrados — não há como saber
 * hoje quais nomes significam "aguardando" ou "finalizado". Colorir por
 * prefixo entra quando os status reais existirem.
 *
 * A probabilidade acompanha o status pelo mesmo motivo do objeto em
 * buildCaseCell: é filtro da barra e precisa ser conferível na linha. Situação
 * e risco também são lidos juntos — "conclusos para julgamento" diz pouco sem
 * "perda provável" ao lado.
 */
function buildStatusCell(lawsuit) {
    const td = document.createElement("td");
    td.dataset.label = "Status";

    const wrap = document.createElement("span");
    wrap.className = "status-cell";

    const badge = document.createElement("span");
    badge.className = "badge badge--neutral";
    badge.textContent = lawsuit.status_name ?? "—";

    const lossProbability = document.createElement("span");
    lossProbability.className = "table__secondary";
    lossProbability.textContent = `Perda: ${lawsuit.loss_probability_name ?? "—"}`;

    wrap.append(badge, lossProbability);
    td.appendChild(wrap);
    return td;
}

function buildActionsCell(lawsuit) {
    const td = document.createElement("td");
    td.dataset.label = "Ações";
    td.className = "table__actions";

    // O aria-label descreve a linha, não a coluna — mesmo motivo de
    // buildActionsCell em controle_nips.js. O número do processo é o código
    // que identifica o processo para quem o acompanha.
    const caseNumber = formatCaseNumber(lawsuit.case_number);

    td.appendChild(buildEditButton({
        label: `Editar processo ${caseNumber}`,
        onClick: () => startEditingLawsuit(lawsuit),
    }));

    td.appendChild(buildAppealButton({
        label: `Gerar recurso do processo ${caseNumber}`,
        onClick: () => startCreatingAppeal(lawsuit),
    }));

    return td;
}

function buildLawsuitRow(lawsuit) {
    const tr = document.createElement("tr");

    // O que a barra de filtros compara. Fica no <tr>, e não relido da API, para
    // applyFilters() decidir linha a linha sem procurar o processo na lista —
    // mesmo desenho de buildNipRow em controle_nips.js.
    tr.dataset.lawsuitDate = toIsoDate(lawsuit.lawsuit_date);
    tr.dataset.subjectMatterId = String(lawsuit.subject_matter_id);
    tr.dataset.proceedingStageId = String(lawsuit.proceeding_stage_id);
    tr.dataset.statusId = String(lawsuit.status_id);
    tr.dataset.lossProbabilityId = String(lawsuit.loss_probability_id);

    // O valor da causa aparece na célula formatado ("R$ 1.234,56"); a
    // comparação de faixa precisa do número cru.
    tr.dataset.claimValue = String(Number(lawsuit.claim_value));

    // O número do processo é renderizado mascarado. Os dígitos crus entram num
    // atributo à parte para a busca achar tanto "0001234-56.2024.8.26.0100"
    // quanto "0001234562024826010" — mesmo motivo do CPF em controle_nips.js.
    tr.dataset.caseNumberDigits = String(lawsuit.case_number ?? "");

    // A vara é a única dimensão filtrável que não vira texto em nenhuma célula
    // (os nomes são longos demais para a coluna): sem isto, a busca livre não a
    // alcançaria. Ver rowSearchText().
    tr.dataset.proceedingStageName = String(lawsuit.proceeding_stage_name ?? "");

    tr.appendChild(buildCaseCell(lawsuit));
    tr.appendChild(buildPartiesCell(lawsuit));
    tr.appendChild(buildStatusCell(lawsuit));
    tr.appendChild(buildCell({
        label: "Valor da causa",
        text: formatarMoeda(lawsuit.claim_value),
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

    // A empty-row é assunto de applyFilters(): quem decide se ela aparece não é
    // o tamanho da lista, é quantas linhas sobraram do recorte. Terminar aqui
    // também é o que faz um filtro aplicado continuar valendo depois de salvar
    // uma edição e recarregar a tabela.
    applyFilters();
}

/* =========================================================================
   Filtros

   Sem nova busca ao servidor: a tabela inteira já está no DOM, e cada linha
   soma ou some pelo atributo hidden — é o que .table tbody tr[hidden] em
   components.css já prevê. Sem paginação, filtrar no cliente é instantâneo e
   não pede endpoint novo.

   O estado do filtro é o próprio DOM: o value de cada controle. Guardá-lo
   também num objeto criaria duas verdades para sincronizar.
   ========================================================================= */

/**
 * Texto da linha + o que ela não mostra: o número do processo sem máscara e o
 * nome da vara (que não vira coluna).
 */
const rowSearchText = (row) =>
    `${row.textContent} ${row.dataset.caseNumberDigits} ${row.dataset.proceedingStageName}`.toLowerCase();

// Um lugar só dizendo quais campos filtram esta tela: applyFilters() lê os
// valores, initFilters() escuta as mudanças e syncFilterClear() conta quantos
// estão valendo. Uma lista por função faria as três divergirem no dia em que
// um filtro novo entrar.
const FILTER_SELECTORS = [
    "[data-filter-search]",
    "[data-filter-subject-matter]",
    "[data-filter-proceeding-stage]",
    "[data-filter-status]",
    "[data-filter-loss-probability]",
    "[data-filter-date-from]",
    "[data-filter-date-to]",
    "[data-filter-value-min]",
    "[data-filter-value-max]",
];

const filterInputs = () => FILTER_SELECTORS.map((selector) => document.querySelector(selector));

/**
 * Valor de um campo da faixa, em número, ou null quando o campo está vazio.
 *
 * O null não é preciosismo: claimValueNumber("") devolve 0, e um "valor máx"
 * vazio lido como zero esconderia a tabela inteira.
 */
function readCurrencyFilter(selector) {
    const value = document.querySelector(selector)?.value ?? "";
    return value.trim() === "" ? null : claimValueNumber(value);
}

function applyFilters() {
    const body = document.querySelector("[data-lawsuits-body]");
    const emptyRow = document.querySelector("[data-lawsuits-empty-row]");
    if (!body) return;

    const rawSearch = (document.querySelector("[data-filter-search]")?.value ?? "").trim().toLowerCase();
    const subjectMatterId = document.querySelector("[data-filter-subject-matter]")?.value ?? "";
    const proceedingStageId = document.querySelector("[data-filter-proceeding-stage]")?.value ?? "";
    const statusId = document.querySelector("[data-filter-status]")?.value ?? "";
    const lossProbabilityId = document.querySelector("[data-filter-loss-probability]")?.value ?? "";
    const fromDate = document.querySelector("[data-filter-date-from]")?.value ?? "";
    const toDate = document.querySelector("[data-filter-date-to]")?.value ?? "";
    const minValue = readCurrencyFilter("[data-filter-value-min]");
    const maxValue = readCurrencyFilter("[data-filter-value-max]");

    // Digitar o número do processo pontuado tem de achar a linha mesmo
    // comparando com os dígitos crus, então a pontuação sai da busca quando o
    // termo é só número.
    const search = /^[\d.\-\s]+$/.test(rawSearch) ? rawSearch.replace(/[.\-\s]/g, "") : rawSearch;

    let visibleCount = 0;

    body.querySelectorAll("tr[data-lawsuit-date]").forEach((row) => {
        const claimValue = Number(row.dataset.claimValue);

        const matchesSubjectMatter = !subjectMatterId || row.dataset.subjectMatterId === subjectMatterId;
        const matchesProceedingStage = !proceedingStageId || row.dataset.proceedingStageId === proceedingStageId;
        const matchesStatus = !statusId || row.dataset.statusId === statusId;
        const matchesLossProbability = !lossProbabilityId || row.dataset.lossProbabilityId === lossProbabilityId;
        const matchesFrom = !fromDate || row.dataset.lawsuitDate >= fromDate;
        const matchesTo = !toDate || row.dataset.lawsuitDate <= toDate;
        const matchesMinValue = minValue === null || claimValue >= minValue;
        const matchesMaxValue = maxValue === null || claimValue <= maxValue;
        // Leitura de texto já renderizado, não escrita — não é o mesmo risco
        // do innerHTML.
        const matchesSearch = !search || rowSearchText(row).includes(search);

        const visible = matchesSubjectMatter && matchesProceedingStage && matchesStatus
            && matchesLossProbability && matchesFrom && matchesTo
            && matchesMinValue && matchesMaxValue && matchesSearch;

        row.hidden = !visible;
        if (visible) visibleCount += 1;
    });

    if (emptyRow) {
        emptyRow.hidden = visibleCount !== 0;

        const message = document.querySelector("[data-lawsuits-empty-message]");
        if (message) {
            message.textContent = allLawsuits.length === 0
                ? 'Nenhum processo foi cadastrado ainda. Use o botão "Cadastrar Processo" para começar.'
                : "Nenhum processo encontrado para os filtros selecionados.";
        }
    }

    syncFilterClear(filterInputs());
}

function initFilters() {
    const inputs = filterInputs();

    inputs.forEach((input) => {
        if (!input) return;
        const event = input.tagName === "SELECT" || input.type === "date" ? "change" : "input";
        input.addEventListener(event, applyFilters);
    });

    document.querySelector("[data-filter-clear]")?.addEventListener("click", () => {
        inputs.forEach((input) => {
            if (input) input.value = "";
        });
        applyFilters();

        // Limpar desabilita o próprio botão, e o foco cairia no <body> — quem
        // navega por teclado perderia o lugar no meio da barra. A busca é o
        // começo natural de um novo filtro, então o foco vai para ela.
        document.querySelector("[data-filter-search]")?.focus();
    });
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
        secondary.textContent = `${appeal.judging_body_name ?? "—"} · ${appeal.status_name ?? "—"} · ${formatarMoeda(appeal.claim_value)}`;

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
   Modal de edição de processo
   ========================================================================= */

function openLawsuitEditModal() {
    const modal = document.querySelector("[data-lawsuit-edit-modal]");
    if (!modal) return;

    modal.showModal();
    document.body.classList.add("no-scroll");
}

/** Abre o modal já preenchido com um processo existente. */
function startEditingLawsuit(lawsuit) {
    currentEditingLawsuitId = lawsuit.id;
    fillLawsuitForm(lawsuit);
    openLawsuitEditModal();
}

function initLawsuitEditModal() {
    const modal = document.querySelector("[data-lawsuit-edit-modal]");
    if (!modal) return;

    document.querySelectorAll("[data-lawsuit-edit-modal-close]").forEach((button) => {
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

function initLawsuitEditForm() {
    const form = document.querySelector("[data-lawsuit-edit-form]");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearLawsuitFormErrors();

        const problems = validateLawsuitForm();
        if (problems.length) {
            problems.forEach(({ id, message }) => setLawsuitFieldError(id, message));
            document.getElementById(problems[0].id)?.focus();
            return;
        }

        if (currentEditingLawsuitId === null) {
            notifyError("Nenhum processo selecionado para edição. Feche o formulário e tente de novo.");
            return;
        }

        const submit = form.querySelector("[data-lawsuit-edit-submit]");
        setLoading(submit, true);

        // O id diz ao backend qual registro alterar; updated_by e updated_at
        // são calculados no servidor a partir da sessão autenticada, e por
        // isso não vão no corpo — mesmo arranjo do PUT de NIP's.
        const payload = { ...readLawsuitFormPayload(), id: currentEditingLawsuitId };

        try {
            const response = await fetch(API.lawsuits, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(payload),
            });

            if (response.status === 200) {
                const modal = document.querySelector("[data-lawsuit-edit-modal]");
                if (modal) closeModal(modal);
                notifySuccess("Processo atualizado com sucesso.");
                await loadLawsuits();
                return;
            }

            if (response.status === 401) {
                window.location.replace(`${PAGES.login}?reason=session-expired`);
                return;
            }

            const data = await readJson(response);
            notifyError(data?.message ?? "Não foi possível salvar o processo.");
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
    initCaseNumberMask();
    initCurrencyMask();

    // Depois de initCurrencyMask(), nunca antes: os dois escutam "input" nos
    // mesmos campos de valor da barra, e listener dispara na ordem em que foi
    // registrado. Invertido, applyFilters() leria o campo antes de a máscara
    // reescrevê-lo e filtraria por um número defasado em um dígito.
    initFilters();

    initLawsuitEditModal();
    initLawsuitEditForm();
    initModal();
    initForm();
    loadPage();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
