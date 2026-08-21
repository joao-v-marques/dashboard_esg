/**
 * Gráficos do painel — SVG desenhado aqui, sem biblioteca e sem CDN.
 *
 * Mesma divisão de trabalho das tabelas: este arquivo não sabe o que é
 * resíduo. Recebe a descrição de um gráfico já resolvida (categorias, séries,
 * fatias) e devolve o card pronto; quem sabe do assunto é
 * js/pages/dashboard_sectors.js.
 *
 * TRÊS FORMAS, cada uma para um trabalho:
 *
 *   colunas-empilhadas  composição de um total ao longo do tempo
 *   linha               uma taxa ao longo do tempo
 *   composicao          participação de cada parte no todo, num período só
 *                       (rosca com 3 fatias ou mais; barra 100% com 2 — uma
 *                        rosca de duas fatias não diz nada que o cartão de
 *                        percentual já não diga melhor)
 *
 * REGRAS DE DESENHO que não são gosto e não devem ser afrouxadas:
 *
 *   - Um eixo por gráfico. Nunca dois eixos verticais no mesmo desenho: o
 *     alinhamento entre as duas escalas seria arbitrário e inventaria uma
 *     correlação que não está no dado. É por isso que o peso (kg) e a taxa
 *     (%) são DOIS cards, e não um só com barra e linha sobrepostas.
 *   - A cor sai da classe do slot, definida em components.css, nunca de um
 *     valor escrito aqui. E segue a IDENTIDADE da série, nunca a posição dela
 *     na lista — ordenar a composição por peso não pode repintar "Reciclável"
 *     só porque ele deixou de ser o maior.
 *   - Rótulo direto é seletivo: o pico e o último ponto, não um número em cima
 *     de cada coluna. Número em tudo é o mesmo que número em nada.
 *   - O que separa duas marcas é um vão de 2px na cor da superfície, nunca um
 *     contorno desenhado em volta delas.
 *
 * O BALÃO NUNCA É O ÚNICO CAMINHO PARA O NÚMERO. Cada gráfico carrega no DOM
 * a tabela equivalente (visualmente oculta), que é o que leitor de tela lê e o
 * que a exportação em CSV usa. Por isso o SVG inteiro é uma imagem só
 * (role="img") com resumo no aria-label, em vez de espalhar um tabstop por
 * coluna: doze meses × três gráficos seriam trinta e seis paradas de Tab entre
 * o filtro e a tabela, para dizer o que a tabela abaixo já diz.
 *
 * MEDIDA E REDESENHO. O desenho é em pixels reais (nada de esticar um viewBox
 * fixo, que deformaria o texto), então precisa da largura medida — o que só
 * existe depois de o nó entrar no DOM. Daí o primeiro desenho ser agendado, e
 * daí existir redesenharGraficos(): um painel de aba fechada tem largura zero,
 * e quem revela a aba precisa avisar.
 */

import { formatarNumero } from "./format_ptbr.js";

const NS = "http://www.w3.org/2000/svg";

/* Margens da área de desenho. A da esquerda cabe a maior marca do eixo
   ("100.000") na fonte de 12px; a de baixo, uma linha de rótulo de mês. */
const MARGEM = { topo: 16, direita: 12, base: 20, esquerda: 52 };

const DIVISOES = 4;      // linhas de malha acima da base
const BARRA_MAX = 24;    // espessura máxima de uma coluna
const VAO = 2;           // vão, na cor da superfície, entre marcas que se tocam
const RAIO = 4;          // ponta arredondada da barra (a base fica reta)
const RAIO_PONTO = 4;    // ponto da linha: 8px de diâmetro

/* =========================================================================
   Auxiliares de DOM
   ========================================================================= */

function elemento(tag, classe, texto) {
    const node = document.createElement(tag);
    if (classe) node.className = classe;
    if (texto !== undefined && texto !== null) node.textContent = texto;
    return node;
}

