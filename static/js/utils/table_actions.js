/**
 * Ações da coluna "Ações", na parte que é igual em toda tela que tem tabela
 * (Resíduos, NIP's, Processos e os Cadastros do Jurídico).
 *
 * São botões só de ícone: numa tabela larga, a palavra "Editar" repetida em
 * cada linha vira uma coluna de texto que compete com o dado — que é o que a
 * pessoa veio ler. O ícone ocupa um quadrado fixo, a coluna encolhe e a linha
 * fica com uma âncora visual só.
 *
 * O que um ícone sozinho cobra em troca, e que está resolvido aqui:
 *   - nome acessível: `label` vira aria-label e diz de qual linha é a ação
 *     ("Editar NIP do protocolo 123"), não só "Editar" oito vezes seguidas;
 *   - rótulo visível: data-tooltip mostra a palavra no hover e no foco de
 *     teclado (ver [data-tooltip] em components.css);
 *   - alvo de toque: .btn-icon é 40x40, acima do mínimo da WCAG 2.5.8.
 *
 * O desenho do ícone mora aqui, num lugar só, no mesmo traço dos ícones do
 * menu (viewBox 20, currentColor, stroke 1.5) — ver NAV_ITEMS em shell.js.
 */

const EDIT_ICON = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
        <path d="M13.44 3.44a1.5 1.5 0 0 1 2.12 2.12L7.1 14.02l-2.83.71.71-2.83 8.46-8.46Z"
              stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="m11.9 4.98 2.12 2.12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;

// Balança da justiça — distingue "gerar recurso" de "editar" (o ícone acima)
// na mesma coluna de ações, caso uma tabela algum dia precise dos dois.
const APPEAL_ICON = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
        <path d="M10 3v14M6 17h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M10 5 4 6.5M10 5l6 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M4 6.5 1.5 11a2.75 2.75 0 0 0 5 0L4 6.5ZM16 6.5 13.5 11a2.75 2.75 0 0 0 5 0L16 6.5Z"
              stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;

// Círculo cortado — o sinal universal de "fora de circulação". Vale mais que
// uma lixeira aqui: a ação é soft delete, o registro continua no banco e volta
// com um clique; lixeira prometeria uma exclusão que não acontece.
const DEACTIVATE_ICON = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="6.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="m5.4 5.4 9.2 9.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;

// Seta em arco, no sentido anti-horário: desfazer o que o ícone acima fez.
const REACTIVATE_ICON = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
        <path d="M4.5 10a5.5 5.5 0 1 0 1.9-4.16" stroke="currentColor" stroke-width="1.5"
              stroke-linecap="round"/>
        <path d="M4 3.5v3h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
              stroke-linejoin="round"/>
    </svg>`;

/**
 * Botão de editar de uma linha.
 *
 * `label` é o nome acessível completo (o que o leitor de tela anuncia);
 * `tooltip` é a palavra curta que aparece na tela — o padrão "Editar" serve
 * para as duas tabelas de hoje.
 */
export function buildEditButton({ label, tooltip = "Editar", onClick }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-icon btn-icon--row";
    button.innerHTML = EDIT_ICON;
    button.setAttribute("aria-label", label);
    button.dataset.tooltip = tooltip;
    button.addEventListener("click", onClick);

    return button;
}

/**
 * Botão de gerar recurso de uma linha (tabela de processos).
 *
 * Mesmo molde de buildEditButton — só o ícone e a palavra padrão do tooltip
 * mudam, já que a ação não é editar a linha, é abrir o modal de um recurso
 * novo vinculado a ela.
 */
export function buildAppealButton({ label, tooltip = "Gerar Recurso", onClick }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-icon btn-icon--row";
    button.innerHTML = APPEAL_ICON;
    button.setAttribute("aria-label", label);
    button.dataset.tooltip = tooltip;
    button.addEventListener("click", onClick);

    return button;
}

/**
 * Botão de desativar de uma linha (soft delete).
 *
 * Duas funções, e não uma buildToggleActiveButton({ isActive }): este módulo
 * monta botão, não decide estado. Quem sabe se a linha está ativa é a página,
 * que já tem o registro em mãos — passar o booleano para cá só mudaria o lugar
 * do `if`, e de quebra faria o módulo conhecer o formato do dado.
 *
 * Sem variante de perigo no botão: a desativação é reversível e o vermelho
 * repetido em toda linha faria a tabela inteira parecer um alerta. O peso da
 * ação está no modal de confirmação, que é onde ela de fato acontece.
 */
export function buildDeactivateButton({ label, tooltip = "Desativar", onClick }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-icon btn-icon--row";
    button.innerHTML = DEACTIVATE_ICON;
    button.setAttribute("aria-label", label);
    button.dataset.tooltip = tooltip;
    button.addEventListener("click", onClick);

    return button;
}

/** Botão de reativar de uma linha — o par de buildDeactivateButton. */
export function buildReactivateButton({ label, tooltip = "Reativar", onClick }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-icon btn-icon--row";
    button.innerHTML = REACTIVATE_ICON;
    button.setAttribute("aria-label", label);
    button.dataset.tooltip = tooltip;
    button.addEventListener("click", onClick);

    return button;
}
