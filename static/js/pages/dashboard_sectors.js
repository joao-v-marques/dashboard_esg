/**
 * Configuração dos setores do painel — a única coisa que se escreve para um
 * setor novo entrar.
 *
 * Cada entrada descreve um setor por inteiro: como ele se apresenta, que
 * filtro de período usa, onde busca o dado, quais indicadores tira dele, que
 * tabelas detalha, que metas acompanha e que apontamentos exibe. Os
 * componentes (js/utils/dashboard_widgets.js) e a orquestração
 * (js/pages/dashboard.js) leem essa descrição e não conhecem nenhum setor
 * pelo nome.
 *
 * FORMATO
 *
 *   id, nome              identificação; `nome` é o rótulo da aba e do bloco
 *   resumo                a frase que explica o setor em uma linha
 *   filtro.tipo           "intervalo" | "ano" | "mes-ano"
 *   periodoInicial()      estado do filtro ao abrir a página
 *   periodoAnterior(p)    o período imediatamente anterior, para a variação;
 *                         devolver null desliga a comparação do setor
 *   rotuloPeriodo(p)      período por extenso, para nota de tabela e export
 *   buscar(p)             Promise com o dado cru da API
 *   kpis                  descritores; `valor(dados)` resolve o número
 *   tabelas               descritores; `linhas(dados)` resolve as células
 *   metas(dados)          barras de progresso — [] enquanto não houver alvo
 *   notas(dados)          apontamentos curtos — [] quando não houver
 *   erro                  título e texto do estado de falha do setor
 *
 * SOBRE METAS E APONTAMENTOS
 *
 * Os dois nascem vazios de propósito. Nenhuma das duas fontes de hoje guarda
 * alvo de meta nem justificativa de desvio, e um painel de diretoria não é
 * lugar para número de exemplo: quando a meta existir no banco, ela entra
 * aqui — `metas` devolve a lista e a barra aparece sozinha, sem tocar em
 * componente nem em CSS.
 *
 * SOBRE A VARIAÇÃO vs. PERÍODO ANTERIOR
 *
 * Quem tem `periodoAnterior` faz uma segunda busca, no mesmo endpoint, com o
 * período recuado — não existe endpoint de comparação, e o número mostrado é
 * sempre dado real da própria base. Cooperados devolve null ali por decisão
 * consciente: aquele endpoint conversa com o certificados_cooperados e cada
 * chamada custa quatro requisições àquele sistema; dobrar isso a cada
 * abertura de página não se paga só para colorir uma seta.
 */

import { API } from "../utils/routes.js";
import { formatarDataISO, formatarInteiro, formatarNumero, formatarPercentual } from "../utils/format_ptbr.js";

/* =========================================================================
   Busca
   ========================================================================= */

/**
 * GET autenticado que devolve JSON.
 *
 * O 401 é relançado marcado: a sessão expirada não é falha de um setor — é a
 * página inteira que precisa voltar para o login, e quem trata isso é o
 * orquestrador, uma vez só, e não cada setor por conta própria.
 */
async function buscarJson(url) {
    const resposta = await fetch(url, { credentials: "same-origin" });

    if (resposta.status === 401) {
        const erro = new Error("Sessão expirada");
        erro.sessaoExpirada = true;
        throw erro;
    }

    if (!resposta.ok) throw new Error("A API respondeu " + resposta.status);

    return resposta.json();
}

/* =========================================================================
   Períodos
   ========================================================================= */

/** Aritmética de data em UTC — somar dia em horário local erra no fuso. */
function paraUTC(iso) {
    const [ano, mes, dia] = iso.split("-").map(Number);
    return Date.UTC(ano, mes - 1, dia);
}

function paraISO(utc) {
    return new Date(utc).toISOString().slice(0, 10);
}

const UM_DIA = 24 * 60 * 60 * 1000;

/**
 * A janela de mesma duração encostada antes do período escolhido: um mês
 * compara com o mês anterior, um ano com o ano anterior, e um intervalo
 * qualquer com os mesmos N dias imediatamente anteriores. É a única leitura
 * de "período anterior" que funciona para um filtro de intervalo livre.
 */
function intervaloAnterior({ de, ate }) {
    const inicio = paraUTC(de);
    const fim = paraUTC(ate);
    const duracao = fim - inicio + UM_DIA;

    return {
        de: paraISO(inicio - duracao),
        ate: paraISO(inicio - UM_DIA),
    };
}

