import os
import logging

import aiomysql
import discord
from aiohttp import web
from discord.ext import commands

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


class ClubPenguinBot(commands.Bot):
    def __init__(self):
        self.token = os.environ["DISCORD_BOT_TOKEN"]
        self.guild_id = int(os.environ["DISCORD_GUILD_ID"])
        self.api_port = int(os.environ.get("BOT_API_PORT", "3001"))
        self.link_code_expiry = int(os.environ.get("LINK_CODE_EXPIRY_SECONDS", "300"))

        # Database connection config for MySQL
        self.db_config = {
            "host": os.environ.get("MYSQL_HOST", "mysql"),
            "port": int(os.environ.get("MYSQL_PORT", "3306")),
            "user": os.environ.get("MYSQL_USER", "penguin"),
            "password": os.environ.get("MYSQL_PASSWORD", "changeme"),
            "db": os.environ.get("MYSQL_DATABASE", "yukon"),
        }

        self.db: aiomysql.Pool | None = None
        self.web_routes: list[web.RouteDef] = []
        self._web_runner: web.AppRunner | None = None

        # In-memory pending link codes: code -> {discord_id, created_at}
        self.pending_links: dict[str, dict] = {}

        intents = discord.Intents.default()
        intents.members = True
        intents.voice_states = True
        intents.message_content = True

        prefix = os.environ.get("DISCORD_BOT_PREFIX", "!")
        super().__init__(command_prefix=prefix, intents=intents)

    async def setup_hook(self):
        # Database pool
        self.db = await aiomysql.create_pool(
            host=self.db_config["host"],
            port=self.db_config["port"],
            user=self.db_config["user"],
            password=self.db_config["password"],
            db=self.db_config["db"],
            autocommit=True,
        )
        log.info("Database pool created")

        # Load cogs (they register web routes via self.bot.web_routes)
        from cogs.linking import LinkingCog
        from cogs.voice import VoiceCog

        await self.add_cog(LinkingCog(self))
        await self.add_cog(VoiceCog(self))

        # Start aiohttp server with routes from cogs
        app = web.Application()
        app.add_routes(self.web_routes)
        self._web_runner = web.AppRunner(app)
        await self._web_runner.setup()
        site = web.TCPSite(self._web_runner, "0.0.0.0", self.api_port)
        await site.start()
        log.info("HTTP API listening on port %d", self.api_port)

    async def close(self):
        if self._web_runner:
            await self._web_runner.cleanup()
        if self.db:
            await self.db.close()
        await super().close()

    async def on_ready(self):
        log.info("Bot ready as %s (guild %d)", self.user, self.guild_id)


bot = ClubPenguinBot()
bot.run(bot.token, log_handler=None)
