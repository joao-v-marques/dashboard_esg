/**
 * Dashboard — orquestração da área de conteúdo.
 *
 * Este arquivo não sabe o que é resíduo nem cooperado. Ele lê a lista de
 * setores (js/pages/dashboard_sectors.js), monta cada bloco com os
 * componentes genéricos (js/utils/dashboard_widgets.js e
 * js/utils/dashboard_charts.js) e cuida de três coisas que são do painel, não
 * de um setor:
 *
 *   1. a faixa de abas — um setor por vez, o nome e a quantidade de
 *      indicadores em cada aba;
 *   2. a barra do painel, onde vive o filtro do setor à vista — um filtro por
 *      setor, mas só o do setor aberto aparece;
 *   3. o ciclo de vida de cada setor (carregando / pronto / erro), que é
 *      independente — um setor fora do ar não derruba os vizinhos.
 *
 * O FILTRO FICA NA BARRA, e não num cabeçalho dentro do bloco. São duas
 * razões: o painel inteiro cabe em uma tela sem rolagem, e o controle que
 * define o recorte fica acima de tudo o que ele recorta — dentro do bloco, ele
 * apareceria depois de indicadores que já estão desenhados com o período dele.
 * Continua sendo um filtro POR SETOR: não existe filtro global, e mexer nele
 * recarrega só aquele bloco.
 *
 * Contrato com o HTML (data-*):
 *   [data-dashboard-tabs]      faixa de abas; o role="tablist" e o rótulo já
 *                              vêm do HTML, aqui só entram os botões
 *   [data-dashboard-filters]   lugar dos filtros de período na barra; um por
 *                              setor, todos ocultos menos o do setor aberto
 *   [data-dashboard-body]      onde os painéis de setor são desenhados
 *   [data-export]              botão "Exportar"
 */

import { PAGES } from "../utils/routes.js";
import { SETORES } from "./dashboard_sectors.js";
import { baixarCsv, montarCsv, nomeDoArquivo } from "../utils/dashboard_export.js";
import { criarGrafico, redesenharGraficos } from "../utils/dashboard_charts.js";
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
 *   graficos, tabelas, metas, notas   idem, já resolvidos
 */
const estados = new Map();

/** Nós que o repintar de um setor precisa alcançar sem refazer o bloco todo. */
const nos = new Map();

let setorAtivo = SETORES[0]?.id ?? null;
let indoParaLogin = false;

/**
 * A partir de cinco indicadores os cartões passam para a densidade micro: com
 * seis dividindo a linha, o tamanho compacto deixaria cada um com um sexto da
 * largura e três linhas de rótulo. Abaixo disso, o compacto continua.
 */
function densidadeDosCartoes(setor) {
    return setor.kpis.length >= 5 ? "micro" : "compacta";
}

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
        span: descritor.span,
        densa: descritor.densa,
        titulo: descritor.titulo,
        descricao: descritor.descricao,
        nota: typeof descritor.nota === "function" ? descritor.nota(dados, periodo) : descritor.nota,
        colunas: descritor.colunas,
        linhas: descritor.linhas(dados),
    }));
}

/**
 * O descritor de gráfico entrega o desenho inteiro em `dados(...)`: categorias,
 * séries ou fatias, o destaque do rodapé e a tabela equivalente. O que sobra no
 * descritor (tipo, título, escala, unidade) passa direto, e é por isso que o
 * espalhamento vem antes — nada resolvido pode ser sobrescrito pela descrição.
 */