/* =========================================================================
   Resíduos
   ========================================================================= */

const RESIDUOS = {
    id: "residuos",
    nome: "Resíduos",
    resumo: "Quanto foi gerado, quanto voltou para a reciclagem e o que sobrou para destinação final, por tipo e por unidade.",

    filtro: { tipo: "intervalo" },

    // Ano corrente inteiro só como ponto de partida: o campo é livre a partir
    // daí, inclusive para antes do início dos lançamentos — nesse caso a API
    // devolve zero em tudo, sem erro.
    periodoInicial() {
        const ano = new Date().getFullYear();
        return { de: ano + "-01-01", ate: ano + "-12-31" };
    },

    periodoAnterior: intervaloAnterior,

    rotuloPeriodo({ de, ate }) {
        return formatarDataISO(de) + " a " + formatarDataISO(ate);
    },

    buscar({ de, ate }) {
        return buscarJson(API.wasteDashboard + "?de=" + de + "&ate=" + ate);
    },

    kpis: [
        {
            id: "gerado",
            sigla: "RG",
            rotulo: "Resíduos gerados",
            unidade: "kg",
            decimais: 2,
            // Gerar menos é a boa notícia — a cor da variação segue a
            // avaliação, não a direção da seta.
            melhorQuando: "menor",
            valor: (dados) => dados.resumo.kg_gerado,
            nota: () => "Todos os tipos, recicláveis e não recicláveis.",
        },
        {
            id: "reciclagem",
            sigla: "RR",
            rotulo: "Resíduos para reciclagem",
            unidade: "kg",
            decimais: 2,
            tom: "accent",
            melhorQuando: "maior",
            valor: (dados) => dados.resumo.kg_reciclado,
            nota: () => "Tipos marcados como recicláveis no cadastro.",
        },
        {
            id: "taxa",
            sigla: "TR",
            rotulo: "Taxa de reciclagem",
            unidade: "%",
            decimais: 2,
            tom: "info",
            melhorQuando: "maior",
            // O valor já é percentual: a variação vai em p.p., não em %.
            pontosPercentuais: true,
            valor: (dados) => dados.resumo.pct_reciclado,
            nota: () => "Reciclado ÷ gerado no período, não a média dos meses.",
        },
    ],

    // A quebra por unidade não entra enquanto a coleta for só da Sede: uma
    // tabela de uma linha só não detalha nada, e sugere uma comparação entre
    // unidades que ainda não existe. O endpoint continua devolvendo
    // `por_unidade` — quando as demais unidades começarem a lançar, ela volta
    // como mais um item desta lista, sem mexer em backend.
    tabelas: [
        {
            titulo: "Composição por tipo de resíduo",
            descricao: "Resíduos gerados no período por tipo, com a destinação e a participação de cada um no total.",
            nota: (dados, periodo) => "kg · " + RESIDUOS.rotuloPeriodo(periodo),
            colunas: [
                { titulo: "Tipo", tipo: "pill" },
                { titulo: "Destinação", tipo: "texto" },
                { titulo: "Gerado", tipo: "numero", decimais: 2 },
                { titulo: "% do gerado", tipo: "numero", decimais: 2 },
            ],
            linhas: (dados) => {
                const total = dados.composicao_por_tipo.reduce((soma, linha) => soma + linha.kg, 0);

                return dados.composicao_por_tipo.map((linha) => [
                    { texto: linha.tipo, classe: linha.is_recyclable ? "pill pill--success" : "pill" },
                    linha.is_recyclable ? "Reciclagem" : "Destinação final",
                    { valor: linha.kg },
                    // O % é sempre recalculado a partir do bruto, como no
                    // resto do painel — nunca guardado pronto.
                    { valor: total ? linha.kg / total * 100 : 0 },
                ]);
            },
        },
    ],

    metas: () => [],
    notas: () => [],

    erro: {
        titulo: "Não foi possível carregar os indicadores de resíduos",
        texto: "Verifique a conexão e atualize a página. Se continuar, avise a equipe responsável pelo sistema.",
    },
};

/* =========================================================================
   Cooperados

   O dado é de outra aplicação (certificados_cooperados): o backend deste app
   chama a API de lá server-to-server e devolve pronto. Se aquele sistema cair,
   só este bloco cai junto — Resíduos ao lado continua de pé.
   ========================================================================= */

