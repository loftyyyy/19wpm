ALTER TABLE race_results
    ADD COLUMN claimed_wpm        INT          NOT NULL DEFAULT 0,
    ADD COLUMN server_wpm         INT          NOT NULL DEFAULT 0,
    ADD COLUMN anti_cheat_status  VARCHAR(20)  NOT NULL DEFAULT 'VALID',
    ADD COLUMN anti_cheat_flags   VARCHAR(500);

UPDATE race_results
SET server_wpm = final_wpm,
    claimed_wpm = final_wpm;
