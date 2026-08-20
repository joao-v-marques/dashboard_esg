CREATE DATABASE dashboard_esg;

-- Tabela de roles (permissões) dos usuários
CREATE TABLE roles (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- Tabela de setores, usada principalmente para usuários
CREATE TABLE sectors (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- Tabela de usuários
CREATE TABLE users (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role_id INT NOT NULL,
    sector_id INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT fk_user_sector FOREIGN KEY (sector_id) REFERENCES sectors(id)
);

-- Tabela das unidades. SEDE, Centro Médico e Espaço Viver Bem
CREATE TABLE units (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(155) NOT NULL UNIQUE,
    code VARCHAR(20) UNIQUE NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela do tipo de residuo, temos atualmente apenas 3: Não Reciclavel, Reciclavel, Organico
CREATE TABLE waste_types (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    is_recyclable BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela do registro de residuos, vai ser inserida toda semana, de acordo com o Júnior
CREATE TABLE waste_records (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    record_date DATE NOT NULL,
    unit_id INT NOT NULL,
    waste_type_id INT NOT NULL,
    weight_kg NUMERIC(12, 3) NOT NULL, -- PESO EM KG
    observations TEXT,

    inserted_by INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    updated_by INT,

    -- Foreign Keys
    CONSTRAINT fk_waste_unit FOREIGN KEY (unit_id) REFERENCES units(id),
    CONSTRAINT fk_waste_type FOREIGN KEY (waste_type_id) REFERENCES waste_types(id),
    CONSTRAINT fk_waste_user FOREIGN KEY (inserted_by) REFERENCES users(id),
    CONSTRAINT fk_waste_update_user FOREIGN KEY (updated_by) REFERENCES users(id),

    -- Constraints de CHECK
    CONSTRAINT ck_waste_weight CHECK (weight_kg >= 0),
    CONSTRAINT uq_unique_waste_record UNIQUE (record_date, unit_id, waste_type_id) -- CONSTRAINT QUE IMPEDE DE LANÇAR COM A MESMA DATA, MESMA UNIDADE E MESMO TIPO TUDO JUNTO
);

-- Tabela para inserção/manipulação de valores energéticos
-- Basicamente cada conta (mensalmente) será inserida no sistema, uma linha por unidade + competência
-- CREATE TABLE energy_records (
--     id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

--     -- Informações principais
--     competencia DATE NOT NULL, -- mês de referência da conta (dia 1)
--     vencimento DATE NOT NULL,
--     unit_id INT NOT NULL,

--     consumo_total_kwh NUMERIC(12, 3) NOT NULL,
--     consumo_total_valor NUMERIC(12, 2) NOT NULL,
--     energia_compensada_kwh NUMERIC(12, 3) NOT NULL DEFAULT 0, -- kWh compensado/gerado (GD própria ou recebida de outra unidade)
--     energia_compensada_valor NUMERIC(12, 2) NOT NULL DEFAULT 0,
--     valor_a_pagar NUMERIC(12, 2) NOT NULL,
--     saldo_final_kwh NUMERIC(12, 3), -- saldo acumulado de créditos de energia no fim do mês
--     observations TEXT,

--     -- Informações para auditoria
--     inserted_by INT NOT NULL,
--     created_at TIMESTAMPTZ DEFAULT NOW(),
--     updated_at TIMESTAMPTZ,
--     updated_by INT,

--     -- Foreign Keys
--     CONSTRAINT fk_energy_unit FOREIGN KEY (unit_id) REFERENCES units(id),
--     CONSTRAINT fk_energy_user FOREIGN KEY (inserted_by) REFERENCES users(id),
--     CONSTRAINT fk_energy_update_user FOREIGN KEY (updated_by) REFERENCES users(id),

--     -- Constraints de CHECK
--     CONSTRAINT ck_energy_consumo CHECK (consumo_total_kwh >= 0),
--     CONSTRAINT uq_energy_record UNIQUE (competencia, unit_id) -- IMPEDE DE LANÇAR DUAS CONTAS PARA A MESMA UNIDADE NO MESMO MÊS
-- );


-- Inserção de todos os setores iniciais da aplicação
INSERT INTO sectors (name)
VALUES ('TIC'), ('Compras');

-- Inserção de todas as roles iniciais da aplicação
INSERT INTO roles (name)
VALUES ('administrator'), ('employee');

-- Inserção de todos os usuários iniciais da aplicação
INSERT INTO users (username, name, password_hash, email, role_id, sector_id)
VALUES (
    'admin',
    'Administrador do Sistema',
    '$argon2id$v=19$m=65536,t=3,p=4$LZh7MQYZvSLvbZ42dtFk8A$R1vNqZD/XoQyhJOoOjX7BY8HtYj7mpFsxGSxbSd2or4',
    'joaovictor@unimedssp.coop.br',
    1,
    1
);

-- Inserção de todas as unidades iniciais da aplicação
INSERT INTO units (name, code)
VALUES
    ('Sede', 'SEDE'),
    ('Centro Médico', 'CM'),
    ('Espaço Viver Bem', 'EVB');

-- Inserção de todos os tipos de resíduos iniciais da aplicação
INSERT INTO waste_types (name, code, is_recyclable)
VALUES 
    ('Reciclável', 'REC', true),
    ('Não Reciclável', 'NREC', false),
    ('Orgânico', 'ORG', true);

CREATE TABLE nip_natures (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT
);

INSERT INTO nip_natures (name, description)
VALUES
    ('Assistencial', 'NIPs de natureza assistencial'),
    ('Não Assistencial', 'NIPs que não são de natureza assistencial');

CREATE TABLE nip_status (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT
);

INSERT INTO nip_status (name, description)
VALUES
    ('Finalizada - NIP Assistencial Inativa', 'NIP de natureza assistencial encerrada por inatividade, sem novas movimentações no prazo previsto'),
    ('Finalizada - NIP Não Assistencial Inativa', 'NIP de natureza não assistencial encerrada por inatividade, sem novas movimentações no prazo previsto'),
    ('Finalizada - NIP Assistencial Não Procedente', 'NIP de natureza assistencial encerrada após a análise concluir que a demanda do beneficiário não era procedente'),
    ('Finalizada por Inexistência de Indício de Infração', 'NIP encerrada após análise não identificar indícios de infração pela operadora'),
    ('Finalizada - NIP Resolvida (RVE)', 'NIP encerrada com Resolução Verificada na Etapa (RVE), ou seja, a demanda do beneficiário foi atendida pela operadora'),
    ('Aguardando Classificação da Demanda NIP - RN388', 'NIP em aberto aguardando a classificação da demanda conforme os critérios da RN 388 da ANS'),
    ('Aguardando Abertura de Processo', 'NIP com demanda não resolvida na fase de mediação, aguardando a abertura de processo administrativo sancionador pela ANS'),
    ('Finalizada por Duplicidade', 'NIP encerrada por ser registro duplicado de outra demanda já existente'),
    ('Finalizada - NIP Assistencial Não Resolvida', 'NIP de natureza assistencial encerrada sem que a demanda do beneficiário fosse atendida pela operadora');

CREATE TABLE nips (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    nip_number VARCHAR(15) NOT NULL UNIQUE,
    notification_date DATE NOT NULL,
    demand_code VARCHAR(50) NOT NULL,
    protocol_code VARCHAR(50) NOT NULL UNIQUE,
    beneficiary_name VARCHAR(150) NOT NULL,
    beneficiary_cpf CHAR(11) NOT NULL,
    description TEXT,
    response_description TEXT,

    status_id INT NOT NULL,    -- FK nip_status
    nature_id INT NOT NULL,    -- FK nip_nature
    inserted_by INT NOT NULL,  -- FK users
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    updated_by INT,            -- FK users

    -- FOREIGN KEYS
    CONSTRAINT fk_nip_status FOREIGN KEY (status_id) REFERENCES nip_status(id),
    CONSTRAINT fk_nip_nature FOREIGN KEY (nature_id) REFERENCES nip_natures(id),  
    CONSTRAINT fk_nip_inserted_by FOREIGN KEY (inserted_by) REFERENCES users(id),
    CONSTRAINT fk_nip_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);
