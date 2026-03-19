import asyncio
import os
import time

import aiohttp

from houdini import IPlugin, handlers
from houdini.handlers import XTPacket


class DiscordRooms(IPlugin):
    """Syncs Club Penguin rooms to Discord voice channels."""

    author = "Borges-Fable"
    description = "Moves linked players between Discord voice channels on room change"
    version = "1.0.0"

    CACHE_TTL = 60  # seconds between room_channel_mappings refreshes

    def __init__(self, server):
        super().__init__(server)

        bot_host = os.environ.get("BOT_API_HOST", "discord-bot")
        bot_port = os.environ.get("BOT_API_PORT", "3001")
        self.bot_move_url = f"http://{bot_host}:{bot_port}/move"
        self.session = None

        self.room_map: dict[int, int] = {}
        self._cache_updated_at: float = 0

    async def ready(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=5)
        )
        await self._refresh_room_map()
        self.server.logger.info(
            "DiscordRooms plugin ready (%d mappings loaded)", len(self.room_map)
        )

    async def _refresh_room_map(self):
        """Reload room-to-channel mappings from the database."""
        rows = await self.server.db.fetch(
            "SELECT room_id, channel_id FROM room_channel_mappings"
        )
        self.room_map = {row["room_id"]: row["channel_id"] for row in rows}
        self._cache_updated_at = time.monotonic()

    async def _ensure_cache_fresh(self):
        """Refresh the mapping cache if it's older than CACHE_TTL."""
        if time.monotonic() - self._cache_updated_at > self.CACHE_TTL:
            await self._refresh_room_map()

    @handlers.handler(XTPacket('j', 'jr'))
    async def handle_join_room(self, p, room_id: int):
        """Called when a penguin joins a room — move them in Discord."""
        await self._ensure_cache_fresh()

        channel_id = self.room_map.get(room_id)
        if channel_id is None:
            return

        discord_id = await self._get_discord_id(p.id)
        if discord_id is None:
            return

        asyncio.create_task(self._move_user(p, discord_id, channel_id, room_id))

    async def _get_discord_id(self, penguin_id: int) -> int | None:
        """Look up linked Discord account for a penguin."""
        result = await self.server.db.fetchrow(
            "SELECT discord_id FROM discord_links WHERE penguin_id = $1",
            penguin_id,
        )
        return result["discord_id"] if result else None

    async def _move_user(self, p, discord_id: int, channel_id: int, room_id: int):
        """POST to the Discord bot's /move endpoint (fire-and-forget)."""
        try:
            async with self.session.post(
                self.bot_move_url,
                json={"user_id": discord_id, "channel_id": channel_id},
            ) as resp:
                if resp.status == 200:
                    self.server.logger.debug(
                        "Moved %s (room %d) to channel %d",
                        p.username, room_id, channel_id,
                    )
                else:
                    data = await resp.json()
                    self.server.logger.debug(
                        "Move skipped for %s: %s", p.username, data.get("status")
                    )
        except aiohttp.ClientError:
            self.server.logger.warning(
                "Failed to reach Discord bot at %s", self.bot_move_url
            )
        except Exception:
            self.server.logger.exception("Unexpected error moving %s", p.username)
