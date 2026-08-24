/**
 * Cadastros do Jurídico: mantém as listas que alimentam os formulários de
 * processo judicial.
 *
 * A tela é dirigida pelo registro CATALOGS logo abaixo. Hoje ele tem quatro
 * entradas — objetos do processo, trâmites, status e chances de perda — e a
 * última lista do Jurídico (órgãos julgadores) entra como irmã assim que
 * ganhar POST/PUT/DELETE no backend. Hoje ela só tem GET.
 *
 * Nenhuma das entradas depois da primeira precisou tocar em uma função sequer
 * deste arquivo, que é o que a regra abaixo existe para garantir.
 *
 * REGRA QUE PROTEGE ESSA ESTRUTURA: nenhuma função daqui pode olhar
 * `catalog.key` para decidir o que fazer. Se alguma precisar perguntar "qual
 * lista é essa?", o que falta é um campo no registro — não um if. É o que
 * mantém acrescentar uma lista em uma entrada, e não em uma varredura pelo
 * arquivo.
 *
 * O motor vive aqui dentro, e não em utils/: por enquanto há uma tela de
 * cadastros só. Ele sobe para utils/catalog_crud.js quando a segunda existir
 * (NIP's ou Resíduos) — que é quando dá para ver o que de fato é comum.
 *
 * Contrato com o HTML (data-*):
 *   [data-catalog-nav]          coluna lateral de listas, preenchida aqui
 *   [data-catalog-loading]      cartão de carregamento
 *   [data-catalog-content]      cartão com a barra de filtros e a tabela
 *   [data-catalog-error]        cartão de falha ao carregar
 *   [data-catalog-title]        título do cartão, o rótulo da lista aberta
 *   [data-catalog-column-label] <th> da primeira coluna
 *   [data-catalog-body]         <tbody> que recebe as linhas
 *   [data-catalog-empty-row]    linha fixa de "nenhum resultado"
 *   [data-catalog-empty-message]  texto dessa linha
 *   [data-new-item-trigger]     botão de cadastrar; [data-new-item-label] é o texto
 *   [data-filter-search] / [data-filter-status]   filtros no cliente
 *   [data-filter-clear] / [data-filter-count]     tratados por utils/filters.js
 *   [data-item-modal]           <dialog> do formulário
 *     [data-item-modal-title] / [data-item-modal-subtitle] / [data-item-name-label]
 *     [data-item-submit]        botão de enviar; o texto troca com o modo
 *     [data-item-modal-close]   fecha (X e Cancelar, os dois têm o atributo)
 *     [data-item-form]          formulário; o submit é interceptado
 *   [data-confirm-modal]        <dialog> da confirmação de desativar
 *     [data-confirm-title] / [data-confirm-text] / [data-confirm-accept]
 *     [data-confirm-modal-close]  fecha (X e Cancelar)
 *   [data-error-for="<id>"]     mensagem de erro do campo de mesmo id
 *
 * Ao contrário de controle_nips.js, aqui `editingItemId` pode ser null: o
 * mesmo modal cadastra e edita, e é o null que diz qual dos dois o próximo
 * envio vai fazer.
 */

import { API, PAGES } from "../utils/routes.js";
import { notifySuccess, notifyError, notifyWarning } from "../utils/notyf.js";
import { syncFilterClear } from "../utils/filters.js";
import { buildEditButton, buildDeactivateButton, buildReactivateButton } from "../utils/table_actions.js";

/* =========================================================================
   O registro

   Cada entrada descreve uma lista inteira: onde ela mora na API e como ela se
   chama na tela. Nenhuma descreve colunas — as cinco tabelas de apoio do
   Jurídico têm o mesmo formato {id, name, is_active}, e inventar um descritor
   de campos hoje seria abstração sem segundo caso.

   Os textos são frases inteiras, e várias delas são funções que recebem o
   nome do item. É de propósito: montar "Já existe ${artigo} ${substantivo}"
   obrigaria a carregar gênero e regência de cada lista ("o objeto", "a
   natureza", "a chance de perda") e ainda assim sairia robótico. Uma frase
   escrita por extenso custa uma linha e se lê como português.
   ========================================================================= */

