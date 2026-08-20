/**
 * Dashboard — orquestração da área de conteúdo.
 *
 * Este arquivo não sabe o que é resíduo nem cooperado. Ele lê a lista de
 * setores (js/pages/dashboard_sectors.js), monta cada bloco com os
 * componentes genéricos (js/utils/dashboard_widgets.js) e cuida de duas
 * coisas que são do painel, não de um setor:
 *
 *   1. a faixa de abas — um setor por vez, o nome e a quantidade de
 *      indicadores em cada aba;
 *   2. o ciclo de vida de cada setor (carregando / pronto / erro), que é
 *      independente — um setor fora do ar não derruba os vizinhos.
 *
 * Não existe filtro global: cada setor tem o seu, declarado na configuração,
 * e mexer nele recarrega só aquele bloco.
 *
 * Contrato com o HTML (data-*):
 *   [data-dashboard-tabs]      faixa de abas; o role="tablist" e o rótulo já
 *                              vêm do HTML, aqui só entram os botões
 *   [data-dashboard-body]      onde os painéis de setor são desenhados
 *   [data-export]              botão "Exportar"
 */

import { PAGES } from "../utils/routes.js";
import { SETORES } from "./dashboard_sectors.js";
import { baixarCsv, montarCsv, nomeDoArquivo } from "../utils/dashboard_export.js";
import {
    criarApontamentos,
    criarBarraMeta,
    criarEsqueleto,
    criarFalha,
    criarFiltro,
    criarGradeIndicadores,
    criarTabelaDetalhada,
} from "../utils/dashboard_widgets.js";

/* =========================================================================
   Estado
   ========================================================================= */

/**
 * Um registro por setor, criado uma vez e mutado dali em diante:
 *   periodo   estado do filtro do setor (objeto novo a cada troca — a
 *             identidade dele é o que descarta resposta atrasada)
 *   status    "carregando" | "pronto" | "erro"
 *   kpis      indicadores já resolvidos com o dado do período
 *   kpisAnteriores  os mesmos, do período anterior, para a variação
 *   tabelas, metas, notas   idem, já resolvidos
 */
const estados = new Map();

/** Nós que o repintar de um setor precisa alcançar sem refazer o bloco todo. */
const nos = new Map();

let setorAtivo = SETORES[0]?.id ?? null;
let indoParaLogin = false;

/* =========================================================================
   Resolução da configuração → dado pronto para desenhar
   ========================================================================= */

function resolverKpis(setor, dados) {
    return setor.kpis.map((descritor) => ({
        id: descritor.id,
        sigla: descritor.sigla,
        rotulo: descritor.rotulo,
        unidade: descritor.unidade,
        decimais: descritor.decimais,
        tom: descritor.tom,
        melhorQuando: descritor.melhorQuando,
        pontosPercentuais: descritor.pontosPercentuais,
        valor: descritor.valor(dados),
        nota: descritor.nota ? descritor.nota(dados) : null,
    }));
}

function resolverTabelas(setor, dados, periodo) {
    return setor.tabelas.map((descritor) => ({
        titulo: descritor.titulo,
        descricao: descritor.descricao,
        nota: typeof descritor.nota === "function" ? descritor.nota(dados, periodo) : descritor.nota,
        colunas: descritor.colunas,
        linhas: descritor.linhas(dados),
    }));
}

/* =========================================================================
   Carregamento

   Cada setor busca sozinho e pinta sozinho. A segunda busca — a do período
   anterior, que alimenta a variação — é enfeite: se falhar, o cartão fica sem
   a linha de variação e nada mais acontece. Nunca joga o setor no estado de
   erro por causa dela.
   ========================================================================= */

function irParaLogin() {
    if (indoParaLogin) return;
    indoParaLogin = true;
    window.location.replace(PAGES.login + "?reason=session-expired");
}

/** Descarta resposta de um período que o usuário já trocou. */
function aindaEhOPeriodoAtual(setor, periodo) {
    return estados.get(setor.id).periodo === periodo;
}

async function carregarComparativo(setor, periodo) {
    const anterior = setor.periodoAnterior(periodo);
    if (!anterior) return;

    try {
        const dados = await setor.buscar(anterior);
        if (!aindaEhOPeriodoAtual(setor, periodo)) return;

        estados.get(setor.id).kpisAnteriores = resolverKpis(setor, dados);
        pintarConteudo(setor);
    } catch (erro) {
        if (erro.sessaoExpirada) irParaLogin();
        // Sem comparação o painel continua correto — só não colore a seta.
    }
}

