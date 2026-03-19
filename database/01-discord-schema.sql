-- Discord voice integration tables
-- Runs on first postgres container start via docker-entrypoint-initdb.d
--
-- Note: discord_links.penguin_id logically references penguin(id)
-- but the FK is deferred because Houdini creates its schema at runtime.

CREATE TABLE IF NOT EXISTS discord_links (
    penguin_id    INTEGER     PRIMARY KEY,
    discord_id    BIGINT      NOT NULL UNIQUE,
    linked_at     TIMESTAMP   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_channel_mappings (
    room_id       INTEGER     PRIMARY KEY,
    channel_id    BIGINT      NOT NULL,
    created_at    TIMESTAMP   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_link_codes (
    code          VARCHAR(8)  PRIMARY KEY,
    discord_id    BIGINT      NOT NULL,
    expires_at    TIMESTAMP   NOT NULL,
    created_at    TIMESTAMP   DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_discord_links_discord_id ON discord_links(discord_id);
CREATE INDEX IF NOT EXISTS idx_pending_link_codes_expires ON pending_link_codes(expires_at);
