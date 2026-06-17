CREATE TABLE roles (
   id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
   name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_id BIGINT NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NULL,
    first_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NULL,
    country VARCHAR(100) NULL,
    provider VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deactivated_at TIMESTAMP NULL DEFAULT NULL,
    avatar VARCHAR(500) NULL,
    streak INT NULL,

    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT ON UPDATE CASCADE,

    UNIQUE (username),
    UNIQUE (email)
);

CREATE TABLE user_oauth_providers (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    provider    VARCHAR(50) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    UNIQUE (provider, provider_id)
);

CREATE TABLE texts (
    text_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    created_by BIGINT NULL,
    title VARCHAR(100) NOT NULL,
    author VARCHAR(100) NOT NULL,
    source VARCHAR(100) NOT NULL,
    language VARCHAR(50) NOT NULL DEFAULT 'en',
    content TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    char_length INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_texts_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_texts_custom ON texts (is_custom);
CREATE INDEX idx_texts_created_by ON texts (created_by);

CREATE TABLE words (
    word_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    word VARCHAR(255) NOT NULL,
    language VARCHAR(50) NOT NULL DEFAULT 'en',
    difficulty VARCHAR(50) NOT NULL
);

CREATE TABLE typing_results (
    typing_result_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    text_id BIGINT NULL,
    finished_at TIMESTAMP NULL,
    duration_ms INTEGER NOT NULL,
    time_constraint_ms INTEGER NULL,
    wpm DECIMAL(5,2) NOT NULL,
    accuracy DECIMAL(5,2) NOT NULL,
    mode VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tr_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_tr_text FOREIGN KEY (text_id) REFERENCES texts(text_id) ON DELETE CASCADE
);

CREATE INDEX idx_tr_user_created ON typing_results (user_id, created_at);
CREATE INDEX idx_tr_text ON typing_results (text_id);

CREATE TABLE user_stats (
    user_stats_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    average_speed DECIMAL(5,2) NULL,
    best_speed DECIMAL(5,2) NULL,
    last_speed DECIMAL(5,2) NULL,
    text_completed INTEGER NULL,

    CONSTRAINT fk_user_stats_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE (user_id)
);

