/**
 * Shell das telas do dashboard: sidebar, menu da conta e usuário logado.
 *
 * Carregado por toda página que herda de templates/base.html, antes do script
 * próprio dela — é o que evita repetir sidebar e menu de conta em cada arquivo.
 *
 * Contrato com o HTML (data-*):
 *   [data-app]              raiz que recebe .is-collapsed / .is-sidebar-open
 *   [data-sidebar]          a barra lateral
 *   [data-sidebar-scrim]    fundo escuro do menu em overlay
 *   [data-sidebar-toggle]   botão de abrir/recolher, na topbar
 *   [data-dropdown]         menu da conta
 *     [data-dropdown-trigger]  gatilho, com aria-expanded
 *     [data-dropdown-menu]     painel, controlado pelo atributo hidden
 *   [data-user-initials]    iniciais do avatar
 *   [data-user-name]        nome; aparece mais de uma vez na página
 *   [data-user-role]        perfil de acesso
 *   [data-user-email]       e-mail, dentro do menu
 *   [data-logout]           botão de encerrar a sessão
 */

import { roleLabel } from '../utils/roles.js';

/** Espelha o breakpoint do CSS: abaixo disso a sidebar vira overlay. */
const BREAKPOINT_OVERLAY = 1024;
const STORAGE_KEY = 'ui.sidebar.collapsed';

const isOverlayMode = () => window.innerWidth < BREAKPOINT_OVERLAY;

const app = document.querySelector('[data-app]');

/* =========================================================================
   Sidebar
   Desktop: recolhe para a faixa de ícones, e a preferência fica guardada.
   Mobile:  abre em overlay, com fundo escuro clicável.
   ========================================================================= */

function initSidebar() {
  if (!app) return null;

  const sidebar = document.querySelector('[data-sidebar]');
  const scrim = document.querySelector('[data-sidebar-scrim]');
  const toggle = document.querySelector('[data-sidebar-toggle]');

  const isOpen = () => app.classList.contains('is-sidebar-open');

  function open() {
    app.classList.add('is-sidebar-open');
    if (scrim) scrim.hidden = false;
    toggle?.setAttribute('aria-expanded', 'true');
  }

  function close({ returnFocus = false } = {}) {
    app.classList.remove('is-sidebar-open');
    if (scrim) scrim.hidden = true;
    toggle?.setAttribute('aria-expanded', 'false');
    if (returnFocus) toggle?.focus();
  }

  function toggleCollapsed() {
    const collapsed = app.classList.toggle('is-collapsed');
    toggle?.setAttribute('aria-expanded', String(!collapsed));
    // Storage pode estar bloqueado (navegação privada); a preferência
    // simplesmente não persiste, e nada quebra.
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
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

    if (stored === '1') {
      app.classList.add('is-collapsed');
      toggle?.setAttribute('aria-expanded', 'false');
    } else if (!isOverlayMode()) {
      toggle?.setAttribute('aria-expanded', 'true');
    }
  }

  toggle?.addEventListener('click', () => {
    if (!isOverlayMode()) {
      toggleCollapsed();
      return;
    }
    if (isOpen()) close();
    else open();
  });

  scrim?.addEventListener('click', () => close({ returnFocus: true }));

  // Navegar para outra tela fecha o overlay antes da troca de página.
  sidebar?.addEventListener('click', (event) => {
    if (event.target.closest('a') && isOverlayMode()) close();
  });

  // Voltar para o desktop não pode deixar o overlay pendurado.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
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
  const dropdowns = [...document.querySelectorAll('[data-dropdown]')]
    .map((root) => {
      const trigger = root.querySelector('[data-dropdown-trigger]');
      const menu = root.querySelector('[data-dropdown-menu]');
      if (!trigger || !menu) return null;

      const isOpen = () => !menu.hidden;

      function open() {
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        // :not(:disabled) porque item desabilitado não recebe foco: mirar nele
        // deixaria o foco preso no gatilho sem que o menu ganhasse a navegação.
        menu.querySelector('a, button:not(:disabled)')?.focus();
      }

      function close({ returnFocus = false } = {}) {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
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
    dropdown.trigger.addEventListener('click', () => {
      if (dropdown.isOpen()) {
        dropdown.close();
        return;
      }
      closeAll(dropdown);
      dropdown.open();
    });

    // Seta para baixo no gatilho abre e já entra no menu.
    dropdown.trigger.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' || dropdown.isOpen()) return;
      event.preventDefault();
      dropdown.trigger.click();
    });

    // Tab para fora fecha: menu aberto sem foco dentro é armadilha de teclado.
    dropdown.menu.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!dropdown.root.contains(document.activeElement)) dropdown.close();
      }, 0);
    });
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-dropdown]')) return;
    closeAll(null);
  });

  return dropdowns;
}

