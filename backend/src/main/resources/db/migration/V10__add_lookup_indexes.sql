-- Indexes for content lookups filtered by language + difficulty/type.
-- PostgreSQL does not create these automatically, and the previous schema only
-- indexed texts(is_custom) and texts(created_by), leaving the content-selection
-- queries (random words/texts, per-type text listings) to scan the whole table.

-- words are selected by (language, difficulty) when generating word tests.
CREATE INDEX idx_words_language_difficulty ON words (language, difficulty);

-- texts are selected by (language, type) for random text, and by language alone.
CREATE INDEX idx_texts_language_type ON texts (language, type);

-- texts are also listed by type alone (short/medium/long/thicc galleries).
CREATE INDEX idx_texts_type ON texts (type);
