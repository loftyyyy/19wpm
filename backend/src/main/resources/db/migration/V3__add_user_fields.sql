ALTER TABLE users
    ADD COLUMN avatar VARCHAR(500) NULL AFTER deactivated_at,
    ADD COLUMN streak INT NULL AFTER avatar;