function resolverGraficos(setor, dados, periodo) {
    return (setor.graficos ?? []).map((descritor) => ({
        ...descritor,
        nota: typeof descritor.nota === "function" ? descritor.nota(dados, periodo) : descritor.nota,
        ...descritor.dados(dados, periodo),
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
        estado.graficos = resolverGraficos(setor, dados, periodo);
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
 * A grade de 12 colunas do setor: gráficos primeiro, na ordem da configuração,
 * e as tabelas em seguida. Cada card diz quantas colunas ocupa (`span`), e é
 * essa soma que faz o painel caber em duas linhas em vez de uma pilha.
 *
 * Sem subtítulo "Detalhamento" por cima: cada card já tem o próprio título, e
 * um rótulo de seção para dizer o que os títulos abaixo já dizem custaria uma
 * linha inteira num painel que precisa caber numa tela.
 */
function montarGradeDoSetor(estado) {
    const grade = elemento("div", "sector__grid");

    estado.graficos.forEach((grafico) => {
        const card = criarGrafico(grafico);
        card.classList.add("sector__cell--" + (grafico.span ?? 12));
        grade.appendChild(card);
    });

    estado.tabelas.forEach((tabela) => {
        const card = criarTabelaDetalhada(tabela);
        card.classList.add("sector__cell--" + (tabela.span ?? 12));
        grade.appendChild(card);
    });

    return grade.childElementCount ? grade : null;
}

/**
 * Conteúdo do bloco: indicadores, gráficos, detalhamento e apontamentos.
 * É a única parte repintada quando o dado chega — o resumo do setor fica de
 * pé, e o filtro, que agora vive na barra do painel, nunca é tocado: o foco
 * não se perde ao mexer em uma data.
 */
function pintarConteudo(setor) {
    const referencias = nos.get(setor.id);
    if (!referencias) return;

    const estado = estados.get(setor.id);
    const partes = [];

    if (estado.status === "carregando") {
        partes.push(criarEsqueleto(setor.kpis.length, densidadeDosCartoes(setor)));
    } else if (estado.status === "erro") {
        partes.push(criarFalha(setor.erro.titulo, setor.erro.texto));
    } else {
        partes.push(criarGradeIndicadores(estado.kpis, estado.kpisAnteriores, densidadeDosCartoes(setor)));

        const grade = montarGradeDoSetor(estado);
        if (grade) partes.push(grade);

        if (estado.notas.length) {
            const bloco = elemento("div");
            bloco.appendChild(subhead("Apontamentos"));
            bloco.appendChild(criarApontamentos(estado.notas));
            partes.push(bloco);
        }
    }

    // As metas ficam depois da grade, no próprio nó — fora de .sector__content
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

function construirBloco(setor) {
    const bloco = elemento("section", "sector");
    bloco.setAttribute("aria-labelledby", "titulo-" + setor.id);

    // O título é oculto: a aba selecionada já mostra o nome do setor em
    // destaque, e repeti-lo logo abaixo gastaria uma linha para dizer o que
    // está escrito dois centímetros acima. Oculto, e não ausente — toda seção
    // precisa de um título para quem navega por leitor de tela.
    const titulo = elemento("h2", "visually-hidden", setor.nome);
    titulo.id = "titulo-" + setor.id;
    bloco.appendChild(titulo);

    // O resumo fica em uma linha só. O texto inteiro continua acessível pelo
    // title para quem passar o ponteiro — encurtar a frase na configuração
    // seria perder a explicação nas telas largas, onde ela cabe inteira.
    const resumo = elemento("p", "sector__summary", setor.resumo);
    resumo.title = setor.resumo;
    bloco.appendChild(resumo);

    const conteudo = elemento("div", "sector__content stack-16");
    bloco.appendChild(conteudo);

    const metas = elemento("div", "sector__goals");
    bloco.appendChild(metas);

    nos.set(setor.id, { conteudo, metas });

    return bloco;
}

/* =========================================================================
   Barra do painel: abas e filtros
   ========================================================================= */

function idDaAba(setor) {
    return "aba-" + setor.id;
}

function idDoPainel(setor) {
    return "painel-" + setor.id;
}

/** Filtro de cada setor, na barra. Todos são montados; só um fica visível. */
function montarFiltros(caixa) {
    caixa.replaceChildren(...SETORES.map((setor) => {
        const filtro = criarFiltro(
            setor,
            estados.get(setor.id).periodo,
            (novo) => trocarPeriodo(setor, novo),
            { compacto: true },
        );

        filtro.dataset.filterFor = setor.id;
        return filtro;
    }));
}

function selecionarAba(id, { moverFoco = false } = {}) {
    setorAtivo = id;

    SETORES.forEach((setor) => {
        const aba = document.getElementById(idDaAba(setor));
        const painel = document.getElementById(idDoPainel(setor));
        const filtro = document.querySelector(`[data-filter-for="${setor.id}"]`);
        const ativa = setor.id === id;

        if (aba) {
            aba.setAttribute("aria-selected", String(ativa));
            // Tabindex móvel: só a aba atual recebe Tab, e as setas andam
            // entre elas — é o comportamento esperado de um tablist.
            aba.tabIndex = ativa ? 0 : -1;
            if (ativa && moverFoco) aba.focus();
        }

        if (painel) painel.hidden = !ativa;
        if (filtro) filtro.hidden = !ativa;
    });

    // Gráfico em painel oculto tem largura zero e sai sem desenho: agora que o
    // painel apareceu, é aqui que ele ganha a medida que faltava.
    const painelAtivo = document.getElementById("painel-" + id);
    if (painelAtivo) redesenharGraficos(painelAtivo);
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
    const caixaDeFiltros = document.querySelector("[data-dashboard-filters]");
    const corpo = document.querySelector("[data-dashboard-body]");
    if (!faixa || !corpo || !SETORES.length) return;

    SETORES.forEach((setor) => {
        estados.set(setor.id, {
            periodo: setor.periodoInicial(),
            status: "carregando",
            dados: null,
            kpis: [],
            kpisAnteriores: [],
            graficos: [],
            tabelas: [],
            metas: [],
            notas: [],
        });
    });

    montarAbas(faixa);
    if (caixaDeFiltros) montarFiltros(caixaDeFiltros);
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