function svg(tag, atributos = {}) {
    const node = document.createElementNS(NS, tag);
    Object.entries(atributos).forEach(([chave, valor]) => node.setAttribute(chave, String(valor)));
    return node;
}

/** Fio de 1px nítido: um traço em coordenada inteira cai entre dois pixels. */
function meioPixel(valor) {
    return Math.round(valor) + 0.5;
}

function linha(x1, y1, x2, y2, classe) {
    return svg("line", { x1, y1, x2, y2, class: classe });
}

function texto(x, y, conteudo, classe, ancora = "start") {
    const node = svg("text", { x, y, class: classe, "text-anchor": ancora });
    node.textContent = conteudo;
    return node;
}

/* =========================================================================
   Escala

   As marcas do eixo são números redondos (0 / 500 / 1.000 / 1.500), nunca o
   máximo cru do período: uma marca em "1.847" não ajuda ninguém a ler a
   coluna do lado.
   ========================================================================= */

function escalaNice(maximo, divisoes = DIVISOES) {
    if (!(maximo > 0)) return { max: divisoes, passo: 1 };

    const bruto = maximo / divisoes;
    const magnitude = Math.pow(10, Math.floor(Math.log10(bruto)));
    const normalizado = bruto / magnitude;

    const escolhido = normalizado <= 1 ? 1
        : normalizado <= 2 ? 2
        : normalizado <= 2.5 ? 2.5
        : normalizado <= 5 ? 5
        : 10;

    const passo = escolhido * magnitude;
    return { max: passo * divisoes, passo };
}

function formatarValor(valor, grafico) {
    if (valor === null || valor === undefined) return "—";
    const numero = formatarNumero(valor, grafico.decimais ?? 0);
    return grafico.unidade ? numero + " " + grafico.unidade : numero;
}

/* =========================================================================
   Balão de valor
   ========================================================================= */

function montarBalao(tip, titulo, itens) {
    tip.replaceChildren();
    tip.appendChild(elemento("p", "chart__tip-title", titulo));

    itens.forEach((item) => {
        const linhaItem = elemento("p", "chart__tip-row");

        if (item.slot) {
            linhaItem.appendChild(elemento("span", "chart__swatch chart__swatch--" + item.slot));
        }

        linhaItem.appendChild(elemento("span", null, item.rotulo));
        linhaItem.appendChild(elemento("strong", null, item.valor));
        tip.appendChild(linhaItem);
    });
}

function posicionarBalao(tip, plot, x, y) {
    // Preso à faixa do desenho: um balão saindo pela borda do card seria
    // cortado pelo raio do próprio card.
    const limite = plot.clientWidth;
    tip.style.left = Math.min(Math.max(x, 72), Math.max(limite - 72, 72)) + "px";
    tip.style.top = Math.max(y, 8) + "px";
    tip.hidden = false;
}

function esconderBalao(tip) {
    if (tip) tip.hidden = true;
}

/* =========================================================================
   1. Colunas empilhadas — composição de um total ao longo do tempo
   ========================================================================= */

