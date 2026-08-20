/**
 * Componentes genéricos do painel: cartão de indicador, tabela detalhada,
 * barra de meta, apontamentos e filtro de período.
 *
 * Nenhuma função daqui sabe o que é resíduo, cooperado ou emissão. Todas
 * recebem a descrição do que desenhar e devolvem o nó pronto — quem sabe do
 * assunto é js/pages/dashboard_sectors.js, que descreve cada setor, e
 * js/pages/dashboard.js, que orquestra. Setor novo entra escrevendo
 * configuração, não componente.
 *
 * Tudo é montado com createElement e textContent, como no resto do projeto:
 * nome de unidade, tipo de resíduo e rótulo de faixa vêm do banco e de uma
 * API externa, e nenhum deles passa por innerHTML.
 */

import {
    SEM_DADO,
    calcularVariacao,
    formatarNumero,
    nomeDoMes,
} from "./format_ptbr.js";

/* =========================================================================
   Auxiliares
   ========================================================================= */

function elemento(tag, classe, texto) {
    const node = document.createElement(tag);
    if (classe) node.className = classe;
    if (texto !== undefined && texto !== null) node.textContent = texto;
    return node;
}

/** Seta de variação. Aponta para cima; .stat__delta--down a gira 180°. */
function setaVariacao() {
    const NS = "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "12");
    svg.setAttribute("height", "12");
    svg.setAttribute("viewBox", "0 0 12 12");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", "M6 10V2m0 0L2.5 5.5M6 2l3.5 3.5");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");

    svg.appendChild(path);
    return svg;
}

/* =========================================================================
   1. Cartão de indicador

   Descrição esperada (uma entrada da lista devolvida por setor.kpis):
     id            chave estável — é por ela que o valor do período anterior
                   é reencontrado para calcular a variação
     sigla         2 a 3 letras no selo circular
     rotulo        nome por extenso
     valor         número puro (null = sem dado)
     unidade       texto curto ao lado do valor ("kg", "%", "MWh")
     decimais      casas decimais
     nota          meta ou observação curta no rodapé do cartão
     tom           "accent" | "info" | "warning" | "negative" (faixa lateral)
     melhorQuando  "maior" | "menor" — decide a cor da variação
     pontosPercentuais  o valor já é % (variação em p.p., não em %)
   ========================================================================= */

export function criarCartaoIndicador(kpi, valorAnterior, densidade = "compacta") {
    // Duas densidades para o mesmo cartão: "compacta" nos setores com dois ou
    // três indicadores, "micro" quando são seis na mesma linha e cada um tem
    // um sexto da largura. Só o tamanho muda — faixa lateral, variantes de cor
    // e ordem dos elementos são as mesmas, para os dois não lerem como
    // componentes diferentes ao trocar de aba.
    const card = elemento("article", "stat stat--" + (densidade === "micro" ? "micro" : "compact"));
    if (kpi.tom) card.classList.add("stat--" + kpi.tom);

    const header = elemento("div", "stat__header");
    header.appendChild(elemento("span", "stat__seal", kpi.sigla));
    header.appendChild(elemento("p", "stat__label", kpi.rotulo));
    card.appendChild(header);

    const valor = elemento("p", "stat__value tabular");
    valor.appendChild(elemento("span", null, formatarNumero(kpi.valor, kpi.decimais ?? 0)));
    if (kpi.unidade) valor.appendChild(elemento("span", "stat__unit", kpi.unidade));
    card.appendChild(valor);

    const variacao = calcularVariacao(kpi.valor, valorAnterior, {
        melhorQuando: kpi.melhorQuando,
        pontosPercentuais: kpi.pontosPercentuais,
    });

    if (variacao) {
        const linha = elemento("p", "stat__delta");
        if (variacao.avaliacao === "boa") linha.classList.add("stat__delta--good");
        if (variacao.avaliacao === "ruim") linha.classList.add("stat__delta--bad");
        if (variacao.direcao === "down") linha.classList.add("stat__delta--down");

        linha.appendChild(setaVariacao());
        linha.appendChild(elemento("strong", null, variacao.texto));
        linha.appendChild(elemento("span", null, "vs. período anterior"));
        card.appendChild(linha);
    }

    if (kpi.nota) card.appendChild(elemento("p", "stat__note", kpi.nota));

    return card;
}

/**
 * Modificador de grade pela quantidade de cartões.
 *
 * Três por linha é o padrão da grade de 12 colunas. Com quatro indicadores o
 * modificador aperta para span 3, e com dois ele alarga para span 6 — dois
 * cartões de span 4 deixariam um terço da linha vazio à direita, e a faixa em
 * branco lê como bloco que não terminou de carregar (ver components.css).
 */
