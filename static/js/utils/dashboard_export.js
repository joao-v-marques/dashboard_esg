/**
 * Exportação do painel em CSV.
 *
 * Sai do que já está carregado na tela — os mesmos números, com os mesmos
 * períodos escolhidos em cada setor. Nenhuma busca nova: exportar não pode
 * devolver um recorte diferente do que a diretoria acabou de ver.
 *
 * Duas escolhas de formato, ambas por causa do Excel em pt-BR:
 *   - separador ";" e não ",", porque a vírgula é o separador decimal;
 *   - BOM no começo do arquivo, senão o Excel abre UTF-8 como ANSI e
 *     "Resíduos" vira "ResÃ­duos".
 *
 * Setor que ainda não carregou (ou que falhou) entra no arquivo com o motivo
 * escrito, em vez de sumir sem aviso.
 */

import { formatarNumero, SEM_DADO } from "./format_ptbr.js";

const SEPARADOR = ";";
const BOM = "﻿";

/**
 * Escapa um campo. Aspas dobram, e qualquer campo com separador, aspas ou
 * quebra de linha vai entre aspas.
 */
function campo(valor) {
    const texto = valor === null || valor === undefined ? "" : String(valor);

    if (/[";\r\n]/.test(texto)) return '"' + texto.replace(/"/g, '""') + '"';

    return texto;
}

function linha(celulas) {
    return celulas.map(campo).join(SEPARADOR);
}

/** Uma célula de tabela já resolvida vira o texto que aparece na tela. */
function celulaComoTexto(coluna, celula) {
    if (coluna.tipo === "numero") {
        const objeto = celula && typeof celula === "object";
        const valor = objeto ? celula.valor : celula;
        const decimais = (objeto ? celula.decimais : undefined) ?? coluna.decimais ?? 0;
        return formatarNumero(valor, decimais);
    }

    if (coluna.tipo === "pill") return celula.texto;

    return celula ?? SEM_DADO;
}

/**
 * Monta o CSV inteiro.
 *
 * @param {Array} blocos  [{ setor, estado }] na ordem em que aparecem na tela,
 *                        onde `estado` é o registro do orquestrador:
 *                        { status, dados, periodo, kpis, graficos, tabelas }.
 */
export function montarCsv(blocos) {
    const linhas = [];

    linhas.push(linha(["Painel de indicadores ESG"]));
    linhas.push(linha(["Exportado em", new Date().toLocaleString("pt-BR")]));

    blocos.forEach(({ setor, estado }) => {
        linhas.push("");
        linhas.push(linha([setor.nome.toUpperCase()]));
        linhas.push(linha(["Período", setor.rotuloPeriodo(estado.periodo)]));

        if (estado.status !== "pronto") {
            linhas.push(linha([
                estado.status === "erro"
                    ? "Dados indisponíveis no momento da exportação."
                    : "Dados ainda carregando no momento da exportação.",
            ]));
            return;
        }

        linhas.push("");
        linhas.push(linha(["Indicador", "Valor", "Unidade"]));
        estado.kpis.forEach((kpi) => {
            linhas.push(linha([kpi.rotulo, formatarNumero(kpi.valor, kpi.decimais ?? 0), kpi.unidade || ""]));
        });

        // Os gráficos entram como tabela: um CSV não tem desenho, e a série
        // mensal é justamente o que se quer levar para a planilha. Sai a
        // tabela equivalente que o próprio gráfico já carrega no DOM — o
        // mesmo recorte, os mesmos números, formatados uma vez só.
        (estado.graficos ?? []).forEach((grafico) => {
            if (!grafico.tabela) return;

            linhas.push("");
            linhas.push(linha([grafico.titulo]));
            linhas.push(linha(grafico.tabela.colunas));
            grafico.tabela.linhas.forEach((celulas) => linhas.push(linha(celulas)));
        });

        estado.tabelas.forEach((tabela) => {
            linhas.push("");
            linhas.push(linha([tabela.titulo]));
            linhas.push(linha(tabela.colunas.map((coluna) => coluna.titulo)));
            tabela.linhas.forEach((celulas) => {
                linhas.push(linha(tabela.colunas.map((coluna, indice) => celulaComoTexto(coluna, celulas[indice]))));
            });
        });
    });

    return BOM + linhas.join("\r\n");
}

/** Nome do arquivo com a data de hoje: indicadores-esg-2026-08-19.csv */
export function nomeDoArquivo() {
    return "indicadores-esg-" + new Date().toISOString().slice(0, 10) + ".csv";
}

/**
 * Entrega o arquivo ao navegador.
 *
 * O objeto de URL é revogado logo depois do clique: sem isso o blob fica
 * preso na memória da aba até a página ser recarregada.
 */
export function baixarCsv(conteudo, nome) {
    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}
