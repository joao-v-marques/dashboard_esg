/**
 * Shell das telas do dashboard: topbar, sidebar, menu da conta e usuário logado.
 *
 * Este arquivo é o shell inteiro — a marcação e o comportamento. Sem template
 * engine, um shell escrito à mão em cada HTML divergiria de uma tela para outra
 * em poucas semanas (topbar com um item a menos aqui, sidebar desatualizada
 * ali); mantendo-o em um módulo, acrescentar um item de navegação continua sendo
 * editar um arquivo só.
 *
 * O que cada página precisa trazer no HTML são apenas os contêineres vazios do
 * layout — eles já têm altura e largura pelo CSS, então preenchê-los depois não
 * desloca o conteúdo:
 *
 *   <header class="topbar" data-topbar></header>
 *   <aside class="sidebar on-inverse" id="sidebar" data-sidebar></aside>
 *
 * Contrato com o HTML (data-*):
 *   [data-app]              raiz que recebe .is-collapsed / .is-sidebar-open
 *   [data-topbar]           contêiner da topbar, preenchido aqui
 *   [data-sidebar]          contêiner da barra lateral, preenchido aqui
 *   [data-sidebar-scrim]    fundo escuro do menu em overlay
 *
 * Criados por este módulo dentro dos contêineres acima:
 *   [data-sidebar-toggle]   botão de abrir/recolher, na topbar
 *   [data-dropdown]         menu da conta
 *     [data-dropdown-trigger]  gatilho, com aria-expanded
 *     [data-dropdown-menu]     painel, controlado pelo atributo hidden
 *   [data-user-initials]    iniciais do avatar
 *   [data-user-role]        perfil de acesso
 *   [data-user-email]       e-mail, dentro do menu
 *   [data-logout]           botão de encerrar a sessão
 *
 * [data-user-name] aparece na topbar e também pode aparecer no conteúdo da
 * página (a saudação da home, por exemplo): a escrita é feita em todas as
 * ocorrências.
 */

import { roleLabel } from "../utils/roles.js";
import { API, PAGES, isCurrentPage } from "../utils/routes.js";

/* =========================================================================
   Marcação do shell

   Strings fixas, escritas aqui e não vindas de fora: innerHTML com texto de
   API ou do usuário é XSS, mas marcação constante do próprio código é só
   marcação. Toda escrita de dado (nome, e-mail, perfil) continua em
   textContent, mais abaixo.
   ========================================================================= */

/**
 * Itens da navegação principal, na ordem em que aparecem.
 * Acrescentar uma tela ao menu é acrescentar uma entrada aqui.
 */
const NAV_ITEMS = [
    {
        href: PAGES.home,
        label: "Início",
        icon: `
            <svg class="nav__icon" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m3 8.5 7-5.5 7 5.5V16a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1V8.5Z"
                      stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>`,
    },
    {
        href: PAGES.dashboard,
        label: "Dashboard",
        icon: `
            <svg class="nav__icon" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M3 17h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M6 17v-5M10 17V6M14 17v-8" stroke="currentColor" stroke-width="1.5"
                      stroke-linecap="round"/>
            </svg>`,
    },
    // TODO: os demais itens entram aqui conforme as telas forem criadas.
];

/** Selo modular 4×4 — puramente decorativo, por isso aria-hidden no contêiner. */
const SEAL_CELLS = "<span></span>".repeat(16);

/**
 * Item da navegação.
 *
 * A tela atual leva `is-active` e `aria-current="page"` — os dois, não só um:
 * a classe é o destaque visual, o aria é o que o leitor de tela anuncia. Qual
 * é a tela atual sai da própria URL, então nenhuma página precisa se declarar.
 */
function navItemMarkup(item) {
    const current = isCurrentPage(item.href);

    return `
        <li>
            <a class="nav__link${current ? " is-active" : ""}"
               href="${item.href}"${current ? ' aria-current="page"' : ""}>
                ${item.icon}
                <span class="nav__label">${item.label}</span>
            </a>
        </li>`;
}