const COOPERADOS = {
    id: "cooperados",
    nome: "Cooperados",
    resumo: "Formação em cooperativismo, satisfação e manifestações registradas no ano-base, com a distribuição por faixa de pontuação.",

    filtro: { tipo: "ano" },

    periodoInicial() {
        return { ano: new Date().getFullYear() };
    },

    // Sem comparação por decisão consciente — ver a nota no topo do arquivo.
    periodoAnterior: () => null,

    rotuloPeriodo({ ano }) {
        return "Ano-base " + ano;
    },

    buscar({ ano }) {
        return buscarJson(API.cooperadosDashboard + "?ano=" + ano);
    },

    kpis: [
        {
            id: "capacitados",
            sigla: "CC",
            rotulo: "Capacitados em cooperativismo",
            decimais: 0,
            melhorQuando: "maior",
            valor: (dados) => dados.capacitados_cooperativismo.quantidade,
            nota: (dados) => formatarPercentual(dados.capacitados_cooperativismo.percentual)
                + "% dos " + formatarInteiro(dados.capacitados_cooperativismo.total) + " cooperados.",
        },
        {
            id: "satisfacao",
            sigla: "IS",
            rotulo: "Índice de satisfação",
            unidade: "%",
            decimais: 2,
            tom: "accent",
            melhorQuando: "maior",
            // null quando não há pesquisa cadastrada para o ano pedido — o
            // cartão mostra travessão, nunca o número de outro ano.
            valor: (dados) => dados.indice_satisfacao,
            nota: (dados) => dados.indice_satisfacao === null
                ? "Sem pesquisa de satisfação cadastrada para o ano."
                : "Última pesquisa aplicada no ano-base.",
        },
        {
            id: "manifestacoes",
            sigla: "MR",
            rotulo: "Manifestações registradas",
            decimais: 0,
            tom: "info",
            melhorQuando: "menor",
            valor: (dados) => dados.manifestacoes_registradas,
            nota: () => "Ocorrências abertas por cooperados no ano.",
        },
    ],

    tabelas: [
        {
            titulo: "Cooperados por faixa de pontuação",
            descricao: "Distribuição dos cooperados pelas faixas de pontuação do ano-base.",
            nota: (dados, periodo) => COOPERADOS.rotuloPeriodo(periodo),
            colunas: [
                { titulo: "Faixa", tipo: "pill" },
                { titulo: "Intervalo", tipo: "texto" },
                { titulo: "Cooperados", tipo: "numero", decimais: 0 },
                { titulo: "% do total", tipo: "numero", decimais: 2 },
            ],
            // A cor da pílula é a mesma faixa por faixa do
            // certificados_cooperados (--color-band-* em tokens.css). São
            // cinco faixas lá, então band--1..5 cobre tudo que a API manda.
            linhas: (dados) => dados.cooperados_por_faixa.map((faixa) => [
                { texto: "Faixa " + faixa.faixa, classe: "band band--" + faixa.faixa },
                faixa.de + "% a " + faixa.ate + "%",
                { valor: faixa.quantidade },
                { valor: faixa.percentual },
            ]),
        },
        {
            titulo: "Horas de treinamento por cooperado",
            descricao: "Carga horária de treinamento de cada cooperado ativo no ano-base, com a quantidade de cursos concluídos.",
            // O total no rodapé sai da mesma lista da tabela, e não de um campo
            // pronto da API: somar aqui é o que garante que ele bata com as
            // linhas que estão logo acima.
            nota: (dados, periodo) => {
                const lista = dados.horas_treinamento_por_cooperado;
                const rotulo = COOPERADOS.rotuloPeriodo(periodo);

                // A carga só chega da versão do certificados_cooperados que
                // devolve totalMinutes no relatório anual. Sem ela a coluna fica
                // em travessão e o rodapé diz o porquê — somar zero anunciaria
                // "nenhuma hora de treinamento no ano", que é outra afirmação.
                if (lista.some((cooperado) => cooperado.minutos === null)) {
                    return rotulo + " · carga horária indisponível: o sistema de certificados ainda não a informa";
                }

                const minutos = lista.reduce((soma, cooperado) => soma + cooperado.minutos, 0);

                return rotulo + " · " + formatarNumero(minutos / 60, 2) + " h no total";
            },
            colunas: [
                { titulo: "Cooperado", tipo: "texto" },
                { titulo: "Cursos", tipo: "numero", decimais: 0 },
                { titulo: "Horas de treinamento", tipo: "numero", decimais: 2 },
            ],
            // A API manda minutos, como o curso é lançado no
            // certificados_cooperados. A conversão para hora decimal (1h30 vira
            // 1,50) é feita aqui, e não em h:mm como no painel daquele sistema:
            // esta coluna é numérica, alinha com as demais e sai do CSV como
            // número que o Excel soma — "1:30" sairia como texto.
            linhas: (dados) => dados.horas_treinamento_por_cooperado.map((cooperado) => [
                cooperado.cooperado,
                { valor: cooperado.cursos },
                // null vira travessão em formatarNumero; null / 60 viraria 0, que
                // é exatamente o número que não se pode afirmar aqui.
                { valor: cooperado.minutos === null ? null : cooperado.minutos / 60 },
            ]),
        },
    ],

    metas: () => [],
    notas: () => [],

    erro: {
        titulo: "Não foi possível carregar os indicadores de cooperados",
        texto: "O sistema de certificados e cooperados pode estar fora do ar. Atualize a página em instantes; se continuar, avise a equipe responsável.",
    },
};

