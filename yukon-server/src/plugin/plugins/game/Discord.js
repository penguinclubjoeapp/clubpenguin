import GamePlugin from '@plugin/GamePlugin'


export default class Discord extends GamePlugin {

    constructor(handler) {
        super(handler)

        this.events = {
            'link_discord': this.linkDiscord
        }

        // Bot API configuration
        const botHost = process.env.BOT_API_HOST || 'discord-bot'
        const botPort = process.env.BOT_API_PORT || '3001'
        this.botLinkUrl = `http://${botHost}:${botPort}/link`
        this.botMoveUrl = `http://${botHost}:${botPort}/move`

        // Room channel mapping cache
        this.roomMap = {}
        this.cacheUpdatedAt = 0
        this.cacheTTL = 60 // seconds
    }

    async linkDiscord(args, user) {
        if (!args.code || typeof args.code !== 'string') {
            user.send('error', { error: 'Usage: !link <CODE>' })
            return
        }

        const code = args.code.toUpperCase().trim()

        try {
            const response = await fetch(this.botLinkUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code,
                    penguin_id: user.id,
                    penguin_name: user.username
                })
            })

            const data = await response.json()

            if (response.ok && data.status === 'linked') {
                user.send('error', { error: 'Discord account linked successfully!' })
            } else if (data.status === 'invalid_code') {
                user.send('error', { error: 'Invalid or expired code. Run !link in Discord for a new one.' })
            } else {
                user.send('error', { error: 'Failed to link account. Please try again.' })
            }
        } catch (error) {
            console.error('[Discord] Link error:', error.message)
            user.send('error', { error: 'Could not reach Discord bot. Please try later.' })
        }
    }

    async onRoomJoin(user, room) {
        await this.ensureCacheFresh()

        const channelId = this.roomMap[room.id]
        if (!channelId) {
            return
        }

        const discordId = await this.getDiscordId(user.id)
        if (!discordId) {
            return
        }

        this.moveUser(user, discordId, channelId, room.id)
    }

    async getDiscordId(userId) {
        try {
            const link = await this.db.discordLinks.findOne({
                where: { userId: userId },
                attributes: ['discordId'],
                raw: true
            })
            return link ? link.discordId : null
        } catch (error) {
            console.error('[Discord] Error fetching discord link:', error.message)
            return null
        }
    }

    async ensureCacheFresh() {
        const now = Date.now() / 1000
        if (now - this.cacheUpdatedAt > this.cacheTTL) {
            await this.refreshRoomMap()
        }
    }

    async refreshRoomMap() {
        try {
            const mappings = await this.db.roomChannelMappings.findAll({
                attributes: ['roomId', 'channelId'],
                raw: true
            })
            this.roomMap = {}
            for (const mapping of mappings) {
                this.roomMap[mapping.roomId] = mapping.channelId
            }
            this.cacheUpdatedAt = Date.now() / 1000
            console.log(`[Discord] Loaded ${mappings.length} room-channel mappings`)
        } catch (error) {
            console.error('[Discord] Error loading room mappings:', error.message)
        }
    }

    async moveUser(user, discordId, channelId, roomId) {
        try {
            const response = await fetch(this.botMoveUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: discordId.toString(),
                    channel_id: channelId.toString()
                })
            })

            if (response.ok) {
                console.log(`[Discord] Moved ${user.username} (room ${roomId}) to channel ${channelId}`)
            } else {
                const data = await response.json()
                console.log(`[Discord] Move skipped for ${user.username}: ${data.status}`)
            }
        } catch (error) {
            console.error(`[Discord] Failed to reach bot at ${this.botMoveUrl}:`, error.message)
        }
    }

}