function desenharColunasEmpilhadas(raiz, plot, tip, grafico, largura, altura) {
    const categorias = grafico.categorias;
    const series = grafico.series;

    const totais = categorias.map((_, indice) =>
        series.reduce((soma, serie) => soma + (serie.valores[indice] ?? 0), 0));

    const escala = escalaNice(Math.max(...totais, 0));

    const esquerda = MARGEM.esquerda;
    const direita = largura - MARGEM.direita;
    const topo = MARGEM.topo;
    const base = altura - MARGEM.base;
    const alturaPlot = base - topo;

    if (direita <= esquerda || alturaPlot <= 0) return;

    const y = (valor) => base - (valor / escala.max) * alturaPlot;

    // Malha e marcas do eixo. A linha de baixo é o eixo (um tom mais forte);
    // as de cima são malha, e ficam atrás das colunas por serem desenhadas
    // antes — em SVG a ordem do documento é a ordem de empilhamento.
    for (let indice = 0; indice <= DIVISOES; indice += 1) {
        const valor = escala.passo * indice;
        const posicao = meioPixel(y(valor));

        raiz.appendChild(linha(esquerda, posicao, direita, posicao, indice === 0 ? "chart-axis" : "chart-grid"));
        raiz.appendChild(texto(esquerda - 8, posicao + 4, formatarNumero(valor, 0), "chart-tick", "end"));
    }

    const banda = (direita - esquerda) / categorias.length;
    const espessura = Math.min(BARRA_MAX, banda * 0.62);

    // Com muitos meses, um rótulo por coluna vira uma cerca ilegível: mostra
    // um a cada N, sempre incluindo o primeiro.
    const passoRotulo = Math.ceil(categorias.length / 12);
    const indicePico = totais.indexOf(Math.max(...totais));

    categorias.forEach((categoria, indice) => {
        const centro = esquerda + banda * (indice + 0.5);
        const x = centro - espessura / 2;

        // Faixa de destaque + área de acerto, uma por categoria. A área é a
        // banda inteira, não a coluna: mirar numa coluna de 12px de largura
        // seria exigir pontaria.
        const faixa = svg("rect", {
            class: "chart-band",
            x: esquerda + banda * indice,
            y: topo,
            width: banda,
            height: alturaPlot,
        });
        raiz.appendChild(faixa);

        const indicesComValor = series
            .map((serie, ordem) => ((serie.valores[indice] ?? 0) > 0 ? ordem : -1))
            .filter((ordem) => ordem >= 0);

        const topoDaPilha = indicesComValor[indicesComValor.length - 1];
        let acumulado = 0;

        series.forEach((serie, ordem) => {
            const valor = serie.valores[indice] ?? 0;
            if (valor <= 0) return;

            const yTopo = y(acumulado + valor);
            const yBase = y(acumulado);
            acumulado += valor;

            const ehTopo = ordem === topoDaPilha;
            // O vão sai do topo de cada segmento que tem outro por cima; o
            // último não perde nada, senão a pilha ficaria mais baixa que o
            // valor que representa.
            const recuo = ehTopo ? 0 : VAO;
            const alturaSegmento = yBase - yTopo - recuo;
            if (alturaSegmento <= 0.5) return;

            const yFinal = yTopo + recuo;
            const raio = ehTopo ? Math.min(RAIO, espessura / 2, alturaSegmento) : 0;

            // Ponta arredondada só no alto da pilha; a base fica reta, colada
            // na linha do zero.
            const d = raio
                ? `M${x},${yFinal + alturaSegmento}L${x},${yFinal + raio}Q${x},${yFinal} ${x + raio},${yFinal}`
                    + `L${x + espessura - raio},${yFinal}Q${x + espessura},${yFinal} ${x + espessura},${yFinal + raio}`
                    + `L${x + espessura},${yFinal + alturaSegmento}Z`
                : `M${x},${yFinal}h${espessura}v${alturaSegmento}h${-espessura}Z`;

            raiz.appendChild(svg("path", { d, class: "chart-mark--" + serie.slot }));
        });

        // Rótulo direto no pico, e só nele: é o número que a diretoria procura
        // no gráfico, e o único que cabe sem virar poluição.
        if (indice === indicePico && totais[indice] > 0) {
            raiz.appendChild(texto(
                centro,
                Math.max(y(totais[indice]) - 6, 10),
                formatarNumero(totais[indice], 0),
                "chart-label",
                "middle",
            ));
        }

        if (indice % passoRotulo === 0) {
            raiz.appendChild(texto(centro, base + 14, categoria.curto, "chart-tick", "middle"));
        }

        const alvo = svg("rect", {
            class: "chart-hit",
            x: esquerda + banda * indice,
            y: topo,
            width: banda,
            height: alturaPlot,
        });

        const mostrar = () => {
            raiz.querySelectorAll(".chart-band.is-active").forEach((node) => node.classList.remove("is-active"));
            faixa.classList.add("is-active");

            montarBalao(tip, categoria.longo, [
                ...series.map((serie) => ({
                    slot: serie.slot,
                    rotulo: serie.rotulo,
                    valor: formatarValor(serie.valores[indice] ?? 0, grafico),
                })),
                { rotulo: "Total", valor: formatarValor(totais[indice], grafico) },
            ]);

            posicionarBalao(tip, plot, centro, y(totais[indice]) - 8);
        };

        alvo.addEventListener("pointerenter", mostrar);
        alvo.addEventListener("pointermove", mostrar);
        raiz.appendChild(alvo);
    });
}

