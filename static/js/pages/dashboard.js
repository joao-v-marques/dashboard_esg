/**
 * Dashboard: KPIs de resíduos, filtrados por período livre (De/Até).
 *
 * Contrato com o HTML (data-*):
 *   [data-waste-kpi-de] / [data-waste-kpi-ate]  campos de data; disparam
 *                        nova busca ao mudar
 *   [data-waste-kpis-loading]   esqueleto; estado inicial
 *   [data-waste-kpis-content]   stat-grid com os 3 KPIs; nasce hidden
 *   [data-waste-kpis-error]     recado de falha; nasce hidden
 *   [data-waste-kpi-gerado]       kg de resíduos gerados no período
 *   [data-waste-kpi-reciclado]    kg de resíduos para reciclagem no período
 *   [data-waste-kpi-percentual]   % de resíduos reciclados no período
 *
 * Intervalo livre, não seletor de ano fixo — foi o que ficou combinado ao
 * desenhar o endpoint (services/waste_dashboard_service.py aceita de/ate
 * arbitrários, sem piso). O período inicial é o ano corrente, só como ponto
 * de partida; dali o campo é livre para qualquer data, inclusive antes do
 * início dos lançamentos — nesse caso a API só devolve zero em tudo, sem
 * erro.
 *
 * Cada domínio do dashboard (Resíduos, e os que entrarem depois) busca o
 * próprio endpoint e tem os próprios estados — um domínio fora do ar não
 * derruba os outros. Ver a conversa sobre um dashboard controller por
 * domínio, não um só para todos.
 *
 * services/waste_dashboard_service.py já converte Decimal para float antes
 * de responder, diferente de waste_records_model.py — não precisa do mesmo
 * tratamento defensivo que residuos.js usa para a tabela.
 */

import { API, PAGES } from "../utils/routes.js";

/* =========================================================================
   Estado da seção (carregando / conteúdo / erro)
   ========================================================================= */

function getWasteKpiElements() {
    return {
        loading: document.querySelector("[data-waste-kpis-loading]"),
        content: document.querySelector("[data-waste-kpis-content]"),
        error: document.querySelector("[data-waste-kpis-error]"),
    };
}

function showWasteKpiState(name) {
    const elements = getWasteKpiElements();
    Object.entries(elements).forEach(([key, element]) => {
        if (element) element.hidden = key !== name;
    });
}

/* =========================================================================
   Números
   ========================================================================= */

function formatKg(value) {
    return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatPercent(value) {
    return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function renderWasteKpis(resumo) {
    const gerado = document.querySelector("[data-waste-kpi-gerado]");
    const reciclado = document.querySelector("[data-waste-kpi-reciclado]");
    const percentual = document.querySelector("[data-waste-kpi-percentual]");

    if (gerado) gerado.textContent = formatKg(resumo.kg_gerado);
    if (reciclado) reciclado.textContent = formatKg(resumo.kg_reciclado);
    if (percentual) percentual.textContent = formatPercent(resumo.pct_reciclado);

    showWasteKpiState("content");
}

/* =========================================================================
   Carregamento
   ========================================================================= */

async function loadWasteKpis(de, ate) {
    showWasteKpiState("loading");

    try {
        const url = `${API.wasteDashboard}?de=${de}&ate=${ate}`;
        const response = await fetch(url, { credentials: "same-origin" });

        if (response.status === 401) {
            window.location.replace(`${PAGES.login}?reason=session-expired`);
            return;
        }

        if (!response.ok) throw new Error(`A API respondeu ${response.status}`);

        const data = await response.json();
        renderWasteKpis(data.resumo);
    } catch (error) {
        showWasteKpiState("error");
        console.error(error);
    }
}

/* =========================================================================
   Período (De/Até)
   ========================================================================= */

/** Ano corrente inteiro, como ponto de partida — sem piso, o campo é livre a partir daí. */
function defaultPeriod() {
    const year = new Date().getFullYear();
    return { de: `${year}-01-01`, ate: `${year}-12-31` };
}

/**
 * Impede escolher "De" depois de "Até" (e vice-versa) direto no seletor
 * nativo — mais simples que validar depois que o fetch já voltou com erro.
 * Sem piso/teto de data: qualquer intervalo é aceito, mesmo antes do início
 * dos lançamentos — a API só devolve zero em tudo nesse caso.
 */
function syncDateBounds(fromInput, toInput) {
    toInput.min = fromInput.value;
    if (toInput.value) fromInput.max = toInput.value;
}

function initWasteKpis() {
    const fromInput = document.querySelector("[data-waste-kpi-de]");
    const toInput = document.querySelector("[data-waste-kpi-ate]");
    if (!fromInput || !toInput) return;

    const { de, ate } = defaultPeriod();

    fromInput.value = de;
    toInput.value = ate;
    syncDateBounds(fromInput, toInput);

    const handleChange = () => {
        syncDateBounds(fromInput, toInput);
        loadWasteKpis(fromInput.value, toInput.value);
    };

    fromInput.addEventListener("change", handleChange);
    toInput.addEventListener("change", handleChange);

    loadWasteKpis(de, ate);
}

/* =========================================================================
   Ligação
   ========================================================================= */

function init() {
    initWasteKpis();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