function modificadorDaGrade(quantidade) {
    if (quantidade === 2) return "stat-grid--2";
    if (quantidade === 4) return "stat-grid--4";
    if (quantidade === 6) return "stat-grid--6";
    return null;
}

/** Grade de cartões de indicador. */
export function criarGradeIndicadores(kpis, kpisAnteriores = [], densidade = "compacta") {
    const grade = elemento("div", "stat-grid");

    const modificador = modificadorDaGrade(kpis.length);
    if (modificador) grade.classList.add(modificador);

    const anteriorPorId = new Map(kpisAnteriores.map((kpi) => [kpi.id, kpi.valor]));
    kpis.forEach((kpi) => grade.appendChild(criarCartaoIndicador(kpi, anteriorPorId.get(kpi.id), densidade)));

    return grade;
}

/* =========================================================================
   2. Tabela detalhada

   colunas: [{ titulo, tipo }] — tipo é "pill", "texto" ou "numero".
   linhas:  [[celula, celula, ...]] na mesma ordem das colunas.
     pill   → { texto, classe }   classe já pronta (.pill--info, .band--3...)
     texto  → string
     numero → { valor, decimais } (null no valor vira travessão)

   A tabela é .table--fluid: em 1360px ou mais ela cabe no container sem
   rolagem horizontal, o texto das colunas de rótulo quebra e as colunas
   numéricas ficam com a largura do conteúdo e nunca quebram.
   ========================================================================= */

function criarCelula(coluna, celula) {
    if (coluna.tipo === "numero") {
        const td = elemento("td", "table__num");
        const objeto = celula && typeof celula === "object";
        const valor = objeto ? celula.valor : celula;
        const decimais = (objeto ? celula.decimais : undefined) ?? coluna.decimais ?? 0;
        td.textContent = formatarNumero(valor, decimais);
        return td;
    }

    if (coluna.tipo === "pill") {
        const td = elemento("td");
        td.appendChild(elemento("span", celula.classe || "pill", celula.texto));
        return td;
    }

    return elemento("td", null, celula ?? SEM_DADO);
}

export function criarTabelaDetalhada({ titulo, nota, descricao, colunas, linhas, densa = false }) {
    const bloco = elemento("section", "card sector__table" + (densa ? " card--dense" : ""));
    const corpo = elemento("div", "card__body");

    const cabecalho = elemento("div", "table-head");
    cabecalho.appendChild(elemento("h4", "table-head__title", titulo));
    if (nota) cabecalho.appendChild(elemento("p", "table-head__note", nota));
    corpo.appendChild(cabecalho);

    const wrap = elemento("div", "table-wrap");
    const tabela = elemento("table", "table table--fluid" + (densa ? " table--dense" : ""));

    if (descricao) tabela.appendChild(elemento("caption", "visually-hidden", descricao));

    const thead = elemento("thead");
    const linhaCabecalho = elemento("tr");
    colunas.forEach((coluna) => {
        const th = elemento("th", coluna.tipo === "numero" ? "table__num" : null, coluna.titulo);
        th.scope = "col";
        linhaCabecalho.appendChild(th);
    });
    thead.appendChild(linhaCabecalho);
    tabela.appendChild(thead);

    const tbody = elemento("tbody");

    if (!linhas.length) {
        const tr = elemento("tr");
        const td = elemento("td", "text-muted", "Nenhum lançamento no período selecionado.");
        td.colSpan = colunas.length;
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        linhas.forEach((linha) => {
            const tr = elemento("tr");
            colunas.forEach((coluna, indice) => tr.appendChild(criarCelula(coluna, linha[indice])));
            tbody.appendChild(tr);
        });
    }

    tabela.appendChild(tbody);
    wrap.appendChild(tabela);
    corpo.appendChild(wrap);
    bloco.appendChild(corpo);

    return bloco;
}

/* =========================================================================
   3. Barra de progresso de meta

   { nome, atual, alvo, unidade, decimais, melhorQuando }

   melhorQuando "maior" (padrão): a meta é um piso, e o preenchimento é
   atual/alvo. "menor": a meta é um teto (resíduo gerado, emissão), e o
   preenchimento é quanto do teto já foi consumido.

   A régua da cor é do painel, não de cada setor: chegar ao alvo é "no alvo",
   80% do caminho ou mais é "próximo", abaixo disso é "fora". Para meta de
   teto a leitura inverte — passar do teto é que é estar fora.
   ========================================================================= */

