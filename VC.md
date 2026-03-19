 That's a genuinely clever idea - spatial audio via Discord voice channels mapped to CP rooms. Let me sketch 
  out how this would actually work.                                                                           
                                                                                                              
  Architecture                                                                                                
                                                                                                              
  ┌─────────────────────────────────────────────────────────────────┐                                         
  │                        Club Penguin                              │                                        
  │  ┌─────────────┐     ┌──────────────┐     ┌──────────────────┐  │                                         
  │  │   Houdini   │────▶│ Room Change  │────▶│  Redis Pub/Sub   │  │                                         
  │  │   Server    │     │   Plugin     │     │  or WebSocket    │  │                                         
  │  └─────────────┘     └──────────────┘     └────────┬─────────┘  │                                         
  └────────────────────────────────────────────────────┼────────────┘                                         
                                                       │                                                      
                                                       ▼                                                      
  ┌────────────────────────────────────────────────────┴────────────┐                                         
  │                       Discord Bot                                │                                        
  │  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐ │                                         
  │  │ Event Listen │────▶│ User Lookup  │────▶│  Move to Voice   │ │                                         
  │  │              │     │ (CP→Discord) │     │    Channel       │ │                                         
  │  └──────────────┘     └──────────────┘     └──────────────────┘ │                                         
  └─────────────────────────────────────────────────────────────────┘                                         
                                                       │                                                      
                                                       ▼                                                      
  ┌─────────────────────────────────────────────────────────────────┐                                         
  │                      Discord Server                              │                                        
  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │                                         
  │  │   Town     │ │   Plaza    │ │Coffee Shop │ │ Pizza Parlor │  │                                         
  │  │   🔊       │ │    🔊      │ │     🔊     │ │      🔊      │  │                                         
  │  └────────────┘ └────────────┘ └────────────┘ └──────────────┘  │                                         
  └─────────────────────────────────────────────────────────────────┘                                         
                                                                                                              
  The Houdini Plugin                                                                                          
                                                                                                              
  # plugins/discord_rooms.py                                                                                  
  from houdini import IPlugin, handlers                                                                       
  from houdini.handlers import XTPacket                                                                       
  import aiohttp                                                                                              
  import asyncio                                                                                              
                                                                                                              
  class DiscordRooms(IPlugin):                                                                                
      author = "You"                                                                                          
      description = "Syncs CP rooms to Discord voice channels"                                                
      version = "1.0.0"                                                                                       
                                                                                                              
      # Map CP room IDs to Discord voice channel IDs                                                          
      ROOM_CHANNELS = {                                                                                       
          100: 1234567890123456789,  # Town                                                                   
          110: 1234567890123456790,  # Coffee Shop                                                            
          120: 1234567890123456791,  # Book Room                                                              
          200: 1234567890123456792,  # Plaza                                                                  
          220: 1234567890123456793,  # Pet Shop                                                               
          230: 1234567890123456794,  # Pizza Parlor                                                           
          300: 1234567890123456795,  # Ski Village                                                            
          # ... etc                                                                                           
      }                                                                                                       
                                                                                                              
      def __init__(self, server):                                                                             
          self.server = server                                                                                
          self.bot_url = "http://localhost:3000"  # Discord bot API                                           
                                                                                                              
      async def ready(self):                                                                                  
          self.server.logger.info("Discord Rooms plugin loaded!")                                             
                                                                                                              
      @handlers.handler(XTPacket('j', 'jr'))  # Join Room packet                                              
      async def handle_join_room(self, p, room_id: int):                                                      
          """Called when a penguin joins a room"""                                                            
          # Get their linked Discord ID from database                                                         
          discord_id = await self.get_discord_id(p.id)                                                        
                                                                                                              
          if discord_id and room_id in self.ROOM_CHANNELS:                                                    
              channel_id = self.ROOM_CHANNELS[room_id]                                                        
              await self.move_user(discord_id, channel_id)                                                    
                                                                                                              
      async def get_discord_id(self, penguin_id: int) -> int | None:                                          
          """Look up linked Discord account"""                                                                
          # Query your linking table                                                                          
          result = await self.server.db.fetchrow(                                                             
              "SELECT discord_id FROM discord_links WHERE penguin_id = $1",                                   
              penguin_id                                                                                      
          )                                                                                                   
          return result['discord_id'] if result else None                                                     
                                                                                                              
      async def move_user(self, discord_id: int, channel_id: int):                                            
          """Tell the Discord bot to move this user"""                                                        
          async with aiohttp.ClientSession() as session:                                                      
              await session.post(f"{self.bot_url}/move", json={                                               
                  "user_id": discord_id,                                                                      
                  "channel_id": channel_id                                                                    
              })                                                                                              
                                                                                                              
  The Discord Bot                                                                                             
                                                                                                              
  # discord_bot.py                                                                                            
  import discord                                                                                              
  from discord.ext import commands                                                                            
  from aiohttp import web                                                                                     
  import asyncio                                                                                              
                                                                                                              
  intents = discord.Intents.default()                                                                         
  intents.voice_states = True                                                                                 
  intents.members = True                                                                                      
                                                                                                              
  bot = commands.Bot(command_prefix="!", intents=intents)                                                     
                                                                                                              
  GUILD_ID = 9876543210987654321  # Your Discord server                                                       
                                                                                                              
  # Linking storage (use a real DB in production)                                                             
  pending_links = {}  # code -> discord_id                                                                    
  linked_accounts = {}  # discord_id -> penguin_id (load from DB)                                             
                                                                                                              
  @bot.command()                                                                                              
  async def link(ctx, code: str = None):                                                                      
      """Link your Discord to your CP account"""                                                              
      if code is None:                                                                                        
          # Generate a code they'll enter in-game                                                             
          import secrets                                                                                      
          code = secrets.token_hex(4).upper()                                                                 
          pending_links[code] = ctx.author.id                                                                 
          await ctx.send(f"Go in-game and type: `!link {code}`\nCode expires in 5 minutes.")                  
                                                                                                              
          # Expire after 5 min                                                                                
          await asyncio.sleep(300)                                                                            
          pending_links.pop(code, None)                                                                       
      else:                                                                                                   
          await ctx.send("Use this command without arguments to get a code!")                                 
                                                                                                              
  @bot.event                                                                                                  
  async def on_ready():                                                                                       
      print(f"Bot ready as {bot.user}")                                                                       
                                                                                                              
      # Start the HTTP server for Houdini to call                                                             
      app = web.Application()                                                                                 
      app.router.add_post('/move', handle_move)                                                               
      app.router.add_post('/link', handle_link)                                                               
                                                                                                              
      runner = web.AppRunner(app)                                                                             
      await runner.setup()                                                                                    
      site = web.TCPSite(runner, 'localhost', 3000)                                                           
      await site.start()                                                                                      
      print("HTTP API listening on :3000")                                                                    
                                                                                                              
  async def handle_move(request):                                                                             
      """Move a user to a voice channel"""                                                                    
      data = await request.json()                                                                             
      discord_id = data['user_id']                                                                            
      channel_id = data['channel_id']                                                                         
                                                                                                              
      guild = bot.get_guild(GUILD_ID)                                                                         
      member = guild.get_member(discord_id)                                                                   
      channel = guild.get_channel(channel_id)                                                                 
                                                                                                              
      if member and member.voice and channel:                                                                 
          try:                                                                                                
              await member.move_to(channel)                                                                   
              return web.json_response({"status": "moved"})                                                   
          except discord.Forbidden:                                                                           
              return web.json_response({"status": "no_permission"}, status=403)                               
                                                                                                              
      return web.json_response({"status": "not_in_voice"}, status=400)                                        
                                                                                                              
  async def handle_link(request):                                                                             
      """Complete account linking from in-game"""                                                             
      data = await request.json()                                                                             
      code = data['code']                                                                                     
      penguin_id = data['penguin_id']                                                                         
      penguin_name = data['penguin_name']                                                                     
                                                                                                              
      if code in pending_links:                                                                               
          discord_id = pending_links.pop(code)                                                                
          linked_accounts[discord_id] = penguin_id                                                            
                                                                                                              
          # Save to DB here                                                                                   
          # Also notify the Discord user                                                                      
          user = await bot.fetch_user(discord_id)                                                             
          await user.send(f"✅ Linked to penguin **{penguin_name}**!")                                        
                                                                                                              
          return web.json_response({"status": "linked", "discord_id": discord_id})                            
                                                                                                              
      return web.json_response({"status": "invalid_code"}, status=400)                                        
                                                                                                              
  bot.run("YOUR_BOT_TOKEN")                                                                                   
                                                                                                              
  In-Game Link Command (Houdini Plugin Addition)                                                              
                                                                                                              
  from houdini import commands, permissions                                                                   
                                                                                                              
  @commands.command('link')                                                                                   
  async def link_discord(p, code: str):                                                                       
      """Link Discord account with !link CODE"""                                                              
      async with aiohttp.ClientSession() as session:                                                          
          resp = await session.post("http://localhost:3000/link", json={                                      
              "code": code.upper(),                                                                           
              "penguin_id": p.id,                                                                             
              "penguin_name": p.username                                                                      
          })                                                                                                  
          data = await resp.json()                                                                            
                                                                                                              
          if data.get("status") == "linked":                                                                  
              # Save to DB                                                                                    
              await p.server.db.execute(                                                                      
                  """INSERT INTO discord_links (penguin_id, discord_id)                                       
                     VALUES ($1, $2) ON CONFLICT (penguin_id)                                                 
                     DO UPDATE SET discord_id = $2""",                                                        
                  p.id, data["discord_id"]                                                                    
              )                                                                                               
              await p.send_xt('cprompt', 'Discord linked successfully!')                                      
          else:                                                                                               
              await p.send_xt('cprompt', 'Invalid or expired code!')                                          
                                                                                                              
  ---                                                                                                         
  ★ Insight ─────────────────────────────────────                                                             
  Why this architecture works well:                                                                           
  1. Loose coupling - The Houdini plugin and Discord bot communicate via HTTP, so they can run on different   
  machines or be restarted independently                                                                      
  2. Discord's move_to() - Discord.py lets you programmatically move users between voice channels, but they   
  must already be in some voice channel (can't force-connect someone)                                         
  3. The linking flow - Using a one-time code that expires prevents someone from hijacking another player's   
  Discord account                                                                                             
  ─────────────────────────────────────────────────                                                           
                                                                                                              
  ---                                                                                                         
  Fun Extensions                                                                                              
                                                                                                              
  Proximity-based volume (wild idea):                                                                         
  - Track X/Y coordinates in each room                                                                        
  - Use Discord's voice channel user limits to create "sub-zones"                                             
  - Or build a custom WebRTC layer that adjusts volume based on distance                                      
                                                                                                              
  Igloo voice rooms:                                                                                          
  # When someone visits an igloo, create/join a temp voice channel                                            
  IGLOO_CATEGORY = 111222333444555666  # Discord category for igloo channels                                  
                                                                                                              
  @handlers.handler(XTPacket('j', 'jp'))  # Join Player igloo                                                 
  async def handle_join_igloo(self, p, penguin_id: int):                                                      
      discord_id = await self.get_discord_id(p.id)                                                            
      if discord_id:                                                                                          
          # Get or create voice channel for this igloo                                                        
          channel_id = await self.get_igloo_channel(penguin_id)                                               
          await self.move_user(discord_id, channel_id)                                                        
                                                                                                              
  AFK timeout:                                                                                                
  # Move to a "Lobby" channel if they go AFK in-game                                                          
  @handlers.handler(XTPacket('s', 'upc'))  # Update player coordinates                                        
  async def handle_movement(self, p, x: int, y: int):                                                         
      p.last_movement = time.time()                                                                           
                                                                                                              
  # In a background task                                                                                      
  async def check_afk():                                                                                      
      for p in server.penguins.values():                                                                      
          if time.time() - p.last_movement > 300:  # 5 min                                                    
              await move_to_afk_channel(p)                                                                    
                                                                                                              
  ---                                                                                                         
  Setup on Arch                                                                                               
                                                                                                              
  # Python deps for Houdini plugin                                                                            
  pip install aiohttp                                                                                         
                                                                                                              
  # Discord bot                                                                                               
  pip install discord.py aiohttp                                                                              
                                                                                                              
  # Redis if you want pub/sub instead of HTTP                                                                 
  sudo pacman -S redis                                                                                        
                                                                                                              
  The Discord bot needs these permissions:                                                                    
  - Move Members                                                                                              
  - Connect (to all room channels)                                                                            
  - View Channels                                                                                             
                                                                                                              
  And the bot must have a role higher than users it's moving.                                                 
                                                              
