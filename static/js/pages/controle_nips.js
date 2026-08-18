/**
 * Controle de NIP's: tabela com filtro no cliente e modal de edição
 * (PUT /api/nips).
 *
 * Contrato com o HTML (data-*):
 *   [data-new-nip-link]      link para "Lançar NIP"; o href é escrito aqui
 *   [data-nips-loading]      esqueleto; estado inicial
 *   [data-nips-content]      card com toolbar + tabela; nasce hidden
 *   [data-nips-error]        recado de falha; nasce hidden
 *   [data-nips-body]         <tbody> onde as linhas são escritas
 *   [data-nips-empty-row]    linha fixa de "nenhum resultado"; só o texto e o
 *                            hidden dela mudam — nunca é removida do DOM
 *     [data-nips-empty-message]
 *   [data-filter-search]     busca livre (beneficiário, CPF, demanda, protocolo)
 *   [data-filter-nature] / [data-filter-status]   selects de filtro
 *   [data-filter-date-from] / [data-filter-date-to]
 *   [data-filter-clear]      limpa os cinco campos acima
 *   [data-nip-modal]         <dialog> do formulário de edição
 *     [data-nip-modal-close]   fecha (botão X e Cancelar, os dois têm o atributo)
 *     [data-nip-form]          formulário; o submit é interceptado
 *     [data-nip-submit]        botão de salvar
 *
 * A tela não cria NIP — o cadastro é a outra página do grupo. Por isso o
 * formulário aqui é só de edição, e editingNipId nunca é null durante um
 * envio: quem abre o modal é sempre o botão "Editar" de uma linha.
 *
 * Os campos do formulário (máscara de CPF, validação, leitura e escrita) vêm
 * de utils/nip_form.js, compartilhado com a tela de lançamento — os dois
 * formulários são o mesmo, com os mesmos ids.
 */

import { API, PAGES } from "../utils/routes.js";
import { notifySuccess, notifyError } from "../utils/notyf.js";
import {
    initCpfMask,
    populateSelect,
    formatCpf,
    toIsoDate,
    formatDate,
    clearFormErrors,
    setFieldError,
    validateForm,
    readFormPayload,
    fillForm,
    setLoading,
    readJson,
} from "../utils/nip_form.js";

let allNips = [];
let natures = [];
let statusList = [];

// Sempre preenchido enquanto o modal está aberto: só o "Editar" de uma linha
// abre esse formulário. Ver startEditingNip().
let editingNipId = null;

/* =========================================================================
   Estado da página (carregando / conteúdo / erro)
   ========================================================================= */