// TODO: trocar pela marca definitiva da aplicação quando existir.
const TOPBAR_MARKUP = `
    <div class="topbar__lead">
        <button type="button"
                class="btn-icon"
                data-sidebar-toggle
                aria-controls="sidebar"
                aria-expanded="false">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.75"
                      stroke-linecap="round"/>
            </svg>
            <span class="visually-hidden">Abrir ou fechar o menu de navegação</span>
        </button>

        <a class="brand" href="${PAGES.home}">
            <span class="brand__mark" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect width="28" height="28" rx="8" fill="currentColor"/>
                    <rect x="6" y="6" width="6" height="6" rx="1.5" fill="var(--color-accent)"/>
                    <rect x="16" y="6" width="6" height="6" rx="1.5" fill="var(--color-primary)"/>
                    <rect x="6" y="16" width="6" height="6" rx="1.5" fill="var(--color-primary)"/>
                    <rect x="16" y="16" width="6" height="6" rx="1.5" fill="var(--color-primary-subtle)"/>
                </svg>
            </span>
            <span class="brand__name">Acompanhamento ESG</span>
        </a>
    </div>

    <div class="topbar__actions">
        <div class="dropdown" data-dropdown>
            <!-- Autenticação ainda não existe: os campos ficam em "Carregando..."
                 até o shell ter de onde buscar o usuário (ver AUTH_ENABLED). -->
            <button type="button" class="user-trigger" data-dropdown-trigger
                    aria-expanded="false" aria-haspopup="true" aria-controls="menu-usuario">
                <span class="avatar" aria-hidden="true" data-user-initials></span>
                <span class="user-trigger__identity">
                    <span class="user-trigger__name" data-user-name>Carregando...</span>
                    <span class="user-trigger__role" data-user-role>Carregando...</span>
                </span>
                <svg class="user-trigger__caret" width="16" height="16" viewBox="0 0 16 16" fill="none"
                     aria-hidden="true">
                    <path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                          stroke-linejoin="round"/>
                </svg>
                <span class="visually-hidden">Abrir menu da conta</span>
            </button>

            <div class="dropdown__menu" id="menu-usuario" data-dropdown-menu hidden>
                <div class="dropdown__header">
                    <div class="dropdown__name" data-user-name>Carregando...</div>
                    <div class="dropdown__meta" data-user-email>Carregando...</div>
                </div>
                <hr class="dropdown__separator">
                <!-- Nasce habilitado e é desabilitado por initLogout() enquanto não
                     houver rota de logout: botão que não faz nada ao ser clicado é
                     pior que botão visivelmente indisponível. -->
                <button type="button" class="dropdown__item dropdown__item--danger" data-logout>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M6.5 2.5H3.5A1 1 0 0 0 2.5 3.5v9a1 1 0 0 0 1 1h3" stroke="currentColor"
                              stroke-width="1.4" stroke-linecap="round"/>
                        <path d="M10 5.5 12.5 8 10 10.5M12.5 8H6" stroke="currentColor" stroke-width="1.4"
                              stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Sair
                </button>
            </div>
        </div>
    </div>`;

const SIDEBAR_MARKUP = `
    <nav class="sidebar__nav" aria-label="Navegação principal">
        <p class="sidebar__section">Operação</p>
        <ul class="nav">
            ${NAV_ITEMS.map(navItemMarkup).join("")}
        </ul>
    </nav>

    <div class="sidebar__footer">
        <div class="sidebar__seal seal" aria-hidden="true">${SEAL_CELLS}</div>
        <p class="sidebar__footer-text">
            Acompanhamento dos indicadores ambientais, sociais e de governança.
        </p>
    </div>`;

/**
 * Preenche os contêineres do shell.
 *
 * Página sem topbar ou sem sidebar (o login, por exemplo) simplesmente não traz
 * o contêiner, e nada é escrito — o mesmo módulo serve às duas situações.
 */
function renderShell() {
    const topbar = document.querySelector("[data-topbar]");
    const sidebar = document.querySelector("[data-sidebar]");

    if (topbar) topbar.innerHTML = TOPBAR_MARKUP;
    if (sidebar) sidebar.innerHTML = SIDEBAR_MARKUP;
}

/** Espelha o breakpoint do CSS: abaixo disso a sidebar vira overlay. */
const BREAKPOINT_OVERLAY = 1024;
const STORAGE_KEY = "ui.sidebar.collapsed";

const isOverlayMode = () => window.innerWidth < BREAKPOINT_OVERLAY;

/* =========================================================================
   Sidebar
   Desktop: recolhe para a faixa de ícones, e a preferência fica guardada.
   Mobile:  abre em overlay, com fundo escuro clicável.
   ========================================================================= */

