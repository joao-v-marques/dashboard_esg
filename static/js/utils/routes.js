/**
 * Endereços da aplicação, em um lugar só.
 *
 * Sem template engine no front-end, nenhuma URL é resolvida no servidor: o HTML
 * e o JS escrevem o caminho literal. Espalhar "/dashboard-esg" por arquivo faria
 * uma troca de prefixo virar caça ao string em toda a base — aqui é uma linha.
 *
 * BASE_PATH espelha PREFIX de configs.py. Os dois mudam juntos; mudar só um
 * quebra a navegação sem erro de sintaxe em lugar nenhum.
 */

/** Espelha PREFIX em configs.py. */
export const BASE_PATH = "/dashboard-esg";

/** Telas renderizadas pelo Flask (render_template). */
export const PAGES = {
    home: `${BASE_PATH}/home`,
    login: `${BASE_PATH}/login`,
};

/**
 * Endpoints da API.
 *
 * TODO: nenhum deles existe ainda no backend. Quem os criar deve virar a
 * respectiva flag (AUTH_ENABLED em pages/shell.js, OVERVIEW_ENABLED em
 * pages/home.js) no mesmo commit.
 */
export const API = {
    currentUser: `${BASE_PATH}/api/v1/users/me`,
    overview: `${BASE_PATH}/api/v1/overview`,
};

/**
 * Diz se um caminho é o da página aberta agora.
 *
 * A barra final é ignorada dos dois lados: "/dashboard-esg/home" e
 * "/dashboard-esg/home/" são a mesma tela, e o item da sidebar não pode deixar
 * de se marcar como atual por causa dela.
 */
export function isCurrentPage(href) {
    const normalize = (path) => path.replace(/\/+$/, "");
    return normalize(window.location.pathname) === normalize(href);
}