const CATALOGS = [
    {
        // Vai para ?lista= na URL. Em pt-BR porque é endereço de tela, mesma
        // regra de /processos/cadastros — só os endpoints da API são em inglês.
        key: "objetos",
        group: "Jurídico",
        navLabel: "Objetos do processo",
        title: "Objetos do processo",
        columnLabel: "Objeto",
        searchPlaceholder: "Buscar pelo nome do objeto",
        // Base da API. Tudo é derivado daqui: POST no endpoint, PUT e DELETE em
        // <endpoint>/<id>, PATCH em <endpoint>/<id>/reactivate.
        endpoint: API.subjectMatters,
        // Espelha a validação de SubjectMattersService.create.
        maxLength: 255,
        texts: {
            newButton: "Novo objeto",
            createTitle: "Novo objeto",
            createSubtitle: "Ele passa a aparecer ao cadastrar um processo.",
            editTitle: "Editar objeto",
            editSubtitle: "O novo nome vale também para os processos que já usam este objeto.",
            fieldLabel: "Nome do objeto",
            submitCreate: "Cadastrar objeto",
            submitEdit: "Salvar alterações",
            created: (name) => `Objeto "${name}" cadastrado.`,
            updated: (name) => `Objeto "${name}" atualizado.`,
            reactivatedOnCreate: (name) =>
                `"${name}" já existia como objeto inativo e foi reativado. Ele volta a aparecer ao cadastrar um processo.`,
            deactivated: (name) => `Objeto "${name}" desativado.`,
            reactivated: (name) => `Objeto "${name}" reativado.`,
            emptyAll: "Nenhum objeto cadastrado ainda.",
            emptyFiltered: "Nenhum objeto para os filtros selecionados.",
            confirmDeactivateTitle: "Desativar objeto",
            confirmDeactivateText: (name) =>
                `"${name}" deixa de aparecer ao cadastrar um processo. Os processos que já usam esse objeto continuam como estão — nada é apagado.`,
            rowEditLabel: (name) => `Editar objeto ${name}`,
            rowDeactivateLabel: (name) => `Desativar objeto ${name}`,
            rowReactivateLabel: (name) => `Reativar objeto ${name}`,
        },
    },
    {
        key: "tramites",
        group: "Jurídico",
        navLabel: "Trâmites do processo",
        title: "Trâmites do processo",
        // "Trâmite" e não "Estágio processual": este é o cabeçalho de uma
        // coluna, e é a palavra que controle_processos.html já usa na coluna do
        // mesmo campo. O nome por extenso fica nos rótulos de formulário, onde
        // há largura para ele.
        columnLabel: "Trâmite",
        searchPlaceholder: "Buscar pelo nome do trâmite",
        endpoint: API.proceedingStages,
        // Espelha a validação de ProceedingStageService.create.
        maxLength: 255,
        texts: {
            newButton: "Novo trâmite",
            createTitle: "Novo trâmite",
            createSubtitle: "Ele passa a aparecer ao cadastrar um processo.",
            editTitle: "Editar trâmite",
            editSubtitle: "O novo nome vale também para os processos que já usam este trâmite.",
            fieldLabel: "Nome do trâmite",
            submitCreate: "Cadastrar trâmite",
            submitEdit: "Salvar alterações",
            created: (name) => `Trâmite "${name}" cadastrado.`,
            updated: (name) => `Trâmite "${name}" atualizado.`,
            reactivatedOnCreate: (name) =>
                `"${name}" já existia como trâmite inativo e foi reativado. Ele volta a aparecer ao cadastrar um processo.`,
            deactivated: (name) => `Trâmite "${name}" desativado.`,
            reactivated: (name) => `Trâmite "${name}" reativado.`,
            emptyAll: "Nenhum trâmite cadastrado ainda.",
            emptyFiltered: "Nenhum trâmite para os filtros selecionados.",
            confirmDeactivateTitle: "Desativar trâmite",
            confirmDeactivateText: (name) =>
                `"${name}" deixa de aparecer ao cadastrar um processo. Os processos que já usam esse trâmite continuam como estão — nada é apagado.`,
            rowEditLabel: (name) => `Editar trâmite ${name}`,
            rowDeactivateLabel: (name) => `Desativar trâmite ${name}`,
            rowReactivateLabel: (name) => `Reativar trâmite ${name}`,
        },
    },
    {
        key: "status",
        group: "Jurídico",
        navLabel: "Status do processo",
        title: "Status do processo",
        columnLabel: "Status",
        searchPlaceholder: "Buscar pelo nome do status",
        endpoint: API.lawsuitStatus,
        // Espelha a validação de LawsuitStatusService.create.
        maxLength: 255,
        // As frases desta lista falam em "processo ou recurso" onde as outras
        // duas falam só em processo: lawsuit_status é a única das cinco que é
        // FK de duas tabelas (lawsuits e lawsuit_appeals), então desativar um
        // status some dos dois formulários, não de um só.
        texts: {
            newButton: "Novo status",
            createTitle: "Novo status",
            createSubtitle: "Ele passa a aparecer ao cadastrar um processo ou um recurso.",
            editTitle: "Editar status",
            editSubtitle: "O novo nome vale também para os processos e recursos que já usam este status.",
            fieldLabel: "Nome do status",
            submitCreate: "Cadastrar status",
            submitEdit: "Salvar alterações",
            created: (name) => `Status "${name}" cadastrado.`,
            updated: (name) => `Status "${name}" atualizado.`,
            reactivatedOnCreate: (name) =>
                `"${name}" já existia como status inativo e foi reativado. Ele volta a aparecer ao cadastrar um processo ou um recurso.`,
            deactivated: (name) => `Status "${name}" desativado.`,
            reactivated: (name) => `Status "${name}" reativado.`,
            emptyAll: "Nenhum status cadastrado ainda.",
            emptyFiltered: "Nenhum status para os filtros selecionados.",
            confirmDeactivateTitle: "Desativar status",
            confirmDeactivateText: (name) =>
                `"${name}" deixa de aparecer ao cadastrar um processo ou um recurso. Os processos e recursos que já usam esse status continuam como estão — nada é apagado.`,
            rowEditLabel: (name) => `Editar status ${name}`,
            rowDeactivateLabel: (name) => `Desativar status ${name}`,
            rowReactivateLabel: (name) => `Reativar status ${name}`,
        },
    },

    {
        key: "chances-de-perda",
        group: "Jurídico",
        // Sem "do processo" no fim, ao contrário das três acima: "Chances de
        // perda" já é inequívoco sozinho, e o sufixo aqui seria impreciso — a
        // lista serve a processos e recursos, não só a processos.
        navLabel: "Chances de perda",
        title: "Chances de perda",
        columnLabel: "Chance de perda",
        searchPlaceholder: "Buscar pelo nome da chance de perda",
        endpoint: API.lossProbabilities,
        // Espelha a validação de LossProbabilityService.create.
        maxLength: 255,
        // Primeira lista feminina do registro — é o caso que o comentário no
        // topo do array previa. Como o status, é FK de lawsuits e de
        // lawsuit_appeals, então as frases falam em "processo ou recurso".
        texts: {
            newButton: "Nova chance de perda",
            createTitle: "Nova chance de perda",
            createSubtitle: "Ela passa a aparecer ao cadastrar um processo ou um recurso.",
            editTitle: "Editar chance de perda",
            editSubtitle: "O novo nome vale também para os processos e recursos que já usam esta chance de perda.",
            fieldLabel: "Nome da chance de perda",
            submitCreate: "Cadastrar chance de perda",
            submitEdit: "Salvar alterações",
            created: (name) => `Chance de perda "${name}" cadastrada.`,
            updated: (name) => `Chance de perda "${name}" atualizada.`,
            reactivatedOnCreate: (name) =>
                `"${name}" já existia como chance de perda inativa e foi reativada. Ela volta a aparecer ao cadastrar um processo ou um recurso.`,
            deactivated: (name) => `Chance de perda "${name}" desativada.`,
            reactivated: (name) => `Chance de perda "${name}" reativada.`,
            emptyAll: "Nenhuma chance de perda cadastrada ainda.",
            emptyFiltered: "Nenhuma chance de perda para os filtros selecionados.",
            confirmDeactivateTitle: "Desativar chance de perda",
            confirmDeactivateText: (name) =>
                `"${name}" deixa de aparecer ao cadastrar um processo ou um recurso. Os processos e recursos que já usam essa chance de perda continuam como estão — nada é apagado.`,
            rowEditLabel: (name) => `Editar chance de perda ${name}`,
            rowDeactivateLabel: (name) => `Desativar chance de perda ${name}`,
            rowReactivateLabel: (name) => `Reativar chance de perda ${name}`,
        },
    },
];