/* =========================================================================
   2. Linha — uma taxa ao longo do tempo

   Mês sem lançamento chega como null e INTERROMPE a linha, em vez de puxá-la
   até zero: não houve taxa naquele mês, e uma queda desenhada seria uma
   afirmação que o dado não sustenta.
   ========================================================================= */

function desenharLinha(raiz, plot, tip, grafico, largura, altura) {
    const categorias = grafico.categorias;
    const serie = grafico.series[0];
    const valores = serie.valores;

    const escala = grafico.escala ?? escalaNice(Math.max(...valores.filter((valor) => valor !== null), 0));

    const esquerda = MARGEM.esquerda;
    const direita = largura - MARGEM.direita;
    const topo = MARGEM.topo;
    const base = altura - MARGEM.base;
    const alturaPlot = base - topo;

    if (direita <= esquerda || alturaPlot <= 0) return;

    const y = (valor) => base - (valor / escala.max) * alturaPlot;
    const banda = (direita - esquerda) / categorias.length;
    const x = (indice) => esquerda + banda * (indice + 0.5);

    for (let indice = 0; indice <= DIVISOES; indice += 1) {
        const valor = escala.passo * indice;
        const posicao = meioPixel(y(valor));

        raiz.appendChild(linha(esquerda, posicao, direita, posicao, indice === 0 ? "chart-axis" : "chart-grid"));
        raiz.appendChild(texto(esquerda - 8, posicao + 4, formatarNumero(valor, 0), "chart-tick", "end"));
    }

    // Linha de referência: a taxa do período inteiro. Serve para ler cada mês
    // como acima ou abaixo da média sem ter que fazer a conta de cabeça.
    if (grafico.referencia && grafico.referencia.valor !== null && grafico.referencia.valor !== undefined) {
        const posicao = meioPixel(y(grafico.referencia.valor));
        raiz.appendChild(linha(esquerda, posicao, direita, posicao, "chart-rule"));
        raiz.appendChild(texto(direita, posicao - 5, grafico.referencia.rotulo, "chart-label chart-label--muted", "end"));
    }

    // Um traçado por trecho contínuo — os buracos ficam buracos.
    let trecho = [];
    const trechos = [];

    valores.forEach((valor, indice) => {
        if (valor === null || valor === undefined) {
            if (trecho.length) trechos.push(trecho);
            trecho = [];
            return;
        }
        trecho.push(indice);
    });
    if (trecho.length) trechos.push(trecho);

    trechos.forEach((indices) => {
        if (indices.length === 1) return; // ponto solto: o círculo abaixo já o mostra

        const d = indices
            .map((indice, ordem) => (ordem === 0 ? "M" : "L") + x(indice) + "," + y(valores[indice]))
            .join("");

        raiz.appendChild(svg("path", { d, class: "chart-line chart-line--" + serie.slot }));
    });

    const passoRotulo = Math.ceil(categorias.length / 12);
    const ultimoComValor = valores.reduce((ultimo, valor, indice) => (valor === null ? ultimo : indice), -1);

    categorias.forEach((categoria, indice) => {
        const valor = valores[indice];

        const faixa = svg("rect", {
            class: "chart-band",
            x: esquerda + banda * indice,
            y: topo,
            width: banda,
            height: alturaPlot,
        });
        raiz.appendChild(faixa);

        if (indice % passoRotulo === 0) {
            raiz.appendChild(texto(x(indice), base + 14, categoria.curto, "chart-tick", "middle"));
        }

        if (valor === null || valor === undefined) return;

        raiz.appendChild(svg("circle", {
            cx: x(indice),
            cy: y(valor),
            r: RAIO_PONTO,
            class: "chart-dot chart-mark--" + serie.slot,
        }));

        // Rótulo direto só no último ponto — é onde a série termina e o que
        // se quer saber ao olhar de relance.
        if (indice === ultimoComValor) {
            const encostado = x(indice) > direita - 40;
            raiz.appendChild(texto(
                x(indice) + (encostado ? -10 : 10),
                y(valor) - 8,
                formatarValor(valor, grafico),
                "chart-label",
                encostado ? "end" : "start",
            ));
        }

        const alvo = svg("rect", {
            class: "chart-hit",
            x: esquerda + banda * indice,
            y: topo,
            width: banda,
            height: alturaPlot,
        });

        const mostrar = () => {
            raiz.querySelectorAll(".chart-band.is-active").forEach((node) => node.classList.remove("is-active"));
            faixa.classList.add("is-active");

            montarBalao(tip, categoria.longo, [
                { slot: serie.slot, rotulo: serie.rotulo, valor: formatarValor(valor, grafico) },
                ...(categoria.apoio ?? []),
            ]);

            posicionarBalao(tip, plot, x(indice), y(valor) - 12);
        };

        alvo.addEventListener("pointerenter", mostrar);
        alvo.addEventListener("pointermove", mostrar);
        raiz.appendChild(alvo);
    });
}

