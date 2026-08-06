CREATE DATABASE dashboard_esg;

CREATE TABLE roles (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE sectors (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

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

INSERT INTO sectors (name)
VALUES ('TIC'), ('Compras');

INSERT INTO roles (name)
VALUES ('administrator'), ('employee');

INSERT INTO users (username, name, password_hash, email, role_id, sector_id)
VALUES (
    'admin',
    'Administrador do Sistema',
    '$argon2id$v=19$m=65536,t=3,p=4$LZh7MQYZvSLvbZ42dtFk8A$R1vNqZD/XoQyhJOoOjX7BY8HtYj7mpFsxGSxbSd2or4',
    'joaovictor@unimedssp.coop.br',
    1, -- Role de administrator
    1 -- Relacionado ao setor do TIC
);