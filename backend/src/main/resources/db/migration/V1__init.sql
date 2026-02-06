CREATE TABLE users (
    user_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NULL,
    country VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_users_username (username),
    UNIQUE KEY uk_users_email (email)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE texts (
    text_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    created_by BIGINT NULL,             -- who made the custom text (NULL for preset quotes)
    title VARCHAR(100) NOT NULL,
    author VARCHAR(100) NOT NULL,
    source VARCHAR(100) NOT NULL,
    language VARCHAR(50) NOT NULL DEFAULT 'en',
    content TEXT NOT NULL,
    word_count INT NOT NULL,
    char_length INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_texts_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,

    INDEX idx_texts_custom (is_custom),
    INDEX idx_texts_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE typing_results (

    typing_result_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    text_id BIGINT NOT NULL,
    finished_at DATETIME NULL,
    duration_ms INT NOT NULL,
    time_constraint_ms INT NULL,
    wpm DECIMAL(5,2) NOT NULL,
    accuracy DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tr_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_tr_text FOREIGN KEY (text_id) REFERENCES texts(text_id) ON DELETE CASCADE,

    INDEX idx_tr_user_created (user_id, created_at),
    INDEX idx_tr_text (text_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE user_stats (

    user_stats_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    average_speed DECIMAL(5,2) NULL,
    best_speed DECIMAL(5,2) NULL,
    last_speed DECIMAL(5,2) NULL,
    text_completed INT NULL,

    CONSTRAINT fk_user_stats_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_stats_user (user_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
