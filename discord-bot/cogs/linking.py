import asyncio
import logging
import secrets
import time

import discord
from aiohttp import web
from discord.ext import commands

log = logging.getLogger(__name__)


class LinkingCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

        # Register HTTP routes
        self.bot.web_routes.append(web.post("/link", self.handle_link))

    @commands.command(name="link")
    async def link_command(self, ctx: commands.Context, *args):
        """Generate a link code to connect your Discord account to Club Penguin."""
        if args:
            await ctx.reply("Usage: `!link` (no arguments). I'll DM you a code to use in-game.")
            return

        code = secrets.token_hex(4).upper()
        self.bot.pending_links[code] = {
            "discord_id": ctx.author.id,
            "created_at": time.time(),
        }

        try:
            await ctx.author.send(
                f"Your link code is: **{code}**\n"
                f"Type `!link {code}` in-game within "
                f"{self.bot.link_code_expiry // 60} minutes to link your account."
            )
            await ctx.reply("Check your DMs for your link code!")
        except discord.Forbidden:
            # Can't DM user — send code in channel instead
            await ctx.reply(
                f"I can't DM you! Your link code is: **{code}**\n"
                f"Type `!link {code}` in-game within "
                f"{self.bot.link_code_expiry // 60} minutes."
            )

        # Schedule expiry
        asyncio.create_task(self._expire_code(code))

    async def _expire_code(self, code: str):
        await asyncio.sleep(self.bot.link_code_expiry)
        self.bot.pending_links.pop(code, None)

    async def handle_link(self, request: web.Request) -> web.Response:
        """POST /link — called by Houdini plugin to complete account linking."""
        data = await request.json()
        code = data.get("code", "")
        penguin_id = data.get("penguin_id")
        penguin_name = data.get("penguin_name", "Unknown")

        if not code or penguin_id is None:
            return web.json_response({"status": "bad_request"}, status=400)

        entry = self.bot.pending_links.pop(code, None)
        if entry is None:
            return web.json_response({"status": "invalid_code"}, status=400)

        # Check TTL
        if time.time() - entry["created_at"] > self.bot.link_code_expiry:
            return web.json_response({"status": "invalid_code"}, status=400)

        discord_id = entry["discord_id"]

        # Upsert into discord_links
        await self.bot.db.execute(
            """
            INSERT INTO discord_links (penguin_id, discord_id, linked_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (penguin_id)
            DO UPDATE SET discord_id = $2, linked_at = NOW()
            """,
            penguin_id,
            discord_id,
        )

        log.info("Linked penguin %d (%s) to Discord user %d", penguin_id, penguin_name, discord_id)

        # DM the Discord user a confirmation
        guild = self.bot.get_guild(self.bot.guild_id)
        if guild:
            member = guild.get_member(discord_id)
            if member:
                try:
                    await member.send(
                        f"Your Discord account is now linked to **{penguin_name}**!"
                    )
                except discord.Forbidden:
                    pass

        return web.json_response({"status": "linked", "discord_id": discord_id})
