/**
 * Trava e libera a rolagem da página por trás de um <dialog> aberto.
 *
 * showModal() torna o fundo inerte, mas não impede a rolagem: sem trava, quem
 * abre um modal continua rodando a roda do mouse e vê a tela inteira passar
 * atrás dele.
 *
 * A trava mora no <html>, e não no <body>, por causa de `html { overflow-y:
 * scroll }` (base.css). Com o elemento raiz declarando overflow, o valor do
 * body deixa de ser propagado para a viewport — `overflow: hidden` no body
 * não trava mais nada e, pior, transforma o body num contêiner de rolagem
 * próprio. A topbar e a sidebar são `position: sticky`: elas passam a se
 * ancorar nesse contêiner, que não rola, em vez da viewport. Com a página
 * rolada, as duas voltavam para a posição estática — a sidebar subia para fora
 * da tela e aparecia cortada assim que um modal abria.
 *
 * Esconder a barra de rolagem devolve ~15px de largura à página e o conteúdo
 * salta de lado ao abrir o modal. Por isso a medida da barra é gravada em
 * --scrollbar-width e .no-scroll a devolve como padding-right. É medido na
 * hora porque a largura muda com o sistema e com o nível de zoom.
 */

/** Trava a rolagem da página. Idempotente: chamar duas vezes não muda nada. */
export function lockPageScroll() {
    const root = document.documentElement;
    if (root.classList.contains("no-scroll")) return;

    root.style.setProperty("--scrollbar-width", `${window.innerWidth - root.clientWidth}px`);
    root.classList.add("no-scroll");
}

/** Devolve a rolagem da página. */
export function unlockPageScroll() {
    const root = document.documentElement;

    root.classList.remove("no-scroll");
    root.style.removeProperty("--scrollbar-width");
}