/* =========================================================================
   3. Composição — participação de cada parte no todo

   Rosca a partir de três fatias. Com duas, o desenho vira uma barra de 100%:
   uma rosca de duas fatias não acrescenta nada ao cartão de percentual que
   está logo acima, e ainda cobra o espaço de um card inteiro.
   ========================================================================= */

function arco(cx, cy, raioExterno, raioInterno, anguloInicial, anguloFinal) {
    const ponto = (raio, angulo) => [cx + raio * Math.cos(angulo), cy + raio * Math.sin(angulo)];
    const grande = anguloFinal - anguloInicial > Math.PI ? 1 : 0;

    const [x0, y0] = ponto(raioExterno, anguloInicial);
    const [x1, y1] = ponto(raioExterno, anguloFinal);
    const [x2, y2] = ponto(raioInterno, anguloFinal);
    const [x3, y3] = ponto(raioInterno, anguloInicial);

    return `M${x0},${y0}A${raioExterno},${raioExterno} 0 ${grande} 1 ${x1},${y1}`
        + `L${x2},${y2}A${raioInterno},${raioInterno} 0 ${grande} 0 ${x3},${y3}Z`;
}

function desenharRosca(raiz, plot, tip, grafico, largura, altura) {
    const fatias = grafico.fatias;
    const total = fatias.reduce((soma, fatia) => soma + fatia.valor, 0);
    if (!(total > 0)) return;

    const cx = largura / 2;
    const cy = altura / 2;
    const raioExterno = Math.max(Math.min(largura, altura) / 2 - 4, 8);
    const raioInterno = raioExterno * 0.62;
    const raioMedio = (raioExterno + raioInterno) / 2;

    // O vão de 2px é definido em pixels e convertido em ângulo no raio médio —
    // assim ele tem a mesma espessura aparente em qualquer tamanho de card.
    const vao = Math.min(VAO / raioMedio, Math.PI / (fatias.length * 4));

    let angulo = -Math.PI / 2;

    fatias.forEach((fatia) => {
        const extensao = (fatia.valor / total) * Math.PI * 2;
        const inicio = angulo + vao / 2;
        const fim = angulo + extensao - vao / 2;
        angulo += extensao;

        if (fim <= inicio) return;

        const caminho = svg("path", {
            d: arco(cx, cy, raioExterno, raioInterno, inicio, fim),
            class: "chart-mark--" + fatia.slot,
        });

        const mostrar = () => {
            montarBalao(tip, fatia.rotulo, [
                { slot: fatia.slot, rotulo: "Gerado", valor: formatarValor(fatia.valor, grafico) },
                { rotulo: "Participação", valor: formatarNumero(fatia.valor / total * 100, 2) + " %" },
            ]);

            const meio = (inicio + fim) / 2;
            posicionarBalao(tip, plot, cx + Math.cos(meio) * raioMedio, cy + Math.sin(meio) * raioMedio);
        };

        caminho.addEventListener("pointerenter", mostrar);
        raiz.appendChild(caminho);
    });

    // Miolo: o total do período. É o número que a rosca divide, e tê-lo no
    // centro evita ter que somar as fatias de olho.
    //
    // Duas casas, e não um inteiro curto: o mesmo total aparece no cartão de
    // KPI ao lado com duas casas, e 107,5 arredondado para "108" aqui lê como
    // divergência de dado entre dois números que são o mesmo. Cabe porque o
    // miolo tem o diâmetro interno inteiro para o texto.
    raiz.appendChild(texto(cx, cy - 2, formatarNumero(total, 2), "chart-label", "middle"));
    raiz.appendChild(texto(cx, cy + 14, grafico.unidade ?? "", "chart-tick", "middle"));
}

