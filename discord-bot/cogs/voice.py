import logging

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
        rows = await self.bot.db.fetch("SELECT room_id, channel_id FROM room_channel_mappings")
        self.room_map = {row["room_id"]: row["channel_id"] for row in rows}
        log.info("Loaded %d room-channel mappings", len(self.room_map))

    # ── HTTP endpoint ────────────────────────────────────────────────────

    async def handle_move(self, request: web.Request) -> web.Response:
        """POST /move — move a Discord member to a voice channel."""
        data = await request.json()
        user_id = data.get("user_id")
        channel_id = data.get("channel_id")

        if not user_id or not channel_id:
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
        await self.bot.db.execute(
            """
            INSERT INTO room_channel_mappings (room_id, channel_id)
            VALUES ($1, $2)
            ON CONFLICT (room_id)
            DO UPDATE SET channel_id = $2, mapped_at = NOW()
            """,
            room_id,
            channel.id,
        )
        self.room_map[room_id] = channel.id
        await ctx.message.add_reaction("\u2705")
        log.info("Mapped room %d -> channel %s (%d)", room_id, channel.name, channel.id)

    @commands.command(name="unmapchannel")
    @commands.has_guild_permissions(manage_guild=True)
    async def unmap_channel(self, ctx: commands.Context, room_id: int):
        """Remove a room-to-channel mapping."""
        await self.bot.db.execute(
            "DELETE FROM room_channel_mappings WHERE room_id = $1", room_id
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
