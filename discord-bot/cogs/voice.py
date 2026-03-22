import logging

import aiomysql
import discord
from aiohttp import web
from discord.ext import commands

log = logging.getLogger(__name__)

CATEGORY_ROOMS = "Club Penguin"
CATEGORY_GAMES = "Club Penguin Games"

# Friendly display names for rooms whose JSON name isn't self-explanatory
DISPLAY_NAMES = {
    "mtn": "Mountain",
    "dojoext": "Dojo Courtyard",
    "sport": "Sports Shop",
    "pet": "Pet Shop",
    "agent": "HQ",
    "berg": "Iceberg",
    "astro": "Astro Barrier",
    "beans": "Bean Counters",
    "roundup": "Puffle Roundup",
    "hydro": "Hydro Hopper",
    "fish": "Ice Fishing",
    "thinice": "Thin Ice",
    "waves": "Catchin Waves",
    "sub": "Aqua Grabber",
    "sensei": "Card-Jitsu Sensei",
    "card": "Card-Jitsu",
    "sled": "Sled Racing",
    "mission1": "Mission 1",
    "mission2": "Mission 2",
    "mission3": "Mission 3",
    "mission4": "Mission 4",
    "mission5": "Mission 5",
    "mission6": "Mission 6",
    "mission7": "Mission 7",
    "mission8": "Mission 8",
    "mission9": "Mission 9",
    "mission10": "Mission 10",
    "mission11": "Mission 11",
}


class VoiceCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

        # Cache: room_id -> channel_id
        self.room_map: dict[int, int] = {}
        self._synced = False

        # Register HTTP routes
        self.bot.web_routes.append(web.post("/move", self.handle_move))
        self.bot.web_routes.append(web.post("/rooms", self.handle_rooms))

    async def cog_load(self):
        """Load existing mappings from DB as initial cache."""
        await self._load_mappings_from_db()

    # ── HTTP endpoint: room sync ───────────────────────────────────────

    async def handle_rooms(self, request: web.Request) -> web.Response:
        """POST /rooms — accept room list from Yukon and sync voice channels."""
        try:
            rooms = await request.json()
        except Exception:
            return web.json_response({"status": "bad_request"}, status=400)

        if not isinstance(rooms, list) or not rooms:
            return web.json_response({"status": "bad_request", "error": "expected non-empty array"}, status=400)

        guild = self.bot.get_guild(self.bot.guild_id)
        if not guild:
            return web.json_response({"status": "guild_not_found"}, status=500)

        log.info("Received %d rooms from Yukon — starting voice channel sync", len(rooms))
        try:
            await self._sync_channels(guild, rooms)
        except discord.Forbidden as e:
            log.error("Missing permissions: %s", e)
            return web.json_response({"status": "missing_permissions", "error": str(e)}, status=403)
        return web.json_response({"status": "synced", "rooms": len(self.room_map)})

    @staticmethod
    def _room_display_name(room: dict) -> str:
        name = room["name"]
        return DISPLAY_NAMES.get(name, name.title())

    # ── Channel sync ─────────────────────────────────────────────────────

    async def _sync_channels(self, guild: discord.Guild, rooms: list[dict]):
        regular = [r for r in rooms if not r.get("game")]
        games = [r for r in rooms if r.get("game")]

        rooms_cat = await self._get_or_create_category(guild, CATEGORY_ROOMS)
        games_cat = await self._get_or_create_category(guild, CATEGORY_GAMES)

        existing = await self._get_all_mappings()
        managed_ids = set()

        for room in regular:
            cid = await self._sync_room(guild, room, rooms_cat, existing)
            if cid:
                managed_ids.add(cid)

        for room in games:
            cid = await self._sync_room(guild, room, games_cat, existing)
            if cid:
                managed_ids.add(cid)

        await self._cleanup_orphaned(rooms_cat, managed_ids)
        await self._cleanup_orphaned(games_cat, managed_ids)

        await self._load_mappings_from_db()
        log.info("Voice channel sync complete: %d mappings", len(self.room_map))

    async def _get_or_create_category(self, guild: discord.Guild, name: str):
        for cat in guild.categories:
            if cat.name == name:
                return cat
        log.info("Creating category '%s'", name)
        return await guild.create_category(name)

    async def _sync_room(self, guild, room, category, existing):
        room_id = room["id"]
        display_name = self._room_display_name(room)

        # If mapping exists and channel is still alive, keep it
        if room_id in existing:
            channel = guild.get_channel(existing[room_id])
            if channel:
                return channel.id

        # Create new voice channel
        channel = await guild.create_voice_channel(display_name, category=category)

        # Upsert mapping
        async with self.bot.db.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """INSERT INTO room_channel_mappings (roomId, channelId, mappedAt)
                    VALUES (%s, %s, NOW())
                    ON DUPLICATE KEY UPDATE channelId = %s, mappedAt = NOW()""",
                    (room_id, channel.id, channel.id),
                )

        log.info("Created voice channel '%s' for room %d", display_name, room_id)
        return channel.id

    async def _cleanup_orphaned(self, category, managed_ids: set[int]):
        """Delete voice channels in managed categories that no longer map to a room."""
        for channel in category.voice_channels:
            if channel.id not in managed_ids:
                log.info("Deleting orphaned voice channel '#%s'", channel.name)
                await channel.delete(reason="Room no longer exists")

    async def _get_all_mappings(self) -> dict[int, int]:
        async with self.bot.db.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT roomId, channelId FROM room_channel_mappings")
                rows = await cur.fetchall()
        return {row["roomId"]: row["channelId"] for row in rows}

    async def _load_mappings_from_db(self):
        self.room_map = await self._get_all_mappings()
        log.info("Loaded %d room-channel mappings", len(self.room_map))

    # ── HTTP endpoint ────────────────────────────────────────────────────

    async def handle_move(self, request: web.Request) -> web.Response:
        """POST /move — move a Discord member to a voice channel."""
        data = await request.json()

        try:
            user_id = int(data["user_id"])
            channel_id = int(data["channel_id"])
        except (KeyError, TypeError, ValueError):
            return web.json_response({"status": "bad_request"}, status=400)

        guild = self.bot.get_guild(self.bot.guild_id)
        if not guild:
            return web.json_response({"status": "guild_not_found"}, status=500)

        # Resolve member (cache then API)
        member = guild.get_member(user_id)
        if not member:
            try:
                member = await guild.fetch_member(user_id)
            except discord.NotFound:
                return web.json_response({"status": "member_not_found"}, status=404)

        # Check member is in a voice channel
        if not member.voice or not member.voice.channel:
            return web.json_response({"status": "not_in_voice"}, status=400)

        # Resolve target channel
        channel = guild.get_channel(channel_id)
        if not channel:
            return web.json_response({"status": "channel_not_found"}, status=404)

        try:
            await member.move_to(channel)
        except discord.Forbidden:
            return web.json_response({"status": "no_permission"}, status=403)

        log.info("Moved %s to #%s", member, channel.name)
        return web.json_response({"status": "moved"})

    # ── Admin commands (manual overrides) ────────────────────────────────

    @commands.command(name="mapchannel")
    @commands.has_guild_permissions(manage_guild=True)
    async def map_channel(self, ctx: commands.Context, room_id: int, channel: discord.VoiceChannel):
        """Map a Club Penguin room ID to a Discord voice channel."""
        async with self.bot.db.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO room_channel_mappings (roomId, channelId, mappedAt)
                    VALUES (%s, %s, NOW())
                    ON DUPLICATE KEY UPDATE channelId = %s, mappedAt = NOW()
                    """,
                    (room_id, channel.id, channel.id),
                )
        self.room_map[room_id] = channel.id
        await ctx.message.add_reaction("\u2705")
        log.info("Mapped room %d -> channel %s (%d)", room_id, channel.name, channel.id)

    @commands.command(name="unmapchannel")
    @commands.has_guild_permissions(manage_guild=True)
    async def unmap_channel(self, ctx: commands.Context, room_id: int):
        """Remove a room-to-channel mapping."""
        async with self.bot.db.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM room_channel_mappings WHERE roomId = %s", (room_id,)
                )
        self.room_map.pop(room_id, None)
        await ctx.message.add_reaction("\u2705")
        log.info("Unmapped room %d", room_id)

    @commands.command(name="listchannels")
    @commands.has_guild_permissions(manage_guild=True)
    async def list_channels(self, ctx: commands.Context):
        """List all room-to-channel mappings."""
        if not self.room_map:
            await ctx.reply("No room mappings configured.")
            return

        lines = []
        guild = ctx.guild
        for room_id, channel_id in sorted(self.room_map.items()):
            ch = guild.get_channel(channel_id) if guild else None
            name = f"#{ch.name}" if ch else f"(unknown: {channel_id})"
            lines.append(f"Room {room_id} \u2192 {name}")

        await ctx.reply("\n".join(lines))