function desenharBarraComposicao(raiz, plot, tip, grafico, largura, altura) {
    const fatias = grafico.fatias;
    const total = fatias.reduce((soma, fatia) => soma + fatia.valor, 0);
    if (!(total > 0)) return;

    const esquerda = MARGEM.direita;
    const disponivel = largura - MARGEM.direita * 2;
    const espessura = BARRA_MAX;
    const y = (altura - espessura) / 2;

    let x = esquerda;

    fatias.forEach((fatia, indice) => {
        const bruto = (fatia.valor / total) * disponivel;
        const ehUltima = indice === fatias.length - 1;
        const comprimento = Math.max(bruto - (ehUltima ? 0 : VAO), 1);

        const primeira = indice === 0;
        const raio = Math.min(RAIO, comprimento / 2);

        // Só as duas pontas da barra são arredondadas; as junções internas
        // ficam retas, separadas pelo vão.
        const d = `M${x + (primeira ? raio : 0)},${y}`
            + `h${comprimento - (primeira ? raio : 0) - (ehUltima ? raio : 0)}`
            + (ehUltima ? `a${raio},${raio} 0 0 1 ${raio},${raio}` : "")
            + `v${espessura - (ehUltima ? raio * 2 : 0)}`
            + (ehUltima ? `a${raio},${raio} 0 0 1 ${-raio},${raio}` : "")
            + `h${-(comprimento - (primeira ? raio : 0) - (ehUltima ? raio : 0))}`
            + (primeira ? `a${raio},${raio} 0 0 1 ${-raio},${-raio}` : "")
            + `v${-(espessura - (primeira ? raio * 2 : 0))}`
            + (primeira ? `a${raio},${raio} 0 0 1 ${raio},${-raio}` : "")
            + "Z";

        const caminho = svg("path", { d, class: "chart-mark--" + fatia.slot });

        const centro = x + comprimento / 2;

        const mostrar = () => {
            montarBalao(tip, fatia.rotulo, [
                { slot: fatia.slot, rotulo: "Gerado", valor: formatarValor(fatia.valor, grafico) },
                { rotulo: "Participação", valor: formatarNumero(fatia.valor / total * 100, 2) + " %" },
            ]);
            posicionarBalao(tip, plot, centro, y - 8);
        };

        caminho.addEventListener("pointerenter", mostrar);
        raiz.appendChild(caminho);

        // Sem rótulo dentro do segmento, de propósito. Branco sobre o oliva do
        // slot 4 dá 3,63:1 — passa como marca gráfica, reprova como texto de
        // 12px —, e uma fatia pequena ainda cortaria o número pela metade. A
        // legenda logo abaixo traz o percentual de cada parte, sem essas duas
        // armadilhas.
        x += bruto;
    });
}