/* =========================================================================
   Estado
   ========================================================================= */

let currentCatalog = CATALOGS[0];
let allItems = [];
/** null = o próximo envio do formulário cadastra; um id = ele edita. */
let editingItemId = null;
/** O item que o modal de confirmação está prestes a desativar. */
let pendingDeactivation = null;

/* =========================================================================
   Estados da página
   ========================================================================= */

function getPageElements() {
    return {
        loading: document.querySelector("[data-catalog-loading]"),
        content: document.querySelector("[data-catalog-content]"),
        error: document.querySelector("[data-catalog-error]"),
    };
}

function showState(name) {
    Object.entries(getPageElements()).forEach(([key, element]) => {
        if (element) element.hidden = key !== name;
    });
}

/* =========================================================================
   Erros de campo

   Locais, e não importados de utils/nip_form.js: o clearFormErrors de lá
   percorre a lista de campos da NIP. Aqui há um campo só, e as três funções
   somam poucas linhas — elas sobem para um util compartilhado junto com o
   resto do motor, quando a segunda tela de cadastros existir.
   ========================================================================= */

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
    const input = document.getElementById("item-name");
    const target = document.querySelector('[data-error-for="item-name"]');

    if (input) input.removeAttribute("aria-invalid");
    if (target) {
        target.textContent = "";
        target.hidden = true;
    }
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

