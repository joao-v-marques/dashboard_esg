/**
 * Tela de entrada: valida os campos, mostra o aviso que vem na URL e liga o
 * botão de revelar a senha.
 *
 * Contrato com o HTML (data-*):
 *   [data-login-form]        formulário; o submit é interceptado
 *   [data-login-submit]      botão de envio
 *   [data-login-notice]      aviso fixo do cartão, nasce com hidden
 *     [data-login-notice-text]  parágrafo onde o texto é escrito
 *     [data-notice-icon="…"]    um ícone por variante; só um fica visível
 *   [data-error-for="<campo>"]  mensagem de erro do campo de mesmo id
 *
 * Por id: username, password — são os nomes que vão no corpo da requisição,
 * e batem com as colunas de `users` no banco.
 *
 * O envio ao servidor ainda não existe. Enquanto LOGIN_ENABLED for false, o
 * formulário valida o que dá para validar aqui e para no aviso do cartão: um
 * botão que parece enviar e não envia é pior que um recado dizendo que a
 * entrada ainda não está de pé.
 */

import { initPasswordToggles } from "../utils/password_toggle.js";

/** Vire para true quando a rota de autenticação existir no backend. */
const LOGIN_ENABLED = false;

/* =========================================================================
   Aviso do cartão

   Duas origens: o motivo que o servidor manda na URL ao devolver o usuário
   para cá, e o retorno do próprio envio. Nesta tela o recado é fixo dentro do
   cartão, e não toast — é a exceção combinada em utils/notyf.js, porque o
   motivo precisa estar visível desde o primeiro instante, sem depender de o
   usuário ter visto um toast que já sumiu.
   ========================================================================= */

/**
 * Motivos aceitos em `?reason=`.
 *
 * A lista é fechada de propósito: o texto exibido sai daqui, nunca do valor
 * que veio na URL. Ecoar o parâmetro deixaria qualquer um montar um link de
 * login com a mensagem que quisesse — que é como se pede senha a quem confia
 * na tela certa.
 *
 * TODO: quem escrever o redirecionamento no backend deve usar estas chaves.
 */
const NOTICES = {
    "session-expired": {
        variant: "warning",
        text: "Sua sessão expirou. Entre de novo para continuar.",
    },
    "login-required": {
        variant: "info",
        text: "Entre para acessar o painel.",
    },
    "signed-out": {
        variant: "info",
        text: "Você saiu da sua conta.",
    },
};

/** Enquanto não há para onde enviar. Sai junto com o `if (!LOGIN_ENABLED)`. */
const NOTICE_PENDING = {
    variant: "info",
    text: "A entrada ainda não está disponível: a autenticação do sistema está em construção.",
};

const NOTICE_VARIANTS = ["info", "warning", "success", "danger"];

function showNotice({ variant, text }) {
    const notice = document.querySelector("[data-login-notice]");
    const target = notice?.querySelector("[data-login-notice-text]");
    if (!notice || !target) return;

    NOTICE_VARIANTS.forEach((name) => notice.classList.remove(`alert--${name}`));
    notice.classList.add(`alert--${variant}`);

    // Só um ícone por vez. Variante sem desenho próprio cai no de informação.
    const iconName = variant === "warning" ? "warning" : "info";
    notice.querySelectorAll("[data-notice-icon]").forEach((icon) => {
        icon.hidden = icon.dataset.noticeIcon !== iconName;
    });

    // textContent: o texto sai da lista fechada acima, e continua sem passar
    // por innerHTML nem por acidente.
    target.textContent = text;
    notice.hidden = false;
}

function hideNotice() {
    const notice = document.querySelector("[data-login-notice]");
    if (notice) notice.hidden = true;
}

function initNoticeFromUrl() {
    const reason = new URLSearchParams(window.location.search).get("reason");
    const notice = NOTICES[reason];

    // Motivo desconhecido não vira aviso: a tela abre limpa.
    if (notice) showNotice(notice);
}

/* =========================================================================
   Erros de campo

   O aria-invalid é o que o leitor de tela anuncia; a mensagem em
   .field__error é o que a pessoa lê. Os dois andam juntos — marcar só a borda
   deixa quem não enxerga sem saber onde está o problema.
   ========================================================================= */

/**
 * Campos do formulário, na ordem em que aparecem na tela — é a ordem em que o
 * foco procura o primeiro inválido.
 *
 * A validação aqui é só a que dá para fazer sem o servidor: campo em branco.
 * Usuário e senha corretos, só o backend sabe.
 */
const FIELDS = [
    { id: "username", empty: "Informe o usuário." },
    { id: "password", empty: "Informe a senha." },
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

function clearFieldErrors() {
    FIELDS.forEach(({ id }) => {
        const input = document.getElementById(id);
        const target = document.querySelector(`[data-error-for="${id}"]`);

        if (input) input.removeAttribute("aria-invalid");
        if (target) {
            target.hidden = true;
            target.textContent = "";
        }
    });
}

/** Devolve os campos inválidos, na ordem da tela. */
function validate() {
    return FIELDS.filter((field) => {
        const input = document.getElementById(field.id);
        // Espaço em branco é campo vazio: senha só de espaços seria recusada
        // pelo servidor de qualquer jeito, e o recado daqui chega antes.
        return !input || input.value.trim() === "";
    });
}

/* =========================================================================
   Envio
   ========================================================================= */

function initForm() {
    const form = document.querySelector("[data-login-form]");
    if (!form) return;

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        // Limpar o retorno anterior antes de tudo: erro da tentativa passada
        // ainda na tela, ao lado do resultado da nova, é o que faz o usuário
        // corrigir o campo errado.
        hideNotice();
        clearFieldErrors();

        const invalid = validate();

        if (invalid.length) {
            invalid.forEach((field) => setFieldError(field.id, field.empty));
            document.getElementById(invalid[0].id)?.focus();
            return;
        }

        if (!LOGIN_ENABLED) {
            showNotice(NOTICE_PENDING);
            return;
        }

        // TODO: envio. O handler passa a ser async e segue a sequência do
        // projeto:
        //   1. guardar o botão ([data-login-submit]) numa variável ANTES do
        //      primeiro await — depois dele event.currentTarget já é null;
        //   2. desabilitar o botão e marcar .is-loading (evita duplo envio);
        //   3. fetch POST com credentials: "same-origin" e o corpo
        //      { username, password };
        //   4. 401 → showNotice com o recado de usuário ou senha incorretos,
        //      sem dizer qual dos dois está errado;
        //   5. demais respostas não-ok → traduzir { message, fields } em
        //      showNotice + setFieldError, e focar o primeiro campo inválido;
        //   6. sucesso → window.location.assign(PAGES.home), importando PAGES
        //      de ../utils/routes.js;
        //   7. finally → reabilitar o botão.
    });
}

/* =========================================================================
   Ligação
   ========================================================================= */

function init() {
    initNoticeFromUrl();
    initPasswordToggles();
    initForm();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