/* =========================================================================
   Dobra da cauda

   Numa rosca a ordem das fatias é o peso de cada uma, então QUALQUER par pode
   acabar encostado — o teste que vale ali é todos-contra-todos, e ele é bem
   mais duro que o de vizinhos. Com a paleta deste projeto, três slots passam
   nesse teste e quatro não passam: o quarto colide com um dos três sob
   daltonismo, e nenhuma reordenação resolve, porque o teste não depende de
   ordem.

   Por isso a cauda dobra em "Outros" em vez de ganhar uma cor nova. É a mesma
   regra em qualquer paleta: a partir de um certo número de fatias, cor deixa
   de distinguir e o que responde "qual é qual" passa a ser a tabela.
   ========================================================================= */

export const MAX_FATIAS_COLORIDAS = 3;

export function dobrarCauda(fatias, maximo = MAX_FATIAS_COLORIDAS) {
    if (fatias.length <= maximo) return fatias;

    const cabeca = fatias.slice(0, maximo);
    const cauda = fatias.slice(maximo);

    return [...cabeca, {
        rotulo: "Outros",
        slot: "other",
        valor: cauda.reduce((soma, fatia) => soma + fatia.valor, 0),
        detalhe: cauda.map((fatia) => fatia.rotulo).join(", "),
    }];
}

/* =========================================================================
   Tabela equivalente

   O mesmo dado do gráfico, em tabela, sempre presente no DOM. É o caminho
   não visual para os números e o que garante que nada fique preso atrás de um
   balão que só aparece com o ponteiro em cima.
   ========================================================================= */

function criarTabelaEquivalente(grafico) {
    const { colunas, linhas } = grafico.tabela;

    const wrap = elemento("div", "visually-hidden");
    const tabela = elemento("table");

    tabela.appendChild(elemento("caption", null, grafico.titulo + " — os mesmos números do gráfico, em tabela."));

    const thead = elemento("thead");
    const cabecalho = elemento("tr");
    colunas.forEach((coluna) => {
        const th = elemento("th", null, coluna);
        th.scope = "col";
        cabecalho.appendChild(th);
    });
    thead.appendChild(cabecalho);
    tabela.appendChild(thead);

    const tbody = elemento("tbody");
    linhas.forEach((celulas) => {
        const tr = elemento("tr");
        celulas.forEach((celula) => tr.appendChild(elemento("td", null, celula)));
        tbody.appendChild(tr);
    });
    tabela.appendChild(tbody);

    wrap.appendChild(tabela);
    return wrap;
}

/* =========================================================================
   Legenda
   ========================================================================= */

function criarLegenda(itens) {
    const lista = elemento("ul", "chart__legend");

    itens.forEach((item) => {
        const li = elemento("li", "chart__legend-item");
        li.appendChild(elemento("span", "chart__swatch chart__swatch--" + item.slot));
        li.appendChild(elemento("span", null, item.rotulo));
        if (item.valor) li.appendChild(elemento("strong", null, item.valor));
        lista.appendChild(li);
    });

    return lista;
}

/* =========================================================================
   Desenho e redesenho
   ========================================================================= */

/** node do card -> função que o redesenha. WeakMap: nó descartado no
    repintar do setor não fica preso na memória. */
const DESENHOS = new WeakMap();

function desenharUm(bloco) {
    const desenhar = DESENHOS.get(bloco);
    if (desenhar) desenhar();
}

/**
 * Redesenha os gráficos que estiverem dentro de `raiz`.
 *
 * Existe por causa das abas: um painel com [hidden] tem largura zero, e um
 * gráfico medido ali sairia sem desenho nenhum. Quem revela a aba chama isto.
 */
export function redesenharGraficos(raiz = document) {
    raiz.querySelectorAll("[data-chart]").forEach(desenharUm);
}

let redesenhoPendente = null;

window.addEventListener("resize", () => {
    // Um quadro só por rajada de redimensionamento: arrastar a borda da
    // janela dispara dezenas de eventos por segundo.
    if (redesenhoPendente) cancelAnimationFrame(redesenhoPendente);
    redesenhoPendente = requestAnimationFrame(() => {
        redesenhoPendente = null;
        redesenharGraficos();
    });
});