/** Sessão que venceu entre o carregamento da tela e esta chamada. */
function goToLogin() {
    window.location.replace(`${PAGES.login}?reason=session-expired`);
}

/* =========================================================================
   Coluna lateral

   Os itens são links comuns: trocar de lista recarrega a página, que lê
   ?lista= no boot. É uma navegação como qualquer outra do app, e sem History
   API não há URL e tela para manter em sincronia.
   ========================================================================= */

function renderCatalogNav() {
    const nav = document.querySelector("[data-catalog-nav]");
    if (!nav) return;

    // Agrupa preservando a ordem de CATALOGS — o Map mantém a ordem de inserção.
    const groups = new Map();
    CATALOGS.forEach((catalog) => {
        if (!groups.has(catalog.group)) groups.set(catalog.group, []);
        groups.get(catalog.group).push(catalog);
    });

    const fragment = document.createDocumentFragment();

    groups.forEach((catalogs, groupName) => {
        const group = document.createElement("div");
        group.className = "catalog-nav__group";

        const title = document.createElement("p");
        title.className = "eyebrow";
        title.textContent = groupName;
        group.appendChild(title);

        const list = document.createElement("ul");
        list.className = "catalog-nav__list";

        catalogs.forEach((catalog) => {
            const item = document.createElement("li");
            const link = document.createElement("a");
            const current = catalog.key === currentCatalog.key;

            link.className = `catalog-nav__link${current ? " is-active" : ""}`;
            link.href = `${PAGES.lawsuitCatalogs}?lista=${encodeURIComponent(catalog.key)}`;
            link.textContent = catalog.navLabel;
            // A classe é o destaque visual; o aria é o que o leitor de tela
            // anuncia. Os dois, não só um.
            if (current) link.setAttribute("aria-current", "page");

            item.appendChild(link);
            list.appendChild(item);
        });

        group.appendChild(list);
        fragment.appendChild(group);
    });

    nav.replaceChildren(fragment);
}

