/**
 * Lançamento de Resíduos: tabela de lançamentos com filtro no cliente e modal
 * de cadastro.
 *
 * Contrato com o HTML (data-*):
 *   [data-consent-modal]       <dialog> de aviso de responsabilidade, aberto
 *                              sozinho a cada carregamento da página
 *     [data-consent-accept]      único jeito de fechar — "Eu concordo"
 *   [data-new-record-trigger]  botão que abre o modal de novo lançamento
 *   [data-records-loading]     esqueleto; estado inicial
 *   [data-records-content]     card com toolbar + tabela; nasce hidden
 *   [data-records-error]       recado de falha; nasce hidden
 *   [data-records-body]        <tbody> onde as linhas são escritas
 *   [data-records-empty-row]   linha fixa de "nenhum resultado"; só o texto e
 *                              o hidden dela mudam — nunca é removida do DOM
 *     [data-records-empty-message]
 *   [data-filter-search]       busca livre (unidade, tipo, observação)
 *   [data-filter-unit] / [data-filter-type]   selects de filtro
 *   [data-filter-date-from] / [data-filter-date-to]
 *   [data-filter-clear]        limpa os cinco campos acima
 *   [data-record-modal]        <dialog> do formulário — serve para criar e editar
 *     [data-record-modal-subtitle]  texto trocado por setModalMode()
 *     [data-record-modal-close]  fecha (botão X e Cancelar, os dois têm o atributo)
 *     [data-record-form]         formulário; o submit é interceptado
 *     [data-form-unit] / [data-form-type]   selects do formulário
 *     [data-record-submit]       botão de salvar; o texto também troca com o modo
 *   [data-error-for="<id>"]    mensagem de erro do campo de mesmo id
 *
 * O botão "Editar" de cada linha abre o mesmo modal do "Novo lançamento",
 * pré-preenchido — ver startEditingRecord() e editingRecordId, a variável que
 * diz se o próximo envio do formulário é POST (criar) ou PUT (editar).
 *
 * O peso e as datas que a API devolve podem chegar como texto (Decimal vira
 * string no jsonify do Flask) ou em formato HTTP em vez de ISO — ver
 * models/waste_records_model.py. As funções de data e fillFormForEdit()
 * tratam os dois formatos; o ideal é corrigir na origem (to_dict()), mas a
 * tela funciona sem depender disso.
 */

import { API, PAGES } from "../utils/routes.js";
import { notifySuccess, notifyError } from "../utils/notyf.js";
import { syncFilterClear } from "../utils/filters.js";
import { buildEditButton } from "../utils/table_actions.js";
import { lockPageScroll, unlockPageScroll } from "../utils/scroll_lock.js";

// Espelha MIN_RECORD_DATE em services/waste_records_service.py. Só orienta o
// campo de data no formulário; quem decide de verdade é o servidor.
const MIN_RECORD_DATE = "2026-07-01";

let currentUser = null;
let allRecords = [];
let units = [];
let wasteTypes = [];
let wasteTypesById = {};

// null => próximo envio do formulário é POST (criar). Com um id => é PUT
// (editar) daquele lançamento. Ver startEditingRecord() e o gatilho de
// "Novo lançamento" em initModal().
let editingRecordId = null;

/* =========================================================================
   Estado da página (carregando / conteúdo / erro)
   ========================================================================= */

function getPageElements() {
    return {
        loading: document.querySelector("[data-records-loading]"),
        content: document.querySelector("[data-records-content]"),
        error: document.querySelector("[data-records-error]"),
    };
}

function showState(name) {
    const elements = getPageElements();
    Object.entries(elements).forEach(([key, element]) => {
        if (element) element.hidden = key !== name;
    });
}

/* =========================================================================
   Datas e números

   A API pode devolver record_date como "2026-08-07" (correto) ou como uma
   string HTTP tipo "Fri, 07 Aug 2026 00:00:00 GMT" (o que to_dict() ainda
   devolve hoje) — o construtor de Date do JS entende as duas. O timeZone:
   "UTC" nas duas funções de formatação evita o erro clássico de exibir o dia
   anterior: sem ele, meia-noite UTC vira a noite anterior em fuso negativo.
   ========================================================================= */