/* =========================================================================
   Gestão Jurídica e Regulatória

   Hoje o setor é só NIP (Notificação de Intermediação Preliminar, o
   procedimento da ANS): o painel conta quantas foram notificadas no período e
   quanto delas já está resolvido. Os dois números saem da mesma base que a
   tela de Controle de NIP's — o percentual do cartão e o que se conta na
   listagem filtrando por status são sempre o mesmo número.

   Quais status contam como "resolvida" é decisão do negócio e mora no
   backend (STATUS_RESOLVIDAS em services/nip_dashboard_service.py). Aqui não
   se repete a lista: se ela mudasse em um lugar só, o cartão passaria a
   discordar da API sem nenhum erro aparecer.
   ========================================================================= */

const JURIDICO = {
    id: "juridico",
    nome: "Gestão Jurídica e Regulatória",
    resumo: "NIP's notificadas pela ANS no período e a parcela delas que já foi finalizada como resolvida.",

    filtro: { tipo: "intervalo" },

    // Mesmo ponto de partida de Resíduos — o ano corrente inteiro — para que
    // as duas abas abram falando do mesmo recorte de tempo.
    periodoInicial() {
        const ano = new Date().getFullYear();
        return { de: ano + "-01-01", ate: ano + "-12-31" };
    },

    periodoAnterior: intervaloAnterior,

    rotuloPeriodo({ de, ate }) {
        return formatarDataISO(de) + " a " + formatarDataISO(ate);
    },

    buscar({ de, ate }) {
        return buscarJson(API.juridicoDashboard + "?de=" + de + "&ate=" + ate);
    },

    kpis: [
        {
            id: "nips",
            sigla: "NN",
            rotulo: "Número de NIP's",
            decimais: 0,
            // Ser notificado menos vezes é a boa notícia; a cor da variação
            // segue essa leitura, e não a direção da seta.
            melhorQuando: "menor",
            valor: (dados) => dados.resumo.total,
            nota: () => "NIP's com data de notificação dentro do período.",
        },
        {
            id: "resolvidas",
            sigla: "NR",
            rotulo: "% de NIP's resolvidas",
            unidade: "%",
            decimais: 2,
            tom: "accent",
            melhorQuando: "maior",
            // O valor já é percentual: a variação vai em p.p., não em %.
            pontosPercentuais: true,
            // null quando não houve NIP no período — o cartão mostra travessão,
            // que é diferente de dizer que nenhuma foi resolvida.
            valor: (dados) => dados.resumo.pct_resolvidas,
            nota: (dados) => dados.resumo.total
                ? formatarInteiro(dados.resumo.resolvidas) + " de "
                    + formatarInteiro(dados.resumo.total) + " NIP's finalizadas como resolvidas."
                : "Nenhuma NIP notificada no período.",
        },
    ],

    tabelas: [],
    metas: () => [],
    notas: () => [],

    erro: {
        titulo: "Não foi possível carregar os indicadores jurídicos",
        texto: "Verifique a conexão e atualize a página. Se continuar, avise a equipe responsável pelo sistema.",
    },
};

/**
 * A ordem daqui é a ordem das abas na faixa.
 * Energia, Recursos Hídricos e Emissões entram nesta lista
 * quando tiverem endpoint — nada mais precisa mudar.
 */
export const SETORES = [RESIDUOS, COOPERADOS, JURIDICO];
