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
import { syncFilterClear } from "../utils/filters.js";
import { buildEditButton } from "../utils/table_actions.js";
import { lockPageScroll, unlockPageScroll } from "../utils/scroll_lock.js";
import {
    initCpfMask,
    initNipNumberMask,
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

    populateSelect(document.querySelector("[data-filter-nature]"), natures, "Todas");
    populateSelect(document.querySelector("[data-filter-status]"), statusList, "Todos");
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
 * Tom do badge para um status específico, quando o prefixo não basta.
 *
 * "Aguardando Abertura de Processo" não é mais uma espera: a mediação falhou e
 * a ANS vai abrir processo administrativo sancionador. Sair na mesma cor de
 * "Aguardando Classificação" escondia, no meio da tabela, justamente a linha que
 * precisa de ação — por isso ele é o único vermelho da tela.
 *
 * A chave é o nome porque `name` é UNIQUE em nip_status e os ids são GENERATED
 * ALWAYS AS IDENTITY: dependem da ordem do seed e não sobrevivem a uma recarga
 * da base. Mesmo motivo do STATUS_RESOLVIDAS em services/nip_dashboard_service.py.
 *
 * Isto é cor, e não regra de negócio: quais status contam como resolvida
 * continua sendo assunto único daquele arquivo, e não se decide por aqui.
 */
const STATUS_TONE_BY_NAME = {
    "aguardando abertura de processo": "badge--danger-solid",
};

/**
 * As duas situações em que todo status cadastrado começa.
 *
 * São o que a pílula colorida mostra. O resto do nome é o motivo, e vai como
 * texto secundário — ver splitStatusName() logo abaixo.
 */
const STATUS_SITUATIONS = ["Finalizada", "Aguardando"];

/**
 * Quebra o nome do status em situação e motivo.
 *
 * Os nomes cadastrados são frases inteiras ("Aguardando Classificação da
 * Demanda NIP - RN388", "Finalizada por Inexistência de Indício de Infração").
 * Uma frase dessas dentro de uma pílula, na largura de uma coluna de tabela,
 * quebra em três linhas e fica espremida — a pílula acompanha o texto, então
 * ela cresce junto e vira um bloco de cor sem forma.
 *
 * Todas elas, porém, têm a mesma estrutura: a situação ("Finalizada" ou
 * "Aguardando") e o motivo. Separando as duas, a pílula fica com uma palavra
 * curta — sempre de uma linha, sempre do mesmo tamanho — e o motivo desce como
 * texto normal, que quebra em linhas sem parecer apertado. Nada é escondido.
 *
 * O separador entre uma parte e outra varia no cadastro: " - " em "Finalizada -
 * NIP Resolvida (RVE)", " por " em "Finalizada por Duplicidade", e nada em
 * "Aguardando Abertura de Processo". Ele sai fora para o motivo não começar com
 * um traço solto nem com uma preposição sem sujeito.
 *
 * Um status que não comece por nenhuma das duas situações vai inteiro para a
 * pílula, sem motivo: é melhor uma pílula larga e correta do que um recorte
 * inventado em cima de um nome que este código não conhece.
 */
function splitStatusName(name) {
    const text = String(name ?? "").trim();
    if (!text) return { situation: "—", reason: "" };

    const situation = STATUS_SITUATIONS.find(
        (word) => text.toLowerCase().startsWith(word.toLowerCase()),
    );

    if (!situation) return { situation: text, reason: "" };

    // O \b depois de "por" importa: sem ele um status que começasse com
    // "Portabilidade" perderia as três primeiras letras.
    const reason = text
        .slice(situation.length)
        .replace(/^\s*(?:[-–—]|por\b)\s*/i, "")
        .trim();

    return { situation, reason };
}

/**
 * Status: pílula com a situação, motivo em texto secundário abaixo.
 *
 * Os status cadastrados se dividem em "Finalizada ..." e "Aguardando ...":
 * finalizada é verde (nada mais a fazer), aguardando é laranja (a NIP está
 * aberta e corre prazo). As cores são sólidas, e não pastel: a tabela é longa
 * e o status precisa ser achado de relance, sem procurar linha por linha. É
 * justamente por isso que só a situação fica dentro da cor — é ela que se lê
 * de relance; o motivo é o que se lê depois de achar a linha.
 *
 * A ordem da decisão importa — o nome exato ganha do prefixo, senão
 * "Aguardando Abertura de Processo" cairia no laranja de toda espera. Qualquer
 * status novo que não caia nos dois prefixos fica neutro em vez de escolher uma
 * cor errada. O tom continua sendo decidido pelo nome inteiro, e não pela
 * situação recortada: é o nome inteiro que distingue as duas esperas.
 */
function buildStatusCell(nip) {
    const td = document.createElement("td");
    td.dataset.label = "Status";

    const name = String(nip.status_name ?? "");
    const key = name.trim().toLowerCase();

    let tone = "badge--neutral";
    if (STATUS_TONE_BY_NAME[key]) tone = STATUS_TONE_BY_NAME[key];
    else if (key.startsWith("finalizada")) tone = "badge--success-solid";
    else if (key.startsWith("aguardando")) tone = "badge--warning-solid";

    const { situation, reason } = splitStatusName(name);

    const wrap = document.createElement("span");
    wrap.className = "status-cell";
    // O nome inteiro, sem o recorte, para quem quiser conferir o status exato
    // como ele está cadastrado.
    wrap.title = name;

    const badge = document.createElement("span");
    badge.className = `badge ${tone}`;
    badge.textContent = situation;
    wrap.appendChild(badge);

    if (reason) {
        const detail = document.createElement("span");
        detail.className = "table__secondary";
        detail.textContent = reason;
        wrap.appendChild(detail);
    }

    td.appendChild(wrap);
    return td;
}

function buildActionsCell(nip) {
    const td = document.createElement("td");
    td.dataset.label = "Ações";
    td.className = "table__actions";

    // O aria-label descreve a linha, não a coluna: numa lista de vinte NIP's,
    // vinte botões chamados só "Editar" não dizem qual é qual para quem navega
    // por teclado ou leitor de tela. O número da NIP é o código de identificação
    // único da notificação, então é ele que nomeia a linha — o protocolo também
    // é único, mas é um código interno de atendimento, e não como a NIP é
    // chamada por quem a acompanha.
    td.appendChild(buildEditButton({
        label: `Editar NIP ${nip.nip_number ?? nip.protocol_code} — ${nip.beneficiary_name}`,
        // Closure sobre a NIP da própria linha: os dados para preencher o
        // formulário já estão em mãos, sem precisar buscar de novo por id.
        onClick: () => startEditingNip(nip),
    }));

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
    // O nome completo do status entra num atributo pelo mesmo motivo do CPF: a
    // celula mostra a situacao e o motivo em dois elementos, e o textContent da
    // linha cola os dois sem o separador ("Finalizada" + "Duplicidade"), o que
    // faria a busca por "Finalizada por Duplicidade" nao achar nada.
    tr.dataset.statusName = String(nip.status_name ?? "");

    // O número da NIP abre a linha e leva o destaque que era da data: é o código
    // que identifica a notificação, e é por ele que a linha é procurada.
    tr.appendChild(buildCell({
        label: "Nº da NIP",
        text: nip.nip_number ?? "—",
        innerClass: "table__primary tabular",
    }));
    tr.appendChild(buildCell({
        label: "Notificação",
        text: formatDate(nip.notification_date),
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

/** Texto da linha + o CPF só com dígitos e o nome completo do status. */
const rowSearchText = (row) => `${row.textContent} ${row.dataset.cpfDigits} ${row.dataset.statusName}`.toLowerCase();

// Um lugar só dizendo quais campos filtram esta tela: applyFilters() lê os
// valores, initFilters() escuta as mudanças e syncFilterClear() conta quantos
// estão valendo. Uma lista por função faria as três divergirem no dia em que
// um filtro novo entrar.
const FILTER_SELECTORS = [
    "[data-filter-search]",
    "[data-filter-nature]",
    "[data-filter-status]",
    "[data-filter-date-from]",
    "[data-filter-date-to]",
];

const filterInputs = () => FILTER_SELECTORS.map((selector) => document.querySelector(selector));

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
   Modal de edição
   ========================================================================= */

function openNipModal() {
    const modal = document.querySelector("[data-nip-modal]");
    if (!modal) return;

    modal.showModal();
    lockPageScroll();
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
    unlockPageScroll();
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
        unlockPageScroll();
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
    initNipNumberMask();
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