async function carregar(setor) {
    const estado = estados.get(setor.id);
    const periodo = estado.periodo;

    estado.status = "carregando";
    estado.kpisAnteriores = [];
    pintarConteudo(setor);

    try {
        const dados = await setor.buscar(periodo);
        if (!aindaEhOPeriodoAtual(setor, periodo)) return;

        estado.dados = dados;
        estado.kpis = resolverKpis(setor, dados);
        estado.tabelas = resolverTabelas(setor, dados, periodo);
        estado.metas = setor.metas(dados);
        estado.notas = setor.notas(dados);
        estado.status = "pronto";

        pintarConteudo(setor);

        carregarComparativo(setor, periodo);
    } catch (erro) {
        if (erro.sessaoExpirada) {
            irParaLogin();
            return;
        }

        if (!aindaEhOPeriodoAtual(setor, periodo)) return;

        estado.status = "erro";
        pintarConteudo(setor);
        console.error(erro);
    }
}

/* =========================================================================
   Desenho de um bloco de setor
   ========================================================================= */

function elemento(tag, classe, texto) {
    const node = document.createElement(tag);
    if (classe) node.className = classe;
    if (texto !== undefined && texto !== null) node.textContent = texto;
    return node;
}

function subhead(texto) {
    return elemento("p", "sector__subhead", texto);
}

function trocarPeriodo(setor, novoPeriodo) {
    estados.get(setor.id).periodo = novoPeriodo;
    carregar(setor);
}

/**
 * Conteúdo do bloco: indicadores, detalhamento, metas e apontamentos.
 * É a única parte repintada quando o dado chega — o cabeçalho e o filtro
 * ficam de pé, para o foco não se perder ao mexer em uma data.
 */
function pintarConteudo(setor) {
    const referencias = nos.get(setor.id);
    if (!referencias) return;

    const estado = estados.get(setor.id);
    const partes = [];

    if (estado.status === "carregando") {
        partes.push(criarEsqueleto(setor.kpis.length));
    } else if (estado.status === "erro") {
        partes.push(criarFalha(setor.erro.titulo, setor.erro.texto));
    } else {
        partes.push(criarGradeIndicadores(estado.kpis, estado.kpisAnteriores));

        if (estado.tabelas.length) {
            const bloco = elemento("div");
            bloco.appendChild(subhead("Detalhamento"));
            estado.tabelas.forEach((tabela) => bloco.appendChild(criarTabelaDetalhada(tabela)));
            partes.push(bloco);
        }

        if (estado.notas.length) {
            const bloco = elemento("div");
            bloco.appendChild(subhead("Apontamentos"));
            bloco.appendChild(criarApontamentos(estado.notas));
            partes.push(bloco);
        }
    }

    // As metas ficam depois das tabelas, no próprio nó — fora de .sector__content
    // para não serem apagadas junto no próximo repintar.
    const metas = estado.status === "pronto" ? estado.metas : [];

    if (metas.length) {
        const bloco = elemento("div");
        bloco.appendChild(subhead("Progresso das metas"));
        metas.forEach((meta) => bloco.appendChild(criarBarraMeta(meta)));
        referencias.metas.replaceChildren(bloco);
    } else {
        referencias.metas.replaceChildren();
    }

    referencias.conteudo.replaceChildren(...partes);
}

/**
 * Cabeçalho do bloco: nome e resumo à esquerda, filtro de período do setor
 * encostado à direita.
 */
function construirIdentificacao(setor) {
    const identificacao = elemento("div", "sector__id");

    const titulo = elemento("h2", "card__title", setor.nome);
    titulo.id = "titulo-" + setor.id;

    const principal = elemento("div", "sector__id-main");
    principal.appendChild(titulo);
    principal.appendChild(elemento("p", "sector__summary", setor.resumo));

    identificacao.appendChild(principal);
    identificacao.appendChild(criarFiltro(setor, estados.get(setor.id).periodo, (novo) => trocarPeriodo(setor, novo)));

    return identificacao;
}

function construirBloco(setor) {
    const bloco = elemento("section", "sector");
    bloco.setAttribute("aria-labelledby", "titulo-" + setor.id);

    bloco.appendChild(construirIdentificacao(setor));

    const conteudo = elemento("div", "sector__content stack-32");
    bloco.appendChild(conteudo);

    const metas = elemento("div", "sector__goals");
    bloco.appendChild(metas);

    nos.set(setor.id, { conteudo, metas });

    return bloco;
}

