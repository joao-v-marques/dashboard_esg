/**
 * Lançar NIP: formulário de cadastro de página inteira (POST /api/nips).
 *
 * Contrato com o HTML (data-*):
 *   [data-consent-modal]    <dialog> de aviso de responsabilidade, aberto
 *                           sozinho a cada carregamento da página
 *     [data-consent-accept]   único jeito de fechar — "Eu concordo"
 *   [data-nip-form]         formulário; o submit é interceptado
 *   [data-nip-form-fields]  <fieldset> que envolve os campos, nasce disabled
 *   [data-nip-form-clear]   botão "Limpar"
 *   [data-nip-submit]       botão de envio, nasce disabled
 *   [data-form-nature] / [data-form-status]   selects preenchidos pela API
 *   [data-control-link]     link para "Controle de NIP's"
 *   [data-cpf-input]        campo de CPF (máscara ligada em utils/nip_form.js)
 *
 * Os campos e o botão nascem desabilitados e só liberam quando
 * /api/nip-natures e /api/nip-status respondem: um formulário editável com
 * seletor vazio convida a pessoa a preencher os oito campos para descobrir no
 * fim que não dá para escolher a natureza.
 *
 * Depois de cadastrar, a tela continua aqui com o formulário limpo, em vez de
 * navegar para o controle — NIP costuma ser lançada em lote, e voltar para cá
 * a cada cadastro custaria dois cliques por registro. O link do cabeçalho fica
 * ao lado para quem quiser conferir a lista.
 */

import { API, PAGES } from "../utils/routes.js";
import { notifySuccess, notifyError } from "../utils/notyf.js";
import {
    initCpfMask,
    populateSelect,
    clearFormErrors,
    setFieldError,
    validateForm,
    readFormPayload,
    setLoading,
    readJson,
} from "../utils/nip_form.js";

let currentUser = null;

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

async function loadReferenceData() {
    const [naturesResponse, statusResponse] = await Promise.all([
        fetch(API.nipNatures, { credentials: "same-origin" }),
        fetch(API.nipStatus, { credentials: "same-origin" }),
    ]);

    if (!naturesResponse.ok || !statusResponse.ok) {
        throw new Error("Falha ao carregar naturezas ou status de NIP");
    }

    const natures = await naturesResponse.json();
    const status = await statusResponse.json();

    populateSelect(document.querySelector("[data-form-nature]"), natures, "Selecione");
    populateSelect(document.querySelector("[data-form-status]"), status, "Selecione");
}

/* =========================================================================
   Formulário
   ========================================================================= */

function resetForm() {
    const form = document.querySelector("[data-nip-form]");
    if (!form) return;

    form.reset();
    clearFormErrors();
}

function initClear() {
    document.querySelector("[data-nip-form-clear]")?.addEventListener("click", () => {
        resetForm();
        document.getElementById("nip-notification-date")?.focus();
    });
}

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

        if (!currentUser) {
            notifyError("Não foi possível identificar o usuário logado. Atualize a página e tente de novo.");
            return;
        }

        const submit = form.querySelector("[data-nip-submit]");
        setLoading(submit, true);

        // inserted_by vai no corpo porque é isso que NipService.create espera
        // hoje (services/nips_service.py) — mesmo arranjo do POST de resíduos.
        // Quando a criação passar a ler o usuário da sessão, como o PUT já faz,
        // esta linha sai daqui.
        const payload = { ...readFormPayload(), inserted_by: currentUser.id };

        try {
            const response = await fetch(API.nips, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(payload),
            });

            if (response.status === 201) {
                notifySuccess("NIP cadastrada com sucesso.");
                resetForm();
                document.getElementById("nip-notification-date")?.focus();
                return;
            }

            if (response.status === 401) {
                window.location.replace(`${PAGES.login}?reason=session-expired`);
                return;
            }

            const data = await readJson(response);
            notifyError(data?.message ?? "Não foi possível cadastrar a NIP.");
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
   Modal de responsabilidade
   ========================================================================= */

/**
 * Aberto a cada carregamento da página, sem exceção — não fica gravado em
 * localStorage nem em cookie, porque o pedido foi "sempre que eu acessar".
 * showModal() já torna o resto da página inerte (formulário e sidebar)
 * enquanto está aberto; o único jeito de sair é "Eu concordo". Mesmo
 * comportamento da tela de resíduos.
 */
function initConsentModal() {
    const modal = document.querySelector("[data-consent-modal]");
    if (!modal) return;

    // "cancel" é o evento nativo do Esc num <dialog> aberto por showModal().
    // Bloquear aqui impede que o teclado vire um atalho pra pular o aviso.
    modal.addEventListener("cancel", (event) => event.preventDefault());

    document.querySelector("[data-consent-accept]")?.addEventListener("click", () => {
        modal.close();
        document.body.classList.remove("no-scroll");
    });

    // close() não é síncrono o bastante para dispensar a linha acima, mas o
    // listener continua como reforço para qualquer outro caminho de saída.
    modal.addEventListener("close", () => {
        document.body.classList.remove("no-scroll");
    });

    modal.showModal();
    document.body.classList.add("no-scroll");
}

/* =========================================================================
   Ligação
   ========================================================================= */

async function loadPage() {
    // O href sai de PAGES para o prefixo da aplicação continuar em um lugar só
    // (utils/routes.js), em vez de literal no HTML.
    const controlLink = document.querySelector("[data-control-link]");
    if (controlLink) controlLink.href = PAGES.nipControl;

    try {
        const [user] = await Promise.all([loadCurrentUser(), loadReferenceData()]);
        if (!user) return; // já redirecionou para o login

        currentUser = user;

        const fields = document.querySelector("[data-nip-form-fields]");
        if (fields) fields.disabled = false;

        const submit = document.querySelector("[data-nip-submit]");
        if (submit) submit.disabled = false;
    } catch (error) {
        // Sem tabela para trocar por um card de erro: o formulário simplesmente
        // continua travado, e o toast diz por quê.
        notifyError("Não foi possível carregar as opções de natureza e status. Atualize a página.");
        console.error(error);
    }
}

function init() {
    initConsentModal();
    initCpfMask();
    initClear();
    initForm();
    loadPage();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
