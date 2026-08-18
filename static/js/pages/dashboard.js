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
   Cooperados (KPIs de outra aplicação, certificados_cooperados)

   Contrato com o HTML (data-*):
   [data-cooperados-kpi-ano]              campo de ano; dispara nova busca ao mudar
   [data-cooperados-kpis-loading]         esqueleto; estado inicial
   [data-cooperados-kpis-content]         stats + tabela de faixas; nasce hidden
   [data-cooperados-kpis-error]           recado de falha; nasce hidden
   [data-cooperados-kpi-cooperativismo-quantidade]
                                          quantidade de cooperados capacitados em
                                          cooperativismo
   [data-cooperados-kpi-cooperativismo]   % que essa quantidade representa do total
                                          de cooperados
   [data-cooperados-kpi-satisfacao]       índice de satisfação (%), "—" se não houver
                                           pesquisa cadastrada para o ano
   [data-cooperados-kpi-manifestacoes]    total de manifestações registradas no ano
   [data-cooperados-bands-body]           <tbody> da tabela de cooperados por faixa

   Diferente de Resíduos, o período aqui é um ano só (os indicadores de lá são
   por ano-base), não um intervalo De/Até. Uma falha aqui — inclusive o 502 que
   o backend devolve quando o certificados_cooperados está fora do ar — cai no
   mesmo estado de erro, sem derrubar a seção de Resíduos ao lado.
   ========================================================================= */

function getCooperadosKpiElements() {
    return {
        loading: document.querySelector("[data-cooperados-kpis-loading]"),
        content: document.querySelector("[data-cooperados-kpis-content]"),
        error: document.querySelector("[data-cooperados-kpis-error]"),
    };
}

function showCooperadosKpiState(name) {
    const elements = getCooperadosKpiElements();
    Object.entries(elements).forEach(([key, element]) => {
        if (element) element.hidden = key !== name;
    });
}

function formatCount(value) {
    return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function buildBandCell(text, { numeric = false } = {}) {
    const td = document.createElement("td");
    if (numeric) td.classList.add("table__num");
    td.textContent = text;
    return td;
}

/**
 * Célula da faixa: uma pílula colorida (.band--N), mesma cor por faixa do
 * certificados_cooperados — ver --color-band-* em tokens.css. band.faixa vai
 * de 1 a 5 (PointsBandPolicy.BAND_COUNT do outro app), então band--1..5 cobre
 * tudo que a API pode mandar.
 */
function buildBandLabelCell(faixa) {
    const td = document.createElement("td");

    const pill = document.createElement("span");
    pill.className = `band band--${faixa}`;
    pill.textContent = `Faixa ${faixa}`;

    td.appendChild(pill);
    return td;
}

function buildBandRow(band) {
    const tr = document.createElement("tr");

    tr.appendChild(buildBandLabelCell(band.faixa));
    tr.appendChild(buildBandCell(`${band.de}% a ${band.ate}%`));
    tr.appendChild(buildBandCell(formatCount(band.quantidade), { numeric: true }));
    tr.appendChild(buildBandCell(formatPercent(band.percentual), { numeric: true }));

    return tr;
}

function renderBandsTable(bands) {
    const body = document.querySelector("[data-cooperados-bands-body]");
    if (!body) return;

    body.replaceChildren(...bands.map(buildBandRow));
}

function renderCooperadosKpis(data) {
    const cooperativismoQuantidade = document.querySelector("[data-cooperados-kpi-cooperativismo-quantidade]");
    const cooperativismo = document.querySelector("[data-cooperados-kpi-cooperativismo]");
    const satisfacao = document.querySelector("[data-cooperados-kpi-satisfacao]");
    const manifestacoes = document.querySelector("[data-cooperados-kpi-manifestacoes]");

    if (cooperativismoQuantidade) cooperativismoQuantidade.textContent = formatCount(data.capacitados_cooperativismo.quantidade);
    if (cooperativismo) cooperativismo.textContent = formatPercent(data.capacitados_cooperativismo.percentual);
    // null quando não há pesquisa de satisfação cadastrada para o ano pedido —
    // ver services/cooperados_dashboard_service.py, _indice_satisfacao.
    if (satisfacao) satisfacao.textContent = data.indice_satisfacao === null ? "—" : formatPercent(data.indice_satisfacao);
    if (manifestacoes) manifestacoes.textContent = formatCount(data.manifestacoes_registradas);

    renderBandsTable(data.cooperados_por_faixa);

    showCooperadosKpiState("content");
}

async function loadCooperadosKpis(ano) {
    showCooperadosKpiState("loading");

    try {
        const url = `${API.cooperadosDashboard}?ano=${ano}`;
        const response = await fetch(url, { credentials: "same-origin" });

        if (response.status === 401) {
            window.location.replace(`${PAGES.login}?reason=session-expired`);
            return;
        }

        if (!response.ok) throw new Error(`A API respondeu ${response.status}`);

        const data = await response.json();
        renderCooperadosKpis(data);
    } catch (error) {
        showCooperadosKpiState("error");
        console.error(error);
    }
}

function initCooperadosKpis() {
    const yearInput = document.querySelector("[data-cooperados-kpi-ano]");
    if (!yearInput) return;

    const currentYear = new Date().getFullYear();
    yearInput.value = String(currentYear);
    yearInput.max = String(currentYear);

    yearInput.addEventListener("change", () => {
        if (!yearInput.value) return;
        loadCooperadosKpis(yearInput.value);
    });

    loadCooperadosKpis(currentYear);
}

/* =========================================================================
   Ligação
   ========================================================================= */

function init() {
    initWasteKpis();
    initCooperadosKpis();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