/** Escreve na tela tudo que depende de qual lista está aberta. */
function applyCatalogTexts() {
    const { texts } = currentCatalog;

    const title = document.querySelector("[data-catalog-title]");
    const columnLabel = document.querySelector("[data-catalog-column-label]");
    const newLabel = document.querySelector("[data-new-item-label]");
    const search = document.querySelector("[data-filter-search]");
    const nameLabel = document.querySelector("[data-item-name-label]");
    const nameInput = document.getElementById("item-name");

    if (title) title.textContent = currentCatalog.title;
    if (columnLabel) columnLabel.textContent = currentCatalog.columnLabel;
    if (newLabel) newLabel.textContent = texts.newButton;
    if (search) search.placeholder = currentCatalog.searchPlaceholder;
    if (nameLabel) nameLabel.textContent = texts.fieldLabel;
    if (nameInput) nameInput.maxLength = currentCatalog.maxLength;
}

/* =========================================================================
   Carregamento
   ========================================================================= */

async function loadItems() {
    // include_inactive=true sempre: esta é a tela que gerencia as listas, e o
    // filtro de situação recorta no cliente o que já está carregado. O
    // controller só aceita "true" ou "1" — ver subject_matters_controller.py.
    const response = await fetch(`${currentCatalog.endpoint}?include_inactive=true`, {
        credentials: "same-origin",
    });

    if (response.status === 401) {
        goToLogin();
        return;
    }

    if (!response.ok) throw new Error(`A API respondeu ${response.status}`);

    const items = await response.json();

    allItems = items.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    renderTable();
}

/* =========================================================================
   Tabela

   DOM e textContent, nunca innerHTML com dado da API: o nome vem do que um
   colaborador digitou, e innerHTML aqui seria XSS armazenado.
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

function buildStatusCell(item) {
    const td = document.createElement("td");
    td.dataset.label = "Situação";

    const badge = document.createElement("span");
    badge.className = item.is_active ? "badge badge--success" : "badge badge--neutral";
    badge.textContent = item.is_active ? "Ativo" : "Inativo";

    td.appendChild(badge);
    return td;
}

function buildActionsCell(item) {
    const td = document.createElement("td");
    td.className = "table__actions";
    td.dataset.label = "Ações";

    const { texts } = currentCatalog;

    td.appendChild(buildEditButton({
        label: texts.rowEditLabel(item.name),
        onClick: () => startEditing(item),
    }));

    td.appendChild(item.is_active
        ? buildDeactivateButton({
            label: texts.rowDeactivateLabel(item.name),
            onClick: () => askToDeactivate(item),
        })
        : buildReactivateButton({
            label: texts.rowReactivateLabel(item.name),
            onClick: () => reactivateItem(item),
        }));

    return td;
}

function buildItemRow(item) {
    const tr = document.createElement("tr");
    tr.dataset.itemId = String(item.id);
    // O filtro de situação lê daqui, e não do badge: texto de tela é para ler,
    // não para o código voltar a interpretar.
    tr.dataset.isActive = String(Boolean(item.is_active));

    tr.appendChild(buildCell({
        label: currentCatalog.columnLabel,
        text: item.name,
        innerClass: "table__primary",
    }));
    tr.appendChild(buildStatusCell(item));
    tr.appendChild(buildActionsCell(item));

    return tr;
}

function renderTable() {
    const body = document.querySelector("[data-catalog-body]");
    const emptyRow = document.querySelector("[data-catalog-empty-row]");
    if (!body || !emptyRow) return;

    // tr[data-item-id] é o que distingue linha de dado da linha fixa de vazio.
    body.querySelectorAll("tr[data-item-id]").forEach((row) => row.remove());

    const fragment = document.createDocumentFragment();
    allItems.forEach((item) => fragment.appendChild(buildItemRow(item)));
    body.insertBefore(fragment, emptyRow);

    applyFilters();
}

/* =========================================================================
   Filtros — recorte no cliente, sobre as linhas já renderizadas
   ========================================================================= */

/** Um lugar só dizendo quais campos filtram esta tela. */
const FILTER_SELECTORS = ["[data-filter-search]", "[data-filter-status]"];

const filterInputs = () =>
    FILTER_SELECTORS.map((selector) => document.querySelector(selector)).filter(Boolean);