function initSidebar() {
    const app = document.querySelector("[data-app]");
    if (!app) return null;

    const sidebar = document.querySelector("[data-sidebar]");
    const scrim = document.querySelector("[data-sidebar-scrim]");
    const toggle = document.querySelector("[data-sidebar-toggle]");

    const isOpen = () => app.classList.contains("is-sidebar-open");

    function open() {
        app.classList.add("is-sidebar-open");
        if (scrim) scrim.hidden = false;
        toggle?.setAttribute("aria-expanded", "true");
    }

    function close({ returnFocus = false } = {}) {
        app.classList.remove("is-sidebar-open");
        if (scrim) scrim.hidden = true;
        toggle?.setAttribute("aria-expanded", "false");
        if (returnFocus) toggle?.focus();
    }

    function toggleCollapsed() {
        const collapsed = app.classList.toggle("is-collapsed");
        toggle?.setAttribute("aria-expanded", String(!collapsed));
        // Storage pode estar bloqueado (navegação privada); a preferência
        // simplesmente não persiste, e nada quebra.
        try {
            window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
        } catch {
            /* segue sem persistir */
        }
    }

    function restoreCollapsed() {
        let stored = null;
        try {
            stored = window.localStorage.getItem(STORAGE_KEY);
        } catch {
            stored = null;
        }

        if (stored === "1") {
            app.classList.add("is-collapsed");
            toggle?.setAttribute("aria-expanded", "false");
        } else if (!isOverlayMode()) {
            toggle?.setAttribute("aria-expanded", "true");
        }
    }

    toggle?.addEventListener("click", () => {
        if (!isOverlayMode()) {
            toggleCollapsed();
            return;
        }
        if (isOpen()) close();
        else open();
    });

    scrim?.addEventListener("click", () => close({ returnFocus: true }));

    // Navegar para outra tela fecha o overlay antes da troca de página.
    sidebar?.addEventListener("click", (event) => {
        if (event.target.closest("a") && isOverlayMode()) close();
    });

    // Voltar para o desktop não pode deixar o overlay pendurado.
    let resizeTimer = null;
    window.addEventListener("resize", () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            if (!isOverlayMode()) close();
        }, 120);
    });

    restoreCollapsed();
    return { isOpen, close };
}

/* =========================================================================
   Menu da conta
   ========================================================================= */

function initDropdowns() {
    const dropdowns = [...document.querySelectorAll("[data-dropdown]")]
        .map((root) => {
            const trigger = root.querySelector("[data-dropdown-trigger]");
            const menu = root.querySelector("[data-dropdown-menu]");
            if (!trigger || !menu) return null;

            const isOpen = () => !menu.hidden;

            function open() {
                menu.hidden = false;
                trigger.setAttribute("aria-expanded", "true");
                // :not(:disabled) porque item desabilitado não recebe foco: mirar nele
                // deixaria o foco preso no gatilho sem que o menu ganhasse a navegação.
                menu.querySelector("a, button:not(:disabled)")?.focus();
            }

            function close({ returnFocus = false } = {}) {
                menu.hidden = true;
                trigger.setAttribute("aria-expanded", "false");
                if (returnFocus) trigger.focus();
            }

            return { root, trigger, menu, isOpen, open, close };
        })
        .filter(Boolean);

    if (!dropdowns.length) return dropdowns;

    const closeAll = (except) => {
        dropdowns.forEach((item) => {
            if (item !== except && item.isOpen()) item.close();
        });
    };

    dropdowns.forEach((dropdown) => {
        dropdown.trigger.addEventListener("click", () => {
            if (dropdown.isOpen()) {
                dropdown.close();
                return;
            }
            closeAll(dropdown);
            dropdown.open();
        });

        // Seta para baixo no gatilho abre e já entra no menu.
        dropdown.trigger.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowDown" || dropdown.isOpen()) return;
            event.preventDefault();
            dropdown.trigger.click();
        });

        // Tab para fora fecha: menu aberto sem foco dentro é armadilha de teclado.
        dropdown.menu.addEventListener("focusout", () => {
            window.setTimeout(() => {
                if (!dropdown.root.contains(document.activeElement)) dropdown.close();
            }, 0);
        });
    });

    document.addEventListener("click", (event) => {
        if (event.target.closest("[data-dropdown]")) return;
        closeAll(null);
    });

    return dropdowns;
}

/* =========================================================================
   Usuário autenticado

   GET API.currentUser devolve { id, username, name, initials, email, role,
   sector }. O cookie de sessão é HttpOnly: o JS não o lê nem o guarda, só o
   manda junto com credentials: "same-origin".

   AUTH_ENABLED continua como desligamento de emergência — com false, os campos
   ficam em "Carregando..." e nenhuma chamada é feita.
   ========================================================================= */