/* =========================================================================
   Faixa de abas
   ========================================================================= */

function idDaAba(setor) {
    return "aba-" + setor.id;
}

function idDoPainel(setor) {
    return "painel-" + setor.id;
}

function selecionarAba(id, { moverFoco = false } = {}) {
    setorAtivo = id;

    SETORES.forEach((setor) => {
        const aba = document.getElementById(idDaAba(setor));
        const painel = document.getElementById(idDoPainel(setor));
        const ativa = setor.id === id;

        if (aba) {
            aba.setAttribute("aria-selected", String(ativa));
            // Tabindex móvel: só a aba atual recebe Tab, e as setas andam
            // entre elas — é o comportamento esperado de um tablist.
            aba.tabIndex = ativa ? 0 : -1;
            if (ativa && moverFoco) aba.focus();
        }

        if (painel) painel.hidden = !ativa;
    });
}

function aoTeclarNaFaixa(evento) {
    const teclas = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!teclas.includes(evento.key)) return;

    evento.preventDefault();

    const indiceAtual = SETORES.findIndex((setor) => setor.id === setorAtivo);
    let proximo = indiceAtual;

    if (evento.key === "ArrowLeft") proximo = (indiceAtual - 1 + SETORES.length) % SETORES.length;
    if (evento.key === "ArrowRight") proximo = (indiceAtual + 1) % SETORES.length;
    if (evento.key === "Home") proximo = 0;
    if (evento.key === "End") proximo = SETORES.length - 1;

    selecionarAba(SETORES[proximo].id, { moverFoco: true });
}

function montarAbas(faixa) {
    faixa.addEventListener("keydown", aoTeclarNaFaixa);

    faixa.replaceChildren(...SETORES.map((setor) => {
        const aba = elemento("button", "tabs__tab");
        aba.type = "button";
        aba.id = idDaAba(setor);
        aba.setAttribute("role", "tab");
        aba.setAttribute("aria-controls", idDoPainel(setor));
        aba.appendChild(elemento("span", null, setor.nome));
        // O badge conta os indicadores do setor — vem do tamanho da lista de
        // KPIs da configuração, então nunca desencontra do que o bloco mostra.
        aba.appendChild(elemento("span", "count-pill", String(setor.kpis.length)));
        aba.addEventListener("click", () => selecionarAba(setor.id));
        return aba;
    }));
}

/** Um painel por setor; só o da aba atual fica visível (ver selecionarAba). */
function montarPaineis(corpo) {
    corpo.replaceChildren(...SETORES.map((setor) => {
        const painel = elemento("div", "sector-panel");
        painel.id = idDoPainel(setor);
        painel.setAttribute("role", "tabpanel");
        painel.setAttribute("aria-labelledby", idDaAba(setor));
        painel.tabIndex = 0;
        painel.appendChild(construirBloco(setor));
        return painel;
    }));
}

/* =========================================================================
   Exportação
   ========================================================================= */

function exportar() {
    const blocos = SETORES.map((setor) => ({ setor, estado: estados.get(setor.id) }));
    baixarCsv(montarCsv(blocos), nomeDoArquivo());
}

/* =========================================================================
   Ligação
   ========================================================================= */

function init() {
    const faixa = document.querySelector("[data-dashboard-tabs]");
    const corpo = document.querySelector("[data-dashboard-body]");
    if (!faixa || !corpo || !SETORES.length) return;

    SETORES.forEach((setor) => {
        estados.set(setor.id, {
            periodo: setor.periodoInicial(),
            status: "carregando",
            dados: null,
            kpis: [],
            kpisAnteriores: [],
            tabelas: [],
            metas: [],
            notas: [],
        });
    });

    montarAbas(faixa);
    montarPaineis(corpo);

    SETORES.forEach((setor) => pintarConteudo(setor));
    selecionarAba(setorAtivo);

    const botaoExportar = document.querySelector("[data-export]");
    if (botaoExportar) botaoExportar.addEventListener("click", exportar);

    // Todos os setores carregam de saída, inclusive os que estão atrás de uma
    // aba fechada: trocar de aba não pode virar espera, e a exportação precisa
    // do painel inteiro, não só do que está à vista.
    SETORES.forEach((setor) => carregar(setor));
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
