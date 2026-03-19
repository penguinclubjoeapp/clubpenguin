-- Discord account linking table
-- Runs on first postgres container start via docker-entrypoint-initdb.d
--
-- penguin_id logically references penguin(id) from Houdini's schema,
-- but the FK is not added here because Houdini creates its schema at
-- runtime (after init scripts run). Approach for adding the constraint
-- will be decided when #6 (Houdini container) is implemented.

CREATE TABLE IF NOT EXISTS discord_links (
    penguin_id    INTEGER     PRIMARY KEY,
    discord_id    BIGINT      NOT NULL UNIQUE,
    linked_at     TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_links_discord_id ON discord_links(discord_id);
