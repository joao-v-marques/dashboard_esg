/**
 * Tradução do perfil de acesso para o rótulo que vai à tela.
 *
 * Mora aqui, e não na página, porque mais de uma tela vai mostrar o mesmo
 * perfil: o usuário logado na topbar e, mais adiante, a listagem de usuários.
 * Um mapa por página faria o mesmo perfil aparecer com nome diferente em cada
 * uma.
 *
 * TODO: alinhar as chaves com os perfis que forem gravados no banco quando a
 * autorização existir.
 */

/** Nome do perfil no banco → rótulo de tela. */
const ROLE_LABELS = {
    administrator: "Administrador",
    employee: "Funcionário",
};

/**
 * Perfil desconhecido cai no nome cru: é melhor mostrar "supervisor" do que
 * esconder que existe um perfil novo que a tela ainda não traduz.
 */
export function roleLabel(roleName) {
    return ROLE_LABELS[roleName] ?? roleName;
}
