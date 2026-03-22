import logging

import aiomysql
import discord
from aiohttp import web
from discord.ext import commands

log = logging.getLogger(__name__)


class VoiceCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

        # Cache: room_id -> channel_id (loaded from DB on cog init)
        self.room_map: dict[int, int] = {}

        # Register HTTP routes
        self.bot.web_routes.append(web.post("/move", self.handle_move))

    async def cog_load(self):
        """Load room mappings from DB into cache."""
        async with self.bot.db.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT roomId, channelId FROM room_channel_mappings")
                rows = await cur.fetchall()
        self.room_map = {row["roomId"]: row["channelId"] for row in rows}
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

    # ── Admin commands ───────────────────────────────────────────────────

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