export function criarBarraMeta({ nome, atual, alvo, unidade = "", decimais = 0, melhorQuando = "maior" }) {
    const bloco = elemento("div", "goal");

    const razao = alvo ? atual / alvo : 0;
    let situacao;

    if (melhorQuando === "menor") {
        situacao = razao <= 1 ? "ok" : razao <= 1.1 ? "near" : "off";
    } else {
        situacao = razao >= 1 ? "ok" : razao >= 0.8 ? "near" : "off";
    }

    if (situacao !== "ok") bloco.classList.add("goal--" + situacao);

    const sufixo = unidade ? " " + unidade : "";

    const cabecalho = elemento("div", "goal__head");
    cabecalho.appendChild(elemento("p", "goal__name", nome));

    const valores = elemento("p", "goal__values");
    valores.appendChild(elemento("strong", null, formatarNumero(atual, decimais)));
    valores.appendChild(elemento("span", null, " / " + formatarNumero(alvo, decimais) + sufixo));
    cabecalho.appendChild(valores);
    bloco.appendChild(cabecalho);

    const trilho = elemento("div", "goal__track");
    trilho.setAttribute("role", "img");
    trilho.setAttribute(
        "aria-label",
        nome + ": " + formatarNumero(atual, decimais) + " de " + formatarNumero(alvo, decimais) + sufixo,
    );

    const preenchimento = elemento("div", "goal__fill");
    preenchimento.style.width = Math.min(Math.max(razao, 0), 1) * 100 + "%";
    trilho.appendChild(preenchimento);
    bloco.appendChild(trilho);

    return bloco;
}

/* =========================================================================
   4. Apontamentos
   ========================================================================= */

export function criarApontamentos(itens) {
    const lista = elemento("ul", "notes");
    itens.forEach((texto) => lista.appendChild(elemento("li", "notes__item", texto)));
    return lista;
}

/* =========================================================================
   5. Filtro de período — individual por setor

   Não existe filtro global no painel: cada setor declara o próprio tipo em
   dashboard_sectors.js e só recarrega a si mesmo ao mudar. Os três tipos:

     intervalo  De/Até        (dado diário agregado em um período livre)
     ano        Ano           (indicador de ano-base)
     mes-ano    Mês + Ano     (fechamento mensal)

   Todos chamam aoMudar(novoEstado) com o estado inteiro do filtro, nunca com
   o campo isolado — quem recebe não precisa saber qual dos dois campos mexeu.
   ========================================================================= */

/** Últimos dez anos, do atual para trás — alcance dos seletores de ano. */
function anosDisponiveis() {
    const atual = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, indice) => atual - indice);
}

/**
 * Campo do filtro.
 *
 * No modo compacto o rótulo continua existindo e continua ligado ao controle —
 * ele só sai da vista (.visually-hidden). Some o texto, nunca o nome
 * acessível: um <input type="date"> sem rótulo é lido como "editar texto" por
 * leitor de tela, e ninguém descobre se aquele campo é o "De" ou o "Até".
 */
function criarCampo(idCampo, rotulo, controle, compacto = false) {
    const campo = elemento("div", "field");
    const label = elemento("label", "field__label" + (compacto ? " visually-hidden" : ""), rotulo);
    label.htmlFor = idCampo;
    controle.id = idCampo;
    campo.appendChild(label);
    campo.appendChild(controle);
    return campo;
}

function criarSelect(opcoes, selecionado) {
    const select = elemento("select", "select");

    opcoes.forEach(({ valor, texto }) => {
        const option = elemento("option", null, texto);
        option.value = String(valor);
        if (String(valor) === String(selecionado)) option.selected = true;
        select.appendChild(option);
    });

    return select;
}

function criarFiltroIntervalo(prefixo, estado, aoMudar, compacto) {
    const linha = elemento("div", "field-row");

    const de = elemento("input", "input");
    de.type = "date";
    de.value = estado.de;

    const ate = elemento("input", "input");
    ate.type = "date";
    ate.value = estado.ate;

    // Impede escolher "De" depois de "Até" direto no seletor nativo, em vez de
    // validar depois que a busca já voltou com erro. Sem piso nem teto:
    // qualquer intervalo é aceito, inclusive anterior ao início dos
    // lançamentos — a API devolve zero em tudo, sem falhar.
    const sincronizar = () => {
        ate.min = de.value;
        if (ate.value) de.max = ate.value;
    };
    sincronizar();

    const mudou = () => {
        sincronizar();
        if (de.value && ate.value) aoMudar({ de: de.value, ate: ate.value });
    };

    de.addEventListener("change", mudou);
    ate.addEventListener("change", mudou);

    linha.appendChild(criarCampo(prefixo + "-de", "De", de, compacto));
    linha.appendChild(criarCampo(prefixo + "-ate", "Até", ate, compacto));

    return linha;
}