function applyFilters() {
    const body = document.querySelector("[data-catalog-body]");
    const emptyRow = document.querySelector("[data-catalog-empty-row]");
    const message = document.querySelector("[data-catalog-empty-message]");
    if (!body || !emptyRow) return;

    const [searchInput, statusInput] = filterInputs();
    const term = (searchInput?.value ?? "").trim().toLowerCase();
    const status = statusInput?.value ?? "";

    let visible = 0;

    body.querySelectorAll("tr[data-item-id]").forEach((row) => {
        const isActive = row.dataset.isActive === "true";

        const matchesTerm = term === "" || row.textContent.toLowerCase().includes(term);
        const matchesStatus =
            status === "" ||
            (status === "ativas" && isActive) ||
            (status === "inativas" && !isActive);

        const show = matchesTerm && matchesStatus;
        row.hidden = !show;
        if (show) visible += 1;
    });

    emptyRow.hidden = visible > 0;

    // Lista vazia e filtro que não achou nada são coisas diferentes, e dizer a
    // errada manda a pessoa procurar no lugar errado.
    if (message) {
        message.textContent = allItems.length === 0
            ? currentCatalog.texts.emptyAll
            : currentCatalog.texts.emptyFiltered;
    }

    syncFilterClear(filterInputs());
}

function initFilters() {
    const inputs = filterInputs();
    const clear = document.querySelector("[data-filter-clear]");

    inputs.forEach((input) => {
        const event = input.tagName === "SELECT" ? "change" : "input";
        input.addEventListener(event, applyFilters);
    });

    clear?.addEventListener("click", () => {
        inputs.forEach((input) => {
            input.value = "";
        });
        applyFilters();
        document.querySelector("[data-filter-search]")?.focus();
    });
}

/* =========================================================================
   Modais
   ========================================================================= */

function openModal(modal) {
    if (!modal) return;
    modal.showModal();
    document.body.classList.add("no-scroll");
}

/**
 * Fecha e devolve a rolagem da página.
 *
 * A trava some junto porque só um modal fica aberto por vez nesta tela: a
 * confirmação nasce da tabela, nunca de dentro do formulário. Se algum dia um
 * abrir o outro, esta função passa a precisar saber se ainda há dialog aberto.
 */
function closeModal(modal) {
    if (!modal) return;
    modal.close();
    document.body.classList.remove("no-scroll");
}

function setModalMode(mode) {
    const { texts } = currentCatalog;
    const creating = mode === "create";

    const title = document.querySelector("[data-item-modal-title]");
    const subtitle = document.querySelector("[data-item-modal-subtitle]");
    const submit = document.querySelector("[data-item-submit]");

    if (title) title.textContent = creating ? texts.createTitle : texts.editTitle;
    if (subtitle) subtitle.textContent = creating ? texts.createSubtitle : texts.editSubtitle;
    if (submit) submit.textContent = creating ? texts.submitCreate : texts.submitEdit;
}

function startCreating() {
    const input = document.getElementById("item-name");

    editingItemId = null;
    setModalMode("create");
    clearFormErrors();
    if (input) input.value = "";

    openModal(document.querySelector("[data-item-modal]"));
    input?.focus();
}

function startEditing(item) {
    const input = document.getElementById("item-name");

    editingItemId = item.id;
    setModalMode("edit");
    clearFormErrors();
    if (input) input.value = item.name;

    openModal(document.querySelector("[data-item-modal]"));
    // select() além do focus(): o campo já vem preenchido e a ação é renomear,
    // então digitar deve substituir, não emendar no fim.
    input?.focus();
    input?.select();
}

