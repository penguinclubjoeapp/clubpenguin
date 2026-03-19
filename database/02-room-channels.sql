-- Room-to-Discord-channel mapping table
-- Maps Club Penguin room IDs to Discord voice channel snowflakes.
-- Managed at runtime via bot commands (!mapchannel, !unmapchannel).

CREATE TABLE IF NOT EXISTS room_channel_mappings (
    room_id       INTEGER   PRIMARY KEY,
    channel_id    BIGINT    NOT NULL,
    mapped_at     TIMESTAMP DEFAULT NOW()
);
