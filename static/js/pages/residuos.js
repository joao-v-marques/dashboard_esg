/**
 * Lançamento de Resíduos: tabela de lançamentos com filtro no cliente e modal
 * de cadastro.
 *
 * Contrato com o HTML (data-*):
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
 *   [data-record-modal]        <dialog> do formulário
 *     [data-record-modal-close]  fecha (botão X e Cancelar, os dois têm o atributo)
 *     [data-record-form]         formulário; o submit é interceptado
 *     [data-form-unit] / [data-form-type]   selects do formulário
 *     [data-record-submit]       botão de salvar
 *   [data-error-for="<id>"]    mensagem de erro do campo de mesmo id
 *
 * O peso e as datas que a API devolve podem chegar como texto (Decimal vira
 * string no jsonify do Flask) ou em formato HTTP em vez de ISO — ver
 * models/waste_records_model.py. parseWeight() e as funções de data abaixo
 * tratam os dois formatos; o ideal é corrigir na origem (to_dict()), mas a
 * tela funciona sem depender disso.
 */

import { API, PAGES } from "../utils/routes.js";
import { notifySuccess, notifyError } from "../utils/notyf.js";

// Espelha MIN_RECORD_DATE em services/waste_records_service.py. Só orienta o
// campo de data no formulário; quem decide de verdade é o servidor.
const MIN_RECORD_DATE = "2026-07-01";

let currentUser = null;
let allRecords = [];
let units = [];
let wasteTypes = [];
let wasteTypesById = {};

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

    populateSelect(document.querySelector("[data-filter-unit]"), units, "Todas as unidades");
    populateSelect(document.querySelector("[data-filter-type]"), wasteTypes, "Todos os tipos");
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

function buildActionsCell() {
    const td = document.createElement("td");
    td.dataset.label = "Ações";
    td.className = "table__actions";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-link";
    button.textContent = "Editar";
    // A lógica de edição (PUT) ainda não existe — botão presente e
    // desabilitado, não ausente: o lugar dele na tela já fica reservado.
    button.disabled = true;
    button.title = "Disponível quando a edição de lançamentos existir.";

    td.appendChild(button);
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
    tr.appendChild(buildActionsCell());

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
}

function initFilters() {
    const inputs = [
        "[data-filter-search]",
        "[data-filter-unit]",
        "[data-filter-type]",
        "[data-filter-date-from]",
        "[data-filter-date-to]",
    ].map((selector) => document.querySelector(selector));

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
    });
}

/* =========================================================================
   Modal de novo lançamento
   ========================================================================= */

function initModal() {
    const modal = document.querySelector("[data-record-modal]");
    const trigger = document.querySelector("[data-new-record-trigger]");
    if (!modal) return;

    trigger?.addEventListener("click", () => {
        resetForm();
        modal.showModal();
        document.body.classList.add("no-scroll");
    });

    document.querySelectorAll("[data-record-modal-close]").forEach((button) => {
        button.addEventListener("click", () => modal.close());
    });

    // <dialog> não fecha ao clicar fora sozinho — só o clique no próprio
    // elemento (o backdrop), nunca num filho, chega até aqui.
    modal.addEventListener("click", (event) => {
        if (event.target === modal) modal.close();
    });

    // showModal() bloqueia interação com o fundo, mas não trava a rolagem da
    // página atrás do modal. "close" dispara em toda saída — Cancelar, X,
    // fundo, Esc e o fechamento programático depois do envio —, então a trava
    // sai daqui, num lugar só, em vez de repetida em cada botão.
    modal.addEventListener("close", () => {
        document.body.classList.remove("no-scroll");
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

        // inserted_by vai no corpo porque é o que o endpoint espera hoje
        // (routes/waste_records_controller.py não lê o usuário da sessão) —
        // ver a nota de segurança sobre essa rota não exigir autenticação.
        const payload = {
            record_date: document.getElementById("record-date").value,
            unit_id: Number(document.getElementById("record-unit").value),
            waste_type_id: Number(document.getElementById("record-type").value),
            weight_kg: Number(document.getElementById("record-weight").value),
            observations: document.getElementById("record-observations").value.trim(),
            inserted_by: currentUser.id,
        };

        try {
            const response = await fetch(API.wasteRecords, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(payload),
            });

            if (response.status === 201) {
                document.querySelector("[data-record-modal]")?.close();
                notifySuccess("Lançamento registrado com sucesso.");
                await loadRecords();
                return;
            }

            // O controller devolve toda falha como 500 hoje, inclusive
            // validação de negócio (data fora do intervalo permitido, por
            // exemplo) — por isso o tratamento não distingue por status,
            // só usa a mensagem que o servidor mandar.
            const data = await readJson(response);
            notifyError(data?.message ?? "Não foi possível registrar o lançamento.");
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