function criarFiltroAno(prefixo, estado, aoMudar, comMes, compacto) {
    const linha = elemento("div", "field-row");
    let mesSelect = null;

    if (comMes) {
        const opcoes = Array.from({ length: 12 }, (_, indice) => ({
            valor: indice + 1,
            texto: nomeDoMes(indice + 1),
        }));

        mesSelect = criarSelect(opcoes, estado.mes);
        linha.appendChild(criarCampo(prefixo + "-mes", "Mês", mesSelect, compacto));
    }

    const anoSelect = criarSelect(
        anosDisponiveis().map((ano) => ({ valor: ano, texto: String(ano) })),
        estado.ano,
    );
    linha.appendChild(criarCampo(prefixo + "-ano", "Ano", anoSelect, compacto));

    const mudou = () => {
        const novo = { ano: Number(anoSelect.value) };
        if (mesSelect) novo.mes = Number(mesSelect.value);
        aoMudar(novo);
    };

    anoSelect.addEventListener("change", mudou);
    if (mesSelect) mesSelect.addEventListener("change", mudou);

    return linha;
}

/**
 * @param {object} opcoes
 * @param {boolean} opcoes.compacto  filtro que vive na barra do painel, ao lado
 *   das abas, e não num cabeçalho próprio: os rótulos saem da vista e o grupo
 *   passa a se apresentar por inteiro ("Período de Resíduos"), que é o que faz
 *   sentido quando os dois campos estão encostados no botão de exportar.
 */
export function criarFiltro(setor, estado, aoMudar, { compacto = false } = {}) {
    const bloco = elemento("div", "sector__filter" + (compacto ? " sector__filter--bar" : ""));
    const prefixo = "filtro-" + setor.id;

    if (compacto) {
        // O grupo carrega o nome que os rótulos deixaram de mostrar, e diz de
        // qual setor é o filtro — na barra, os três setores compartilham o
        // mesmo lugar.
        bloco.setAttribute("role", "group");
        bloco.setAttribute("aria-label", "Período de " + setor.nome);
    }

    if (setor.filtro.tipo === "intervalo") {
        bloco.appendChild(criarFiltroIntervalo(prefixo, estado, aoMudar, compacto));
    } else {
        bloco.appendChild(criarFiltroAno(prefixo, estado, aoMudar, setor.filtro.tipo === "mes-ano", compacto));
    }

    return bloco;
}

/* =========================================================================
   6. Estados de carregamento e falha

   Os três estados de um setor têm o mesmo desenho das demais telas do
   projeto: esqueleto do tamanho do conteúdo que vem, e recado centralizado
   quando a busca falha. O esqueleto ocupa a mesma grade dos cartões para a
   página não saltar quando o dado chega.
   ========================================================================= */

export function criarEsqueleto(quantidadeDeCartoes, densidade = "compacta") {
    const grade = elemento("div", "stat-grid");

    // Mesmo modificador dos cartões: o esqueleto precisa ocupar exatamente a
    // largura que o conteúdo vai ocupar, senão a página salta quando o dado
    // chega.
    const modificador = modificadorDaGrade(quantidadeDeCartoes);
    if (modificador) grade.classList.add(modificador);

    // O esqueleto usa a altura da MESMA densidade dos cartões que vão chegar,
    // senão a página salta no instante em que o dado entra.
    const alturaDoEsqueleto = densidade === "micro" ? "skeleton--stat-micro" : "skeleton--stat-compact";

    for (let indice = 0; indice < quantidadeDeCartoes; indice += 1) {
        grade.appendChild(elemento("span", "skeleton " + alturaDoEsqueleto));
    }

    return grade;
}

export function criarFalha(titulo, texto) {
    const card = elemento("div", "card");
    const vazio = elemento("div", "empty");

    const selo = elemento("div", "empty__seal seal");
    selo.setAttribute("aria-hidden", "true");
    for (let indice = 0; indice < 16; indice += 1) selo.appendChild(elemento("span"));

    vazio.appendChild(selo);
    vazio.appendChild(elemento("p", "empty__title", titulo));
    vazio.appendChild(elemento("p", "empty__text", texto));
    card.appendChild(vazio);

    return card;
}
