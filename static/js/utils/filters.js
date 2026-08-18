/**
 * Barra de filtros de tabela, na parte que é igual em toda tela que tem uma.
 *
 * Hoje: manter o botão "Limpar filtros" coerente com o que está aplicado. Sem
 * isso o botão fica sempre aceso, inclusive na primeira visita, quando não há
 * um único filtro preenchido — um controle que na maior parte do tempo não faz
 * nada, e que não distingue "a tabela está vazia" de "meus filtros esconderam
 * tudo".
 *
 * Contrato com o HTML (dentro de .toolbar):
 *   [data-filter-clear]  botão; nasce disabled e é ligado por aqui
 *   [data-filter-count]  contagem dentro do botão; nasce hidden
 *
 * Quem chama passa a mesma lista de campos que já usa para aplicar os filtros,
 * então não há um segundo lugar dizendo quais campos existem na tela.
 */

/**
 * Sincroniza botão e contagem com os campos preenchidos.
 *
 * "Preenchido" é `value !== ""` — vale para a busca, para os selects (a opção
 * de placeholder tem valor vazio) e para os campos de data. Devolve quantos
 * filtros estão valendo, caso a página queira usar o número para outra coisa.
 */
export function syncFilterClear(inputs) {
    const active = inputs.filter((input) => input && input.value !== "").length;

    const button = document.querySelector("[data-filter-clear]");
    const count = document.querySelector("[data-filter-count]");

    if (button) button.disabled = active === 0;

    if (count) {
        count.textContent = active ? String(active) : "";
        count.hidden = active === 0;
    }

    // O número dentro do botão é visual; sem isto o leitor de tela anunciaria
    // só "Limpar filtros", sem dizer quantos.
    if (button) {
        button.setAttribute(
            "aria-label",
            active === 0
                ? "Limpar filtros — nenhum filtro aplicado"
                : `Limpar filtros — ${active} ${active === 1 ? "filtro aplicado" : "filtros aplicados"}`,
        );
    }

    return active;
}
