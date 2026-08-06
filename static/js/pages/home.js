/**
 * Página de início: monta o panorama dos três pilares do ESG.
 *
 * Contrato com o HTML (data-*):
 *   [data-overview-loading]   esqueleto; é o único estado visível no HTML
 *   [data-overview]           grade dos três indicadores, nasce com hidden
 *   [data-overview-error]     recado de falha, nasce com hidden
 *   [data-overview-environmental] / -social / -governance        valor do card
 *   [data-overview-environmental-note] / -social- / -governance- nota do card
 *
 * A API ainda não existe. Enquanto API.overview não estiver de pé, a seção
 * permanece no esqueleto: é a leitura honesta de "o dado não chegou". Mostrar
 * zero seria afirmar que os indicadores estão zerados, e mostrar o estado de
 * falha seria culpar a rede por algo que ainda não foi construído.
 */

import { API, PAGES } from "../utils/routes.js";

/** Vire para true quando API.overview existir no backend. */
const OVERVIEW_ENABLED = false;

/* =========================================================================
   Estados da seção

   Um estado por vez. Trocar por atributo hidden, e não por classe, porque
   hidden é o que o leitor de tela respeita sem depender do CSS ter carregado.
   ========================================================================= */

function getOverviewElements() {
    return {
        loading: document.querySelector("[data-overview-loading]"),
        data: document.querySelector("[data-overview]"),
        error: document.querySelector("[data-overview-error]"),
    };
}

function showState(name) {
    const elements = getOverviewElements();

    Object.entries(elements).forEach(([key, element]) => {
        if (element) element.hidden = key !== name;
    });
}

/* =========================================================================
   Escrita dos indicadores
   ========================================================================= */

/**
 * Mapa entre o campo da resposta e o par (valor, nota) no HTML.
 * Fica em um lugar só para que acrescentar um pilar seja acrescentar uma linha.
 */
const PILLARS = [
    { field: "environmental", value: "[data-overview-environmental]", note: "[data-overview-environmental-note]" },
    { field: "social", value: "[data-overview-social]", note: "[data-overview-social-note]" },
    { field: "governance", value: "[data-overview-governance]", note: "[data-overview-governance-note]" },
];

/**
 * Preenche os cards a partir da resposta da API.
 *
 * Espera, para cada pilar, um objeto `{ value, note }`. Campo ausente vira "-",
 * e não 0: a diferença entre "não veio" e "é zero" importa em indicador.
 *
 * textContent em toda escrita — o texto vem do servidor e não pode ser
 * interpretado como marcação.
 */
function renderOverview(overview) {
    PILLARS.forEach((pillar) => {
        const data = overview?.[pillar.field] ?? {};

        const valueTarget = document.querySelector(pillar.value);
        const noteTarget = document.querySelector(pillar.note);

        if (valueTarget) valueTarget.textContent = data.value ?? "-";
        if (noteTarget) noteTarget.textContent = data.note ?? "";
    });

    showState("data");
}

/* =========================================================================
   Carregamento
   ========================================================================= */

async function loadOverview() {
    const { loading } = getOverviewElements();

    // Página sem a seção (outra tela reaproveitando este módulo) não faz nada.
    if (!loading) return;

    if (!OVERVIEW_ENABLED) return;

    try {
        const response = await fetch(API.overview, { credentials: "same-origin" });

        // Sessão vencida não é falha de carregamento: é hora de logar de novo.
        if (response.status === 401) {
            window.location.replace(PAGES.login);
            return;
        }

        if (!response.ok) throw new Error(`A API respondeu ${response.status}`);

        renderOverview(await response.json());
    } catch (error) {
        // O recado ao usuário é de falha, nunca de "nenhum indicador": rede caída
        // não é ausência de dado.
        showState("error");
        console.error(error);
    }
}

/* =========================================================================
   Ligação
   ========================================================================= */

function init() {
    loadOverview();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
