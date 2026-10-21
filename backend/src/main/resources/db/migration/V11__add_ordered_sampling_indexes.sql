DROP INDEX IF EXISTS idx_words_language_difficulty;
CREATE INDEX idx_words_language_difficulty_id ON words (language, difficulty, word_id);

DROP INDEX IF EXISTS idx_texts_language_type;
DROP INDEX IF EXISTS idx_texts_custom;
CREATE INDEX idx_texts_language_type_id ON texts (language, type, text_id);
CREATE INDEX idx_texts_preset_type_id ON texts (is_custom, type, text_id);
CREATE INDEX idx_texts_preset_id ON texts (is_custom, text_id);