/* =========================================================================
   Construção do card
   ========================================================================= */

function temDado(grafico) {
    if (grafico.tipo === "composicao") {
        return (grafico.fatias ?? []).some((fatia) => fatia.valor > 0);
    }

    return (grafico.series ?? []).some((serie) =>
        serie.valores.some((valor) => valor !== null && valor !== undefined && valor > 0));
}

export function criarGrafico(grafico) {
    const bloco = elemento("section", "card card--dense chart");
    bloco.dataset.chart = grafico.id ?? grafico.tipo;

    const corpo = elemento("div", "card__body");

    const cabecalho = elemento("div", "table-head");
    cabecalho.appendChild(elemento("h4", "table-head__title", grafico.titulo));
    if (grafico.nota) cabecalho.appendChild(elemento("p", "table-head__note", grafico.nota));
    corpo.appendChild(cabecalho);

    if (!temDado(grafico)) {
        corpo.appendChild(elemento("p", "chart__empty", grafico.vazio ?? "Nenhum lançamento no período selecionado."));
        bloco.appendChild(corpo);
        return bloco;
    }

    const plot = elemento("div", "chart__plot");

    const desenho = svg("svg", { class: "chart__svg", role: "img", "aria-label": grafico.descricao });
    plot.appendChild(desenho);

    const tip = elemento("div", "chart__tip");
    tip.hidden = true;
    plot.appendChild(tip);

    // O balão some ao sair da área do desenho — nunca fica pendurado sobre um
    // dado que o ponteiro já deixou para trás.
    plot.addEventListener("pointerleave", () => {
        esconderBalao(tip);
        desenho.querySelectorAll(".chart-band.is-active").forEach((node) => node.classList.remove("is-active"));
    });

    corpo.appendChild(plot);

    // Legenda a partir de duas séries. Com uma só, o título do card já diz o
    // que está plotado e um quadrinho sozinho seria repetição paga em altura.
    const legenda = grafico.tipo === "composicao"
        ? grafico.fatias.filter((fatia) => fatia.valor > 0)
        : grafico.series;

    if (legenda.length > 1) {
        corpo.appendChild(criarLegenda(legenda.map((item) => ({
            slot: item.slot,
            rotulo: item.rotulo,
            valor: item.legenda,
        }))));
    }

    if (grafico.rodape) corpo.appendChild(elemento("p", "chart__foot", grafico.rodape));
    if (grafico.tabela) corpo.appendChild(criarTabelaEquivalente(grafico));

    bloco.appendChild(corpo);

    DESENHOS.set(bloco, () => {
        const largura = plot.clientWidth;
        const altura = plot.clientHeight;

        // Aba fechada ou card ainda sem layout: sai sem desenhar e espera o
        // chamado de redesenharGraficos() de quem revelar o painel.
        if (!largura || !altura) return;

        desenho.setAttribute("viewBox", `0 0 ${largura} ${altura}`);
        desenho.replaceChildren();
        esconderBalao(tip);

        if (grafico.tipo === "colunas-empilhadas") {
            desenharColunasEmpilhadas(desenho, plot, tip, grafico, largura, altura);
        } else if (grafico.tipo === "linha") {
            desenharLinha(desenho, plot, tip, grafico, largura, altura);
        } else if (grafico.tipo === "composicao") {
            const fatias = grafico.fatias.filter((fatia) => fatia.valor > 0);
            const desenhavel = { ...grafico, fatias };

            if (fatias.length >= 3) desenharRosca(desenho, plot, tip, desenhavel, largura, altura);
            else desenharBarraComposicao(desenho, plot, tip, desenhavel, largura, altura);
        }
    });

    // O primeiro desenho precisa da largura medida, que só existe depois de o
    // nó entrar no DOM — daí esperar um quadro em vez de desenhar aqui.
    requestAnimationFrame(() => desenharUm(bloco));

    return bloco;
}
