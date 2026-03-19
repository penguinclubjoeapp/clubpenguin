import os

import aiohttp

from houdini import IPlugin, commands


class DiscordLink(IPlugin):
    """Links Club Penguin accounts to Discord via one-time codes."""

    author = "Borges-Fable"
    description = "Discord account linking via !link command"
    version = "1.0.0"

    def __init__(self, server):
        super().__init__(server)

        bot_host = os.environ.get("BOT_API_HOST", "discord-bot")
        bot_port = os.environ.get("BOT_API_PORT", "3001")
        self.bot_link_url = f"http://{bot_host}:{bot_port}/link"
        self.session = None

    async def ready(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=5)
        )
        self.server.logger.info("DiscordLink plugin ready")

    @commands.command("link")
    async def link_discord(self, p, code: str):
        """Link a Discord account: !link CODE"""
        try:
            async with self.session.post(
                self.bot_link_url,
                json={
                    "code": code.upper(),
                    "penguin_id": p.id,
                    "penguin_name": p.username,
                },
            ) as resp:
                data = await resp.json()

                if resp.status == 200 and data.get("status") == "linked":
                    await p.send_xt("sm", p.id, "Discord linked successfully!")
                    self.server.logger.info(
                        "Linked %s (id=%d) to Discord %d",
                        p.username,
                        p.id,
                        data["discord_id"],
                    )
                else:
                    await p.send_xt("sm", p.id, "Invalid or expired code.")

        except aiohttp.ClientError:
            self.server.logger.error(
                "Failed to reach Discord bot at %s", self.bot_link_url
            )
            await p.send_xt("sm", p.id, "Link service unavailable. Try again later.")
        except Exception:
            self.server.logger.exception("Unexpected error in link command")
            await p.send_xt("sm", p.id, "Something went wrong. Try again later.")