function toIsoDate(value) {
    return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value) {
    return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatWeight(value) {
    return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
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

/** Preenche um <select> a partir de uma lista de {id, name}. */
function populateSelect(select, items, placeholder) {
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

async function loadReferenceData() {
    const [unitsResponse, typesResponse] = await Promise.all([
        fetch(API.units, { credentials: "same-origin" }),
        fetch(API.wasteTypes, { credentials: "same-origin" }),
    ]);

    if (!unitsResponse.ok || !typesResponse.ok) {
        throw new Error("Falha ao carregar unidades ou tipos de resíduo");
    }

    units = await unitsResponse.json();
    wasteTypes = await typesResponse.json();
    wasteTypesById = Object.fromEntries(wasteTypes.map((type) => [type.id, type]));

    populateSelect(document.querySelector("[data-filter-unit]"), units, "Todas");
    populateSelect(document.querySelector("[data-filter-type]"), wasteTypes, "Todos");
    populateSelect(document.querySelector("[data-form-unit]"), units, "Selecione");
    populateSelect(document.querySelector("[data-form-type]"), wasteTypes, "Selecione");
}

async function loadRecords() {
    const response = await fetch(API.wasteRecords, { credentials: "same-origin" });

    if (response.status === 401) {
        window.location.replace(`${PAGES.login}?reason=session-expired`);
        return;
    }

    if (!response.ok) throw new Error(`A API respondeu ${response.status}`);

    allRecords = await response.json();
    // Mais recente primeiro — o endpoint não garante ordem nenhuma.
    allRecords.sort((a, b) => toIsoDate(b.record_date).localeCompare(toIsoDate(a.record_date)));

    renderTable();
}

/* =========================================================================
   Tabela

   Construída via DOM + textContent, nunca innerHTML com dado da API: nome de
   unidade, observação e afins vêm de cadastro livre, e innerHTML com esse
   texto seria XSS armazenado — o mesmo cuidado que shell.js já toma com nome
   e e-mail do usuário logado.
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

function buildTypeCell(record) {
    const td = document.createElement("td");
    td.dataset.label = "Tipo de resíduo";

    const wrap = document.createElement("span");
    wrap.className = "type-cell";

    const name = document.createElement("span");
    name.textContent = record.waste_type_name;

    const type = wasteTypesById[record.waste_type_id];
    const badge = document.createElement("span");
    badge.className = `badge ${type?.is_recyclable ? "badge--success" : "badge--neutral"}`;
    badge.textContent = type?.is_recyclable ? "Reciclável" : "Não reciclável";

    wrap.append(name, badge);
    td.appendChild(wrap);
    return td;
}

function buildActionsCell(record) {
    const td = document.createElement("td");
    td.dataset.label = "Ações";
    td.className = "table__actions";

    // O aria-label descreve a linha, não a coluna: numa lista de vinte
    // lançamentos, vinte botões chamados só "Editar" não dizem qual é qual
    // para quem navega por teclado ou leitor de tela.
    td.appendChild(buildEditButton({
        label: `Editar lançamento de ${formatDate(record.record_date)} — ${record.unit_name}, ${record.waste_type_name}`,
        // Closure sobre o record da própria linha: os dados para preencher o
        // formulário já estão em mãos, sem precisar buscar de novo por id.
        onClick: () => startEditingRecord(record),
    }));

    return td;
}

function buildRecordRow(record) {
    const tr = document.createElement("tr");
    tr.dataset.unitId = String(record.unit_id);
    tr.dataset.wasteTypeId = String(record.waste_type_id);
    tr.dataset.recordDate = toIsoDate(record.record_date);

    tr.appendChild(buildCell({ label: "Data", text: formatDate(record.record_date), innerClass: "table__primary" }));
    tr.appendChild(buildCell({ label: "Unidade", text: record.unit_name }));
    tr.appendChild(buildTypeCell(record));
    tr.appendChild(buildCell({
        label: "Peso (kg)",
        text: formatWeight(record.weight_kg),
        cellClass: "table__num tabular",
    }));
    tr.appendChild(buildCell({ label: "Observações", text: record.observations || "—" }));
    tr.appendChild(buildCell({ label: "Lançado por", text: record.inserted_by_name }));
    tr.appendChild(buildActionsCell(record));

    return tr;
}

function renderTable() {
    const body = document.querySelector("[data-records-body]");
    if (!body) return;

    body.querySelectorAll("tr[data-record-date]").forEach((row) => row.remove());

    const emptyRow = document.querySelector("[data-records-empty-row]");
    const fragment = document.createDocumentFragment();
    allRecords.forEach((record) => fragment.appendChild(buildRecordRow(record)));

    if (emptyRow) body.insertBefore(fragment, emptyRow);
    else body.appendChild(fragment);

    applyFilters();
}

/* =========================================================================
   Filtros

   Sem nova busca ao servidor: a tabela inteira já está no DOM, e cada linha
   soma ou some pelo atributo hidden — é o que .table tbody tr[hidden] em
   components.css já prevê. Sem paginação, filtrar no cliente é instantâneo e
   não pede endpoint novo.
   ========================================================================= */

// Um lugar só dizendo quais campos filtram esta tela: applyFilters() lê os
// valores, initFilters() escuta as mudanças e syncFilterClear() conta quantos
// estão valendo. Uma lista por função faria as três divergirem no dia em que
// um filtro novo entrar.
const FILTER_SELECTORS = [
    "[data-filter-search]",
    "[data-filter-unit]",
    "[data-filter-type]",
    "[data-filter-date-from]",
    "[data-filter-date-to]",
];

const filterInputs = () => FILTER_SELECTORS.map((selector) => document.querySelector(selector));

function applyFilters() {
    const body = document.querySelector("[data-records-body]");
    const emptyRow = document.querySelector("[data-records-empty-row]");
    if (!body) return;

    const search = (document.querySelector("[data-filter-search]")?.value ?? "").trim().toLowerCase();
    const unitId = document.querySelector("[data-filter-unit]")?.value ?? "";
    const typeId = document.querySelector("[data-filter-type]")?.value ?? "";
    const fromDate = document.querySelector("[data-filter-date-from]")?.value ?? "";
    const toDate = document.querySelector("[data-filter-date-to]")?.value ?? "";

    let visibleCount = 0;

    body.querySelectorAll("tr[data-record-date]").forEach((row) => {
        const matchesUnit = !unitId || row.dataset.unitId === unitId;
        const matchesType = !typeId || row.dataset.wasteTypeId === typeId;
        const matchesFrom = !fromDate || row.dataset.recordDate >= fromDate;
        const matchesTo = !toDate || row.dataset.recordDate <= toDate;
        // Leitura de texto já renderizado, não escrita — não é o mesmo risco
        // do innerHTML acima.
        const matchesSearch = !search || row.textContent.toLowerCase().includes(search);

        const visible = matchesUnit && matchesType && matchesFrom && matchesTo && matchesSearch;
        row.hidden = !visible;
        if (visible) visibleCount += 1;
    });

    if (emptyRow) {
        emptyRow.hidden = visibleCount !== 0;

        const message = document.querySelector("[data-records-empty-message]");
        if (message) {
            message.textContent = allRecords.length === 0
                ? 'Nenhum resíduo foi lançado ainda. Use o botão "Novo lançamento" para começar.'
                : "Nenhum lançamento encontrado para os filtros selecionados.";
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
   Modal de lançamento (criar e editar)
   ========================================================================= */

const MODAL_TEXT = {
    create: {
        title: "Novo lançamento de resíduo",
        subtitle: "Peso coletado em uma unidade, para um tipo de resíduo, em uma data.",
        submit: "Salvar lançamento",
    },
    edit: {
        title: "Editar lançamento de resíduo",
        subtitle: "Altere os dados do lançamento e salve para atualizar.",
        submit: "Salvar alterações",
    },
};

/** Troca o texto do modal entre os dois modos — o formulário é o mesmo, só o que ele faz muda. */
function setModalMode(mode) {
    const texts = MODAL_TEXT[mode];

    const titleEl = document.getElementById("titulo-modal-lancamento");
    const subtitleEl = document.querySelector("[data-record-modal-subtitle]");
    const submitEl = document.querySelector("[data-record-submit]");

    if (titleEl) titleEl.textContent = texts.title;
    if (subtitleEl) subtitleEl.textContent = texts.subtitle;
    if (submitEl) submitEl.textContent = texts.submit;
}

function openRecordModal() {
    const modal = document.querySelector("[data-record-modal]");
    if (!modal) return;

    modal.showModal();
    lockPageScroll();
}

/**
 * Fecha e libera o scroll no mesmo golpe, em vez de fechar e esperar o
 * evento "close" fazer a segunda parte — em alguns ambientes esse evento não
 * dispara de forma confiável (é despachado como tarefa assíncrona pelo
 * spec, não sincronamente), então depender só dele deixa o body preso em
 * overflow: hidden. Usada em todo close() que o próprio código dispara; o
 * listener de "close" continua como reforço para o caminho do Esc, que não
 * passa por aqui.
 */
function closeModal(modal) {
    modal.close();
    unlockPageScroll();
}

/** Abre o modal já preenchido com um lançamento existente, em modo de edição. */
function startEditingRecord(record) {
    editingRecordId = record.id;
    setModalMode("edit");
    fillFormForEdit(record);
    openRecordModal();
}

/* =========================================================================
   Modal de responsabilidade
   ========================================================================= */

/**
 * Aberto a cada carregamento da página, sem exceção — não fica gravado em
 * localStorage nem em cookie, porque o pedido foi "sempre que eu acessar".
 * showModal() já torna o resto da página inerte (tabela, filtros, sidebar)
 * enquanto está aberto; o único jeito de sair é "Eu concordo".
 */
function initConsentModal() {
    const modal = document.querySelector("[data-consent-modal]");
    if (!modal) return;

    // "cancel" é o evento nativo do Esc num <dialog> aberto por showModal().
    // Bloquear aqui impede que o teclado vire um atalho pra pular o aviso.
    modal.addEventListener("cancel", (event) => event.preventDefault());

    document.querySelector("[data-consent-accept]")?.addEventListener("click", () => {
        closeModal(modal);
    });

    modal.addEventListener("close", () => {
        unlockPageScroll();
    });

    modal.showModal();
    lockPageScroll();
}

function initModal() {
    const modal = document.querySelector("[data-record-modal]");
    const trigger = document.querySelector("[data-new-record-trigger]");
    if (!modal) return;

    trigger?.addEventListener("click", () => {
        editingRecordId = null;
        setModalMode("create");
        resetForm();
        openRecordModal();
    });

    document.querySelectorAll("[data-record-modal-close]").forEach((button) => {
        button.addEventListener("click", () => closeModal(modal));
    });

    // <dialog> não fecha ao clicar fora sozinho — só o clique no próprio
    // elemento (o backdrop), nunca num filho, chega até aqui.
    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal(modal);
    });

    // showModal() bloqueia interação com o fundo, mas não trava a rolagem da
    // página atrás do modal. "close" dispara em toda saída — Cancelar, X,
    // fundo, Esc e o fechamento programático depois do envio —, então a trava
    // sai daqui, num lugar só, em vez de repetida em cada botão.
    modal.addEventListener("close", () => {
        unlockPageScroll();
    });
}

/* =========================================================================
   Formulário

   Mesmo desenho de js/pages/login.js: campo vazio vira aria-invalid +
   .field__error, botão de envio ganha .is-loading durante o fetch.
   ========================================================================= */

const FORM_FIELDS = [
    { id: "record-date", empty: "Informe a data do lançamento." },
    { id: "record-unit", empty: "Selecione a unidade." },
    { id: "record-type", empty: "Selecione o tipo de resíduo." },
    { id: "record-weight", empty: "Informe o peso em kg." },
];

function setFieldError(id, message) {
    const input = document.getElementById(id);
    const target = document.querySelector(`[data-error-for="${id}"]`);

    if (input) input.setAttribute("aria-invalid", "true");
    if (target) {
        target.textContent = message;
        target.hidden = false;
    }
}

function clearFormErrors() {
    FORM_FIELDS.forEach(({ id }) => {
        const input = document.getElementById(id);
        const target = document.querySelector(`[data-error-for="${id}"]`);

        if (input) input.removeAttribute("aria-invalid");
        if (target) {
            target.hidden = true;
            target.textContent = "";
        }
    });
}

function validateForm() {
    return FORM_FIELDS.filter(({ id }) => {
        const input = document.getElementById(id);
        return !input || input.value.trim() === "";
    });
}

function resetForm() {
    const form = document.querySelector("[data-record-form]");
    if (!form) return;

    form.reset();
    clearFormErrors();
}

/**
 * Preenche o formulário com um lançamento existente, para edição.
 *
 * weight_kg chega como Decimal (string, ver nota no topo do arquivo);
 * Number() normaliza antes de escrever no campo — um <input type="number">
 * só aceita ponto decimal, nunca vírgula, então formatWeight() (que devolve
 * texto em pt-BR) não serve aqui.
 */
function fillFormForEdit(record) {
    document.getElementById("record-date").value = toIsoDate(record.record_date);
    document.getElementById("record-unit").value = String(record.unit_id);
    document.getElementById("record-type").value = String(record.waste_type_id);
    document.getElementById("record-weight").value = String(Number(record.weight_kg));
    document.getElementById("record-observations").value = record.observations ?? "";

    clearFormErrors();
}

function setLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.classList.toggle("is-loading", loading);
}

async function readJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function initForm() {
    const form = document.querySelector("[data-record-form]");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearFormErrors();

        const invalid = validateForm();
        if (invalid.length) {
            invalid.forEach((field) => setFieldError(field.id, field.empty));
            document.getElementById(invalid[0].id)?.focus();
            return;
        }

        if (!currentUser) {
            notifyError("Não foi possível identificar o usuário logado. Atualize a página e tente de novo.");
            return;
        }

        const submit = form.querySelector("[data-record-submit]");
        setLoading(submit, true);

        const isEditing = editingRecordId !== null;

        const payload = {
            record_date: document.getElementById("record-date").value,
            unit_id: Number(document.getElementById("record-unit").value),
            waste_type_id: Number(document.getElementById("record-type").value),
            weight_kg: Number(document.getElementById("record-weight").value),
            observations: document.getElementById("record-observations").value.trim(),
        };

        // POST espera inserted_by no corpo — o endpoint de criação ainda não
        // lê o usuário da sessão (ver nota de segurança sobre essa rota).
        // PUT não: updated_by e updated_at são calculados no servidor a
        // partir da sessão autenticada, e é o id do lançamento que entra no
        // lugar, para o backend saber qual registro alterar.
        if (isEditing) {
            payload.id = editingRecordId;
        } else {
            payload.inserted_by = currentUser.id;
        }

        try {
            const response = await fetch(API.wasteRecords, {
                method: isEditing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(payload),
            });

            const successStatus = isEditing ? 200 : 201;

            if (response.status === successStatus) {
                const modal = document.querySelector("[data-record-modal]");
                if (modal) closeModal(modal);
                notifySuccess(isEditing ? "Lançamento atualizado com sucesso." : "Lançamento registrado com sucesso.");
                await loadRecords();
                return;
            }

            const data = await readJson(response);
            notifyError(data?.message ?? "Não foi possível salvar o lançamento.");
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

    try {
        const [user] = await Promise.all([loadCurrentUser(), loadReferenceData()]);
        if (!user) return; // já redirecionou para o login

        currentUser = user;

        const dateInput = document.getElementById("record-date");
        if (dateInput) dateInput.min = MIN_RECORD_DATE;

        const trigger = document.querySelector("[data-new-record-trigger]");
        if (trigger) trigger.disabled = false;

        await loadRecords();
        showState("content");
    } catch (error) {
        showState("error");
        console.error(error);
    }
}

function init() {
    initConsentModal();
    initModal();
    initFilters();
    initForm();
    loadPage();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
