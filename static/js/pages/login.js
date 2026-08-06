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
 * O envio vai em POST para API.login e a sessão volta em cookie HttpOnly — o
 * JS não lê nem guarda o token, só navega para PAGES.home depois da resposta.
 */

import { initPasswordToggles } from "../utils/password_toggle.js";
import { API, PAGES } from "../utils/routes.js";

/**
 * Interruptor da tela. Fica como desligamento de emergência: com false, o
 * formulário valida o que dá sem servidor e para no aviso do cartão, em vez de
 * um botão que parece enviar e não envia.
 */
const LOGIN_ENABLED = true;

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

/** Só aparece com LOGIN_ENABLED em false. Sai junto com o interruptor. */
const NOTICE_PENDING = {
    variant: "info",
    text: "A entrada ainda não está disponível: a autenticação do sistema está em construção.",
};

/**
 * Retornos do envio.
 *
 * O 401 tem texto próprio aqui, e não o do servidor, para não haver dois
 * lugares decidindo o quanto se conta a quem erra a senha — o recado é um só e
 * não distingue usuário de senha.
 *
 * Falha de servidor também não ecoa a resposta: 5xx é onde detalhe interno
 * costuma escapar, e a tela não ganha nada em mostrá-lo.
 */
const NOTICE_INVALID = {
    variant: "danger",
    text: "Usuário ou senha incorretos.",
};

const NOTICE_ERROR = {
    variant: "danger",
    text: "Não foi possível entrar agora. Tente de novo em instantes.",
};

const NOTICE_OFFLINE = {
    variant: "danger",
    text: "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.",
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

/** Botão ocupado: trava o duplo envio e mostra que algo está acontecendo. */
function setLoading(button, loading) {
    if (!button) return;

    button.disabled = loading;
    button.classList.toggle("is-loading", loading);
}

/** Corpo de erro do servidor, ou null se a resposta não for JSON. */
async function readJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

/**
 * Traduz uma resposta 400 em erro de campo quando o servidor diz qual campo
 * falhou; sem essa informação, o recado vai para o aviso do cartão.
 */
function showValidationError(data) {
    const fields = data?.fields;

    if (fields && typeof fields === "object") {
        const invalid = FIELDS.filter(({ id }) => fields[id]);

        if (invalid.length) {
            invalid.forEach(({ id }) => setFieldError(id, String(fields[id])));
            document.getElementById(invalid[0].id)?.focus();
            return;
        }
    }

    showNotice({ variant: "danger", text: data?.message ?? NOTICE_ERROR.text });
}

function initForm() {
    const form = document.querySelector("[data-login-form]");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
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

        // Guardado antes do primeiro await: depois dele event.currentTarget já
        // é null, e o finally não teria o que reabilitar.
        const submit = form.querySelector("[data-login-submit]");

        // Só a saída bem-sucedida deixa o botão travado: a navegação leva um
        // instante, e reabilitar nesse intervalo permitiria um segundo envio.
        let navigating = false;

        setLoading(submit, true);

        try {
            const response = await fetch(API.login, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // O cookie de sessão volta nesta resposta; sem credentials o
                // navegador o descartaria e o login não teria efeito nenhum.
                credentials: "same-origin",
                body: JSON.stringify({
                    // O usuário vai sem espaços nas pontas, como o backend
                    // compara. A senha vai como digitada: espaço pode ser parte
                    // dela, e aparar aqui recusaria uma senha correta.
                    username: document.getElementById("username").value.trim(),
                    password: document.getElementById("password").value,
                }),
            });

            if (response.ok) {
                navigating = true;

                // assign, e não replace: quem chegou aqui por sessão expirada
                // ainda consegue voltar na história do navegador.
                window.location.assign(PAGES.home);
                return;
            }

            const data = await readJson(response);

            if (response.status === 401) {
                showNotice(NOTICE_INVALID);
                document.getElementById("password")?.focus();
                return;
            }

            if (response.status === 400) {
                showValidationError(data);
                return;
            }

            showNotice(NOTICE_ERROR);
            console.error(`A API respondeu ${response.status}`);
        } catch (error) {
            // Aqui só cai o que impediu a resposta de chegar — rede fora, DNS,
            // servidor no chão. Status de erro não passa por aqui: fetch só
            // rejeita quando não houve resposta.
            showNotice(NOTICE_OFFLINE);
            console.error(error);
        } finally {
            if (!navigating) setLoading(submit, false);
        }
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
