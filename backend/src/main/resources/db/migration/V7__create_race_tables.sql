CREATE TABLE race_sessions (
    session_id      BIGSERIAL PRIMARY KEY,
    room_code       VARCHAR(10)     NOT NULL,
    text_id         BIGINT          NOT NULL,
    text_type       VARCHAR(20)     NOT NULL,
    is_private      BOOLEAN         NOT NULL DEFAULT false,
    started_at      TIMESTAMP       NOT NULL,
    finished_at     TIMESTAMP       NOT NULL
);

CREATE TABLE race_results (
    result_id       BIGSERIAL PRIMARY KEY,
    session_id      BIGINT          NOT NULL REFERENCES race_sessions(session_id) ON DELETE CASCADE,
    user_id         BIGINT          NOT NULL,
    finish_rank     INT             NOT NULL,
    final_wpm       INT             NOT NULL,
    error_count     INT             NOT NULL DEFAULT 0,
    finished        BOOLEAN         NOT NULL DEFAULT false
);

CREATE INDEX idx_race_results_session ON race_results(session_id);
CREATE INDEX idx_race_results_user    ON race_results(user_id);