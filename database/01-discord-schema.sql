-- Discord account linking table
-- Runs on first postgres container start via docker-entrypoint-initdb.d
--
-- penguin_id logically references penguin(id) from Houdini's schema.
-- The FK constraint is not enforced here because Houdini creates its
-- tables at runtime (after these init scripts run). Referential
-- integrity is handled at the application layer.

CREATE TABLE IF NOT EXISTS discord_links (
    penguin_id    INTEGER     PRIMARY KEY,
    discord_id    BIGINT      NOT NULL UNIQUE,
    linked_at     TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_links_discord_id ON discord_links(discord_id);
