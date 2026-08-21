/**
 * Consultar Processos: tabela dos processos judiciais cadastrados, com dois
 * modais por linha — "Editar" (PUT /api/lawsuits) e "Gerar Recurso"
 * (POST /api/lawsuit-appeals, com lista dos recursos já registrados).
 *
 * Contrato com o HTML (data-*):
 *   [data-new-lawsuit-link]   link para "Cadastrar Processo"; o href é escrito aqui
 *   [data-filter-search]      busca livre (nº do processo, autor, réu, objeto, trâmite)
 *   [data-filter-subject-matter] / [data-filter-proceeding-stage] /
 *   [data-filter-status] / [data-filter-loss-probability] /
 *   [data-filter-active]                                    selects de filtro
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
import { formatDate, populateSelect, toIsoDate } from "../utils/nip_form.js";
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
import { formatarMoeda, SEM_DADO } from "../utils/format_ptbr.js";
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

   Uma coluna por campo do processo, na ordem do <thead> de
   controle_processos.html. As células compostas de antes (número + objeto,
   autor + réu, status + chance de perda) se dissolveram: com onze colunas o
   que economizava espaço passou a esconder dado que o filtro usa.
   ========================================================================= */

/**
 * Célula de texto.
 *
 * `title` repete o conteúdo no atributo homônimo, e existe para as colunas de
 * texto livre: lawsuits.css as corta com reticências, e o title é o que
 * devolve a frase inteira no hover. Só as colunas que podem estourar a largura
 * o passam — um title igual ao texto que já cabe inteiro na tela é só um
 * tooltip repetindo o óbvio.
 */
function buildCell({ label, text, cellClass, innerClass, title }) {
    const td = document.createElement("td");
    td.dataset.label = label;
    if (cellClass) td.className = cellClass;
    if (title) td.title = title;

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
 * Célula de pílula, usada em "Ativo" e em "Andamento/Status".
 *
 * O status continua em badge--neutral, sem cor por situação: diferente de
 * nip_status (controle_nips.js), a tabela lawsuit_status ainda não tem valores
 * reais cadastrados — não há como saber hoje quais nomes significam
 * "aguardando" ou "finalizado". Colorir por prefixo entra quando os status
 * reais existirem.
 *
 * A situação do processo é o caso oposto: são dois valores e só, então a cor
 * carrega o significado inteiro e o texto vira confirmação.
 *
 * A pílula fica solta no <td>, sem o wrapper flex que a célula composta de
 * status usava: agora que cada dado tem a sua coluna não há mais um segundo
 * texto embaixo dela para alinhar.
 */
function buildBadgeCell({ label, text, tone, title }) {
    const td = document.createElement("td");
    td.dataset.label = label;
    if (title) td.title = title;

    const badge = document.createElement("span");
    badge.className = `badge ${tone}`;

    // O texto vai num <span> próprio, e não solto no badge, para poder ser
    // cortado com reticências: .badge é inline-flex, e texto solto dentro dele
    // vira um item anônimo, que text-overflow não alcança — um status longo
    // seria cortado a seco no meio da palavra. Ver .lawsuits-table .badge em
    // lawsuits.css.
    const badgeText = document.createElement("span");
    badgeText.textContent = text;
    badge.appendChild(badgeText);

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

    // "true"/"false" — o mesmo par de valores que as <option> do filtro de
    // situação carregam. O Boolean() é o que faz is_active ausente ou nulo
    // virar "false" em vez de "undefined", que não casaria com opção nenhuma.
    tr.dataset.isActive = String(Boolean(lawsuit.is_active));

    // O valor da causa aparece na célula formatado ("R$ 1.234,56"); a
    // comparação de faixa precisa do número cru.
    tr.dataset.claimValue = String(Number(lawsuit.claim_value));

    // O número do processo é renderizado mascarado. Os dígitos crus entram num
    // atributo à parte para a busca achar tanto "0001234-56.2024.8.26.0100"
    // quanto "0001234562024826010" — mesmo motivo do CPF em controle_nips.js.
    tr.dataset.caseNumberDigits = String(lawsuit.case_number ?? "");

    // Uma célula por coluna, na ordem do <thead>. As de texto livre repetem o
    // conteúdo em title porque lawsuits.css as corta com reticências — o corte
    // é só pintura, o textContent que a busca varre continua inteiro.
    tr.appendChild(buildCell({
        label: "Data",
        text: formatDate(lawsuit.lawsuit_date),
        innerClass: "table__primary",
    }));

    tr.appendChild(buildBadgeCell({
        label: "Ativo",
        text: lawsuit.is_active ? "Ativo" : "Inativo",
        tone: lawsuit.is_active ? "badge--success" : "badge--negative",
    }));

    tr.appendChild(buildCell({
        label: "Nº do processo",
        text: formatCaseNumber(lawsuit.case_number),
        innerClass: "table__primary tabular",
    }));

    tr.appendChild(buildCell({
        label: "Autor",
        text: lawsuit.plaintiff,
        title: lawsuit.plaintiff,
    }));

    tr.appendChild(buildCell({
        label: "Réu",
        text: lawsuit.defendant,
        title: lawsuit.defendant,
    }));

    tr.appendChild(buildCell({
        label: "Valor da causa",
        text: formatarMoeda(lawsuit.claim_value),
        cellClass: "table__num",
    }));

    tr.appendChild(buildCell({
        label: "Objeto/Assunto",
        text: lawsuit.subject_matter_name ?? SEM_DADO,
        title: lawsuit.subject_matter_name ?? "",
    }));

    tr.appendChild(buildCell({
        label: "Trâmite",
        text: lawsuit.proceeding_stage_name ?? SEM_DADO,
        title: lawsuit.proceeding_stage_name ?? "",
    }));

    tr.appendChild(buildBadgeCell({
        label: "Andamento/Status",
        text: lawsuit.status_name ?? SEM_DADO,
        tone: "badge--neutral",
        title: lawsuit.status_name ?? "",
    }));

    tr.appendChild(buildCell({
        label: "Chance de perda",
        text: lawsuit.loss_probability_name ?? SEM_DADO,
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
 * Texto da linha mais o número do processo sem máscara — o único dado
 * filtrável que a tabela não mostra em texto puro (a coluna o renderiza
 * pontuado).
 *
 * O trâmite saiu daqui: virou coluna de verdade, e o corte com reticências de
 * lawsuits.css é só pintura — o textContent continua trazendo o nome inteiro.
 */
const rowSearchText = (row) =>
    `${row.textContent} ${row.dataset.caseNumberDigits}`.toLowerCase();

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
    "[data-filter-active]",
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
    const isActive = document.querySelector("[data-filter-active]")?.value ?? "";
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
        const matchesActive = !isActive || row.dataset.isActive === isActive;
        const matchesFrom = !fromDate || row.dataset.lawsuitDate >= fromDate;
        const matchesTo = !toDate || row.dataset.lawsuitDate <= toDate;
        const matchesMinValue = minValue === null || claimValue >= minValue;
        const matchesMaxValue = maxValue === null || claimValue <= maxValue;
        // Leitura de texto já renderizado, não escrita — não é o mesmo risco
        // do innerHTML.
        const matchesSearch = !search || rowSearchText(row).includes(search);

        const visible = matchesSubjectMatter && matchesProceedingStage && matchesStatus
            && matchesLossProbability && matchesActive && matchesFrom && matchesTo
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