function getPageElements() {
    return {
        loading: document.querySelector("[data-nips-loading]"),
        content: document.querySelector("[data-nips-content]"),
        error: document.querySelector("[data-nips-error]"),
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

async function loadReferenceData() {
    const [naturesResponse, statusResponse] = await Promise.all([
        fetch(API.nipNatures, { credentials: "same-origin" }),
        fetch(API.nipStatus, { credentials: "same-origin" }),
    ]);

    if (!naturesResponse.ok || !statusResponse.ok) {
        throw new Error("Falha ao carregar naturezas ou status de NIP");
    }

    natures = await naturesResponse.json();
    statusList = await statusResponse.json();

    populateSelect(document.querySelector("[data-filter-nature]"), natures, "Todas as naturezas");
    populateSelect(document.querySelector("[data-filter-status]"), statusList, "Todos os status");
    populateSelect(document.querySelector("[data-form-nature]"), natures, "Selecione");
    populateSelect(document.querySelector("[data-form-status]"), statusList, "Selecione");
}

async function loadNips() {
    const response = await fetch(API.nips, { credentials: "same-origin" });

    if (response.status === 401) {
        window.location.replace(`${PAGES.login}?reason=session-expired`);
        return;
    }

    if (!response.ok) throw new Error(`A API respondeu ${response.status}`);

    allNips = await response.json();
    // Notificação mais recente primeiro — o endpoint não garante ordem nenhuma.
    allNips.sort((a, b) => toIsoDate(b.notification_date).localeCompare(toIsoDate(a.notification_date)));

    renderTable();
}

/* =========================================================================
   Tabela

   Construída via DOM + textContent, nunca innerHTML com dado da API: nome de
   beneficiário, descrição e afins vêm de cadastro livre, e innerHTML com esse
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

/** Nome do beneficiário com o CPF logo abaixo — duas colunas viram uma. */
function buildBeneficiaryCell(nip) {
    const td = document.createElement("td");
    td.dataset.label = "Beneficiário";

    const wrap = document.createElement("span");
    wrap.className = "beneficiary-cell";

    const name = document.createElement("span");
    name.textContent = nip.beneficiary_name;

    const cpf = document.createElement("span");
    cpf.className = "table__secondary tabular";
    cpf.textContent = formatCpf(nip.beneficiary_cpf);

    wrap.append(name, cpf);
    td.appendChild(wrap);
    return td;
}

/**
 * Natureza como badge.
 *
 * Assistencial é o caso que envolve atendimento ao beneficiário e recebe o
 * tom de atenção; o resto fica neutro. São só duas naturezas hoje
 * (V1__init_schema.sql), então a comparação é pelo nome mesmo — um id fixo no
 * JS quebraria se a tabela fosse recriada em outra ordem.
 */
function buildNatureCell(nip) {
    const td = document.createElement("td");
    td.dataset.label = "Natureza";

    const badge = document.createElement("span");
    const assistencial = String(nip.nature_name ?? "").toLowerCase().startsWith("assistencial");
    badge.className = `badge ${assistencial ? "badge--warning" : "badge--neutral"}`;
    badge.textContent = nip.nature_name ?? "—";

    td.appendChild(badge);
    return td;
}

/**
 * Status como badge.
 *
 * Os status cadastrados se dividem em "Finalizada ..." e "Aguardando ...":
 * finalizada é verde (nada mais a fazer), aguardando é azul de "em análise".
 * Qualquer status novo que não caia nesses dois prefixos fica neutro em vez de
 * escolher uma cor errada.
 */
function buildStatusCell(nip) {
    const td = document.createElement("td");
    td.dataset.label = "Status";

    const name = String(nip.status_name ?? "");
    let tone = "badge--neutral";
    if (name.toLowerCase().startsWith("finalizada")) tone = "badge--success";
    else if (name.toLowerCase().startsWith("aguardando")) tone = "badge--info";

    const badge = document.createElement("span");
    badge.className = `badge ${tone}`;
    badge.textContent = nip.status_name ?? "—";
    badge.title = nip.status_name ?? "";

    td.appendChild(badge);
    return td;
}

function buildActionsCell(nip) {
    const td = document.createElement("td");
    td.dataset.label = "Ações";
    td.className = "table__actions";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-link";
    button.textContent = "Editar";
    // Closure sobre a NIP da própria linha: os dados para preencher o
    // formulário já estão em mãos, sem precisar buscar de novo por id.
    button.addEventListener("click", () => startEditingNip(nip));

    td.appendChild(button);
    return td;
}

function buildNipRow(nip) {
    const tr = document.createElement("tr");
    tr.dataset.natureId = String(nip.nature_id);
    tr.dataset.statusId = String(nip.status_id);
    tr.dataset.notificationDate = toIsoDate(nip.notification_date);
    // O CPF sem pontuação entra num atributo à parte para a busca encontrar
    // tanto "12345678900" quanto "123.456.789-00" — só o formatado está no
    // texto da linha. Ver rowSearchText().
    tr.dataset.cpfDigits = String(nip.beneficiary_cpf ?? "");

    tr.appendChild(buildCell({
        label: "Notificação",
        text: formatDate(nip.notification_date),
        innerClass: "table__primary",
    }));
    tr.appendChild(buildCell({ label: "Demanda", text: nip.demand_code }));
    tr.appendChild(buildCell({ label: "Protocolo", text: nip.protocol_code }));
    tr.appendChild(buildBeneficiaryCell(nip));
    tr.appendChild(buildNatureCell(nip));
    tr.appendChild(buildStatusCell(nip));
    tr.appendChild(buildCell({ label: "Lançado por", text: nip.inserted_by_name ?? "—" }));
    tr.appendChild(buildActionsCell(nip));

    return tr;
}

function renderTable() {
    const body = document.querySelector("[data-nips-body]");
    if (!body) return;

    body.querySelectorAll("tr[data-notification-date]").forEach((row) => row.remove());

    const emptyRow = document.querySelector("[data-nips-empty-row]");
    const fragment = document.createDocumentFragment();
    allNips.forEach((nip) => fragment.appendChild(buildNipRow(nip)));

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

/** Texto da linha + o CPF só com dígitos, para o CPF ser buscável dos dois jeitos. */
const rowSearchText = (row) => `${row.textContent} ${row.dataset.cpfDigits}`.toLowerCase();

function applyFilters() {
    const body = document.querySelector("[data-nips-body]");
    const emptyRow = document.querySelector("[data-nips-empty-row]");
    if (!body) return;

    const rawSearch = (document.querySelector("[data-filter-search]")?.value ?? "").trim().toLowerCase();
    const natureId = document.querySelector("[data-filter-nature]")?.value ?? "";
    const statusId = document.querySelector("[data-filter-status]")?.value ?? "";
    const fromDate = document.querySelector("[data-filter-date-from]")?.value ?? "";
    const toDate = document.querySelector("[data-filter-date-to]")?.value ?? "";

    // Digitar o CPF pontuado tem de achar a linha mesmo comparando com os
    // dígitos crus, então a pontuação sai da busca quando o termo é só número.
    const search = /^[\d.\-\s]+$/.test(rawSearch) ? rawSearch.replace(/[.\-\s]/g, "") : rawSearch;

    let visibleCount = 0;

    body.querySelectorAll("tr[data-notification-date]").forEach((row) => {
        const matchesNature = !natureId || row.dataset.natureId === natureId;
        const matchesStatus = !statusId || row.dataset.statusId === statusId;
        const matchesFrom = !fromDate || row.dataset.notificationDate >= fromDate;
        const matchesTo = !toDate || row.dataset.notificationDate <= toDate;
        // Leitura de texto já renderizado, não escrita — não é o mesmo risco
        // do innerHTML acima.
        const matchesSearch = !search || rowSearchText(row).includes(search);

        const visible = matchesNature && matchesStatus && matchesFrom && matchesTo && matchesSearch;
        row.hidden = !visible;
        if (visible) visibleCount += 1;
    });

    if (emptyRow) {
        emptyRow.hidden = visibleCount !== 0;

        const message = document.querySelector("[data-nips-empty-message]");
        if (message) {
            message.textContent = allNips.length === 0
                ? 'Nenhuma NIP foi cadastrada ainda. Use o botão "Lançar NIP" para começar.'
                : "Nenhuma NIP encontrada para os filtros selecionados.";
        }
    }
}

function initFilters() {
    const inputs = [
        "[data-filter-search]",
        "[data-filter-nature]",
        "[data-filter-status]",
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
   Modal de edição
   ========================================================================= */

function openNipModal() {
    const modal = document.querySelector("[data-nip-modal]");
    if (!modal) return;

    modal.showModal();
    document.body.classList.add("no-scroll");
}

/**
 * Fecha e libera o scroll no mesmo golpe, em vez de fechar e esperar o evento
 * "close" fazer a segunda parte — em alguns ambientes esse evento não dispara
 * de forma confiável (é despachado como tarefa assíncrona pelo spec), então
 * depender só dele deixa o body preso em overflow: hidden. O listener de
 * "close" continua como reforço para o caminho do Esc, que não passa por aqui.
 */
function closeModal(modal) {
    modal.close();
    document.body.classList.remove("no-scroll");
}

/** Abre o modal já preenchido com uma NIP existente. */
function startEditingNip(nip) {
    editingNipId = nip.id;
    fillForm(nip);
    openNipModal();
}

function initModal() {
    const modal = document.querySelector("[data-nip-modal]");
    if (!modal) return;

    document.querySelectorAll("[data-nip-modal-close]").forEach((button) => {
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
        document.body.classList.remove("no-scroll");
    });
}

/* =========================================================================
   Formulário de edição
   ========================================================================= */

function initForm() {
    const form = document.querySelector("[data-nip-form]");
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

        if (editingNipId === null) {
            notifyError("Nenhuma NIP selecionada para edição. Feche o formulário e tente de novo.");
            return;
        }

        const submit = form.querySelector("[data-nip-submit]");
        setLoading(submit, true);

        // O id diz ao backend qual registro alterar; updated_by e updated_at
        // são calculados no servidor a partir da sessão autenticada, e por
        // isso não vão no corpo.
        const payload = { ...readFormPayload(), id: editingNipId };

        try {
            const response = await fetch(API.nips, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(payload),
            });

            if (response.status === 200) {
                const modal = document.querySelector("[data-nip-modal]");
                if (modal) closeModal(modal);
                notifySuccess("NIP atualizada com sucesso.");
                await loadNips();
                return;
            }

            if (response.status === 401) {
                window.location.replace(`${PAGES.login}?reason=session-expired`);
                return;
            }

            const data = await readJson(response);
            notifyError(data?.message ?? "Não foi possível salvar a NIP.");
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
    const newLink = document.querySelector("[data-new-nip-link]");
    if (newLink) newLink.href = PAGES.nipCreate;

    try {
        await loadReferenceData();
        await loadNips();
        showState("content");
    } catch (error) {
        showState("error");
        console.error(error);
    }
}

function init() {
    initCpfMask();
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