const AUTH_ENABLED = true;

async function initCurrentUser() {
    const nameTargets = document.querySelectorAll("[data-user-name]");
    const initialsTarget = document.querySelector("[data-user-initials]");
    const emailTarget = document.querySelector("[data-user-email]");
    const roleTarget = document.querySelector("[data-user-role]");

    // Tela sem topbar (o login) não tem nada a preencher.
    if (!nameTargets.length && !initialsTarget && !emailTarget) return;

    if (!AUTH_ENABLED) return;

    try {
        const response = await fetch(API.currentUser, { credentials: "same-origin" });

        // A página é protegida no servidor, então chegar aqui sem sessão só
        // acontece se ela vencer entre o carregamento e esta chamada. Cair no
        // rótulo neutro deixaria a pessoa numa tela que não responde mais.
        if (response.status === 401) {
            window.location.replace(`${PAGES.login}?reason=session-expired`);
            return;
        }

        if (!response.ok) throw new Error(`A API respondeu ${response.status}`);

        const user = await response.json();

        // textContent, e não innerHTML: nome e e-mail vêm do cadastro e não podem
        // ser interpretados como marcação.
        nameTargets.forEach((target) => {
            target.textContent = user.name;
        });

        if (initialsTarget) initialsTarget.textContent = user.initials;
        // O e-mail é opcional no cadastro; sem ele a linha fica vazia.
        if (emailTarget) emailTarget.textContent = user.email ?? "";
        if (roleTarget) roleTarget.textContent = roleLabel(user.role);
    } catch (error) {
        // Sem toast de propósito: o shell roda em toda página, e uma falha aqui
        // viraria ruído em cada navegação. O rótulo cai para algo neutro em vez de
        // ficar preso em "Carregando..." ou de inventar um nome.
        nameTargets.forEach((target) => {
            target.textContent = "Conta";
        });

        if (initialsTarget) initialsTarget.textContent = "";
        if (roleTarget) roleTarget.textContent = "";
        if (emailTarget) emailTarget.textContent = "";

        console.error(error);
    }
}

/**
 * Encerrar a sessão.
 *
 * Mora aqui, e não em js/auth/logout.js como dizia o TODO antigo: o botão é da
 * topbar, que este módulo desenha, e a leitura do usuário logado já está ao
 * lado.
 *
 * Com AUTH_ENABLED em false o botão fica desabilitado — um "Sair" que não faz
 * nada ao ser clicado é pior que um "Sair" visivelmente indisponível, porque o
 * usuário acharia que saiu.
 */
function initLogout() {
    const buttons = document.querySelectorAll("[data-logout]");

    if (!AUTH_ENABLED) {
        buttons.forEach((button) => {
            button.disabled = true;
            button.title = "Disponível quando o login estiver ativo.";
        });
        return;
    }

    buttons.forEach((button) => {
        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                // Só sair da tela depois da resposta: navegar antes deixaria o
                // cookie de pé se a chamada falhasse, e a pessoa voltaria ao
                // painel achando que tinha saído.
                const response = await fetch(API.logout, {
                    method: "POST",
                    credentials: "same-origin",
                });

                if (!response.ok) throw new Error(`A API respondeu ${response.status}`);

                // replace, e não assign: o painel sai da história do navegador,
                // e o "voltar" depois de sair não devolve a tela de dentro.
                window.location.replace(`${PAGES.login}?reason=signed-out`);
            } catch (error) {
                button.disabled = false;
                console.error(error);
            }
        });
    });
}

/* =========================================================================
   Teclado
   ========================================================================= */

/**
 * Esc fecha a camada mais alta: o menu da conta antes da sidebar, para que
 * fechar o menu não feche junto a navegação em overlay.
 */
function initEscape(sidebar, dropdowns) {
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;

        const openDropdown = dropdowns.find((dropdown) => dropdown.isOpen());
        if (openDropdown) {
            openDropdown.close({ returnFocus: true });
            return;
        }

        if (sidebar?.isOpen()) sidebar.close({ returnFocus: true });
    });
}

/* =========================================================================
   Ligação

   renderShell() vem primeiro, sempre: todo o resto procura elementos que só
   existem depois que a marcação foi escrita.
   ========================================================================= */

function init() {
    renderShell();

    const sidebar = initSidebar();
    const dropdowns = initDropdowns();

    initCurrentUser();
    initLogout();
    initEscape(sidebar, dropdowns);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
