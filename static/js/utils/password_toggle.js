/**
 * Botão de mostrar/ocultar senha.
 *
 * Mora em utils porque toda tela com campo de senha vai precisar do mesmo
 * comportamento — login hoje, troca de senha e cadastro de usuário depois — e
 * um botão reescrito por tela vira um que esquece o aria-pressed.
 *
 * Contrato com o HTML:
 *   [data-password-toggle]        o botão, dentro de .input-wrap
 *     aria-controls="<id>"        id do input que ele revela; é por aqui que o
 *                                 par é encontrado, e não pela estrutura do
 *                                 DOM: acoplar a classe de estilo quebraria o
 *                                 comportamento numa renomeação de CSS
 *     aria-pressed                estado, escrito aqui
 *     [data-icon="show"]          ícone de olho aberto (senha oculta)
 *     [data-icon="hide"]          ícone de olho cortado (senha à mostra)
 *     [data-password-toggle-label] texto acessível, trocado junto do ícone
 *
 * O rótulo diz a AÇÃO, não o estado ("Mostrar senha" quando ela está oculta):
 * é o que o usuário do leitor de tela precisa saber antes de apertar.
 */

/** Liga todos os botões de senha da página. */
export function initPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach(initToggle);
}

/**
 * Esconde pelo ATRIBUTO, e não pela propriedade `.hidden`.
 *
 * Os ícones daqui são <svg>, e `.hidden` só existe em HTMLElement: atribuí-la
 * a um elemento SVG cria uma propriedade solta no objeto, sem tocar no
 * atributo. O ícone continuaria na tela, e a leitura seguinte ainda devolveria
 * o valor inventado — erro que não aparece no console.
 */
function setHidden(element, hidden) {
    if (hidden) element.setAttribute("hidden", "");
    else element.removeAttribute("hidden");
}

function initToggle(button) {
    const input = document.getElementById(button.getAttribute("aria-controls"));
    if (!input) return;

    const showIcon = button.querySelector('[data-icon="show"]');
    const hideIcon = button.querySelector('[data-icon="hide"]');
    const label = button.querySelector("[data-password-toggle-label]");

    function apply(visible) {
        input.type = visible ? "text" : "password";
        button.setAttribute("aria-pressed", String(visible));

        if (showIcon) setHidden(showIcon, visible);
        if (hideIcon) setHidden(hideIcon, !visible);
        if (label) label.textContent = visible ? "Ocultar senha" : "Mostrar senha";
    }

    button.addEventListener("click", () => {
        apply(input.type === "password");
        // O foco fica no botão, e não volta para o campo: quem está conferindo
        // o que digitou costuma alternar duas vezes.
    });

    // Alinha o botão ao estado real do campo em vez de supor que o HTML nasceu
    // coerente — a senha começa oculta, sempre.
    apply(false);
}