/* =========================================================================
   Usuário autenticado

   Autenticação e autorização ainda não existem no backend. Enquanto isso, os
   campos da topbar ficam em "Carregando..." — que é o que o HTML já traz — e
   nenhuma chamada é feita: bater num endpoint inexistente só produziria um 404
   no console e um rótulo de erro na tela de todo mundo.

   Quando a sessão existir, basta ligar AUTH_ENABLED; a leitura da resposta já
   está escrita abaixo e o contrato de data-* no HTML não muda.
   ========================================================================= */

/** Vire para true quando GET CURRENT_USER_URL existir. */
const AUTH_ENABLED = false;

const CURRENT_USER_URL = '/dashboard-esg/api/v1/users/me';

async function initCurrentUser() {
  const nameTargets = document.querySelectorAll('[data-user-name]');
  const initialsTarget = document.querySelector('[data-user-initials]');
  const emailTarget = document.querySelector('[data-user-email]');
  const roleTarget = document.querySelector('[data-user-role]');

  // Tela sem topbar (futuro login) não tem nada a preencher.
  if (!nameTargets.length && !initialsTarget && !emailTarget) return;

  if (!AUTH_ENABLED) return;

  try {
    const response = await fetch(CURRENT_USER_URL, { credentials: 'same-origin' });

    if (!response.ok) throw new Error(`A API respondeu ${response.status}`);

    const user = await response.json();

    // textContent, e não innerHTML: nome e e-mail vêm do cadastro e não podem
    // ser interpretados como marcação.
    nameTargets.forEach((target) => {
      target.textContent = user.name;
    });

    if (initialsTarget) initialsTarget.textContent = user.initials;
    // O e-mail é opcional no cadastro; sem ele a linha fica vazia.
    if (emailTarget) emailTarget.textContent = user.email ?? '';
    if (roleTarget) roleTarget.textContent = roleLabel(user.role);
  } catch (error) {
    // Sem toast de propósito: o shell roda em toda página, e uma falha aqui
    // viraria ruído em cada navegação. O rótulo cai para algo neutro em vez de
    // ficar preso em "Carregando..." ou de inventar um nome.
    nameTargets.forEach((target) => {
      target.textContent = 'Conta';
    });

    if (initialsTarget) initialsTarget.textContent = '';
    if (roleTarget) roleTarget.textContent = '';
    if (emailTarget) emailTarget.textContent = '';

    console.error(error);
  }
}

/**
 * Encerrar a sessão depende de uma rota que ainda não existe. Até lá o botão
 * fica desabilitado: um "Sair" que não faz nada ao ser clicado é pior que um
 * "Sair" visivelmente indisponível — o usuário acharia que saiu.
 *
 * TODO: criar js/auth/logout.js (POST /auth/logout, redireciona para o login
 * só depois da resposta) e chamar initLogout() aqui quando AUTH_ENABLED for
 * true.
 */
function initLogout() {
  if (AUTH_ENABLED) return;

  document.querySelectorAll('[data-logout]').forEach((button) => {
    button.disabled = true;
    button.title = 'Disponível quando o login estiver ativo.';
  });
}

/* =========================================================================
   Ligação
   ========================================================================= */

const sidebar = initSidebar();
const dropdowns = initDropdowns();

initCurrentUser();
initLogout();

// Esc fecha a camada mais alta: o menu da conta antes da sidebar, para que
// fechar o menu não feche junto a navegação em overlay.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  const openDropdown = dropdowns.find((dropdown) => dropdown.isOpen());
  if (openDropdown) {
    openDropdown.close({ returnFocus: true });
    return;
  }

  if (sidebar?.isOpen()) sidebar.close({ returnFocus: true });
});
