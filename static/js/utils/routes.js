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
    dashboard: `${BASE_PATH}/dashboard`,
    login: `${BASE_PATH}/login`,
    wasteRecords: `${BASE_PATH}/residuos`,
};

/**
 * Endpoints da API.
 *
 * Padrão do backend: `${BASE_PATH}/api/<endpoint>` — as páginas ficam na raiz
 * do prefixo, a API sob /api. Endpoint novo entra aqui seguindo essa forma.
 *
 * Os de autenticação já existem (routes/auth_controller.py), assim como os de
 * resíduos (routes/waste_records_controller.py, waste_types_controller.py,
 * unit_controller.py, waste_dashboard_controller.py). O de overview ainda
 * não: quem o criar deve virar OVERVIEW_ENABLED em pages/home.js no mesmo
 * commit.
 */
export const API = {
    login: `${BASE_PATH}/api/login`,
    logout: `${BASE_PATH}/api/logout`,
    currentUser: `${BASE_PATH}/api/me`,
    overview: `${BASE_PATH}/api/overview`,
    wasteRecords: `${BASE_PATH}/api/waste-records`,
    wasteTypes: `${BASE_PATH}/api/waste-types`,
    units: `${BASE_PATH}/api/units`,
    wasteDashboard: `${BASE_PATH}/api/residuos/dashboard`,
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
