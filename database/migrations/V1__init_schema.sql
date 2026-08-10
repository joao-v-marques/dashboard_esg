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
    1, -- Role de administrator
    1 -- Relacionado ao setor do TIC
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