function initModals() {
    const itemModal = document.querySelector("[data-item-modal]");
    const confirmModal = document.querySelector("[data-confirm-modal]");

    document.querySelector("[data-new-item-trigger]")?.addEventListener("click", startCreating);

    document.querySelectorAll("[data-item-modal-close]").forEach((button) => {
        button.addEventListener("click", () => closeModal(itemModal));
    });

    document.querySelectorAll("[data-confirm-modal-close]").forEach((button) => {
        button.addEventListener("click", () => closeModal(confirmModal));
    });

    // <dialog> não fecha ao clicar fora sozinho — só o clique no próprio
    // elemento (o backdrop), nunca num filho, chega até aqui.
    [itemModal, confirmModal].forEach((modal) => {
        modal?.addEventListener("click", (event) => {
            if (event.target === modal) closeModal(modal);
        });
        // Esc fecha por conta do navegador e não passa por closeModal(); sem
        // isto a trava de rolagem ficaria de pé com a tela já liberada.
        modal?.addEventListener("close", () => {
            document.body.classList.remove("no-scroll");
        });
    });

    document.querySelector("[data-confirm-accept]")?.addEventListener("click", confirmDeactivation);
}

/* =========================================================================
   Foco depois de escrever

   Toda ação reconstrói o <tbody>, então o botão que abriu o modal deixa de
   existir e o <dialog> não tem para onde devolver o foco. Sem isto, quem
   navega por teclado volta ao topo da página a cada operação.
   ========================================================================= */

function focusRowAction(itemId) {
    const row = document.querySelector(`[data-catalog-body] tr[data-item-id="${itemId}"]`);
    const button = row?.querySelector(".table__actions button:last-child");

    // Linha escondida pelo filtro de situação não recebe foco — o botão de
    // cadastrar é o ponto de partida mais próximo.
    if (button && !row.hidden) button.focus();
    else document.querySelector("[data-new-item-trigger]")?.focus();
}

/* =========================================================================
   Formulário
   ========================================================================= */

function initForm() {
    const form = document.querySelector("[data-item-form]");
    const modal = document.querySelector("[data-item-modal]");
    const submit = document.querySelector("[data-item-submit]");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearFormErrors();

        const input = document.getElementById("item-name");
        // Mesma normalização de espaços do service (" ".join(name.split())),
        // para o que a pessoa vê ser exatamente o que o banco guarda.
        const name = (input?.value ?? "").trim().replace(/\s+/g, " ");

        if (!name) {
            setFieldError("item-name", `${currentCatalog.texts.fieldLabel} é obrigatório.`);
            input?.focus();
            return;
        }

        if (name.length > currentCatalog.maxLength) {
            setFieldError("item-name", `Use no máximo ${currentCatalog.maxLength} caracteres.`);
            input?.focus();
            return;
        }

        const isEditing = editingItemId !== null;
        setLoading(submit, true);

        try {
            const response = await fetch(
                isEditing ? `${currentCatalog.endpoint}/${editingItemId}` : currentCatalog.endpoint,
                {
                    method: isEditing ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "same-origin",
                    body: JSON.stringify({ name }),
                },
            );

            if (response.status === 401) {
                goToLogin();
                return;
            }

            if (!response.ok) {
                const data = await readJson(response);
                const message = data?.message ?? "Não foi possível salvar. Tente de novo.";

                // O toast diz o que aconteceu; o campo diz onde corrigir. Nome
                // repetido é erro do campo, e é o 400 que o backend devolve.
                notifyError(message);
                if (response.status === 400) {
                    setFieldError("item-name", message);
                    input?.focus();
                }
                return;
            }

            const saved = await response.json();

            // O create do service REATIVA quando o nome já existe inativo, em
            // vez de inserir — e responde 201 do mesmo jeito. allItems já traz
            // os inativos, então dá para saber qual dos dois aconteceu.
            const wasAlreadyKnown = !isEditing && allItems.some((item) => item.id === saved.id);

            closeModal(modal);

            if (isEditing) {
                notifySuccess(currentCatalog.texts.updated(saved.name));
            } else if (wasAlreadyKnown) {
                // notifyWarning, e não success: o resultado é bom, mas não é o
                // que a pessoa pediu, e ela precisa reparar na diferença.
                notifyWarning(currentCatalog.texts.reactivatedOnCreate(saved.name));
            } else {
                notifySuccess(currentCatalog.texts.created(saved.name));
            }

            // saved.name, e não o que foi digitado: get_by_name casa por
            // LOWER(TRIM(...)), então digitar "guarda de menor" reativa o
            // registro gravado como "Guarda de Menor" — e a grafia que fica é
            // a do banco.
            await loadItems();
            focusRowAction(saved.id);
        } catch (error) {
            notifyError("Não foi possível falar com o servidor. Verifique a conexão e tente de novo.");
            console.error(error);
        } finally {
            setLoading(submit, false);
        }
    });
}

