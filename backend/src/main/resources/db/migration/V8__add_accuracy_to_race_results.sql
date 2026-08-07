ALTER TABLE race_results
    ADD COLUMN correct_chars INT NOT NULL DEFAULT 0,
    ADD COLUMN accuracy     INT NOT NULL DEFAULT 0;