/* =========================================================================
   Desativar e reativar
   ========================================================================= */

function askToDeactivate(item) {
    const { texts } = currentCatalog;

    const title = document.querySelector("[data-confirm-title]");
    const text = document.querySelector("[data-confirm-text]");

    pendingDeactivation = item;

    if (title) title.textContent = texts.confirmDeactivateTitle;
    if (text) text.textContent = texts.confirmDeactivateText(item.name);

    openModal(document.querySelector("[data-confirm-modal]"));
}

async function confirmDeactivation() {
    const item = pendingDeactivation;
    if (!item) return;

    const modal = document.querySelector("[data-confirm-modal]");
    const accept = document.querySelector("[data-confirm-accept]");

    // O diálogo fica aberto durante a requisição, com o botão travado: o
    // retorno aparece onde o olho está, e o duplo clique não dispara duas vezes.
    setLoading(accept, true);

    try {
        const response = await fetch(`${currentCatalog.endpoint}/${item.id}`, {
            method: "DELETE",
            credentials: "same-origin",
        });

        if (response.status === 401) {
            goToLogin();
            return;
        }

        if (!response.ok) {
            const data = await readJson(response);
            notifyError(data?.message ?? "Não foi possível desativar. Tente de novo.");
            return;
        }

        // Fechar antes de notificar: utils/notyf.js reparenta o contêiner do
        // toast para dentro do dialog aberto, e fechar depois levaria o aviso
        // junto para um elemento sem exibição.
        closeModal(modal);
        notifySuccess(currentCatalog.texts.deactivated(item.name));

        await loadItems();
        focusRowAction(item.id);
    } catch (error) {
        notifyError("Não foi possível falar com o servidor. Verifique a conexão e tente de novo.");
        console.error(error);
    } finally {
        setLoading(accept, false);
        pendingDeactivation = null;
    }
}

/**
 * Reativar não passa por confirmação: é a ação que desfaz, não a que tira algo
 * de circulação. Pedir confirmação para desfazer só acrescenta um clique entre
 * a pessoa e o conserto.
 */
async function reactivateItem(item) {
    try {
        const response = await fetch(`${currentCatalog.endpoint}/${item.id}/reactivate`, {
            method: "PATCH",
            credentials: "same-origin",
        });

        if (response.status === 401) {
            goToLogin();
            return;
        }

        if (!response.ok) {
            const data = await readJson(response);
            notifyError(data?.message ?? "Não foi possível reativar. Tente de novo.");
            return;
        }

        notifySuccess(currentCatalog.texts.reactivated(item.name));

        await loadItems();
        focusRowAction(item.id);
    } catch (error) {
        notifyError("Não foi possível falar com o servidor. Verifique a conexão e tente de novo.");
        console.error(error);
    }
}

/* =========================================================================
   Ligação
   ========================================================================= */

/**
 * Qual lista abrir.
 *
 * Valor ausente ou desconhecido cai na primeira do registro, em silêncio: URL
 * torta não é erro do usuário e não há nada que ele possa corrigir — mostrar
 * uma tela de erro por causa dela seria pior que abrir a lista padrão.
 */
function resolveCatalog() {
    const key = new URLSearchParams(window.location.search).get("lista");
    return CATALOGS.find((catalog) => catalog.key === key) ?? CATALOGS[0];
}

async function loadPage() {
    showState("loading");

    try {
        await loadItems();
        showState("content");
        // Só agora: o modal compara o nome digitado com a lista carregada para
        // saber se um cadastro foi na verdade uma reativação.
        const trigger = document.querySelector("[data-new-item-trigger]");
        if (trigger) trigger.disabled = false;
    } catch (error) {
        showState("error");
        console.error(error);
    }
}

function init() {
    currentCatalog = resolveCatalog();

    renderCatalogNav();
    applyCatalogTexts();
    initFilters();
    initModals();
    initForm();
    loadPage();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
