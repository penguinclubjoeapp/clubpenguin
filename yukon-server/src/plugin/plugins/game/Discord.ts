import GamePlugin from '@plugin/GamePlugin'

import type { Args } from '../../../server/Server'
import Database from '@database/Database'
import type GameHandler from '../../../handlers/GameHandler'
import type GameUser from '@objects/user/GameUser'
import type Room from '@objects/room/Room'

export default class Discord extends GamePlugin {

    enabled: boolean
    botBaseUrl = ''
    botLinkUrl = ''
    botMoveUrl = ''
    botRoomsUrl = ''

    roomMap: Record<number, string> = {}
    cacheUpdatedAt = 0
    cacheTTL = 60 // seconds

    constructor(handler: GameHandler) {
        super(handler)

        this.events = {
            'link_discord': this.linkDiscord
        }

        const botHost = process.env.BOT_API_HOST
        const botPort = process.env.BOT_API_PORT || '3001'
        this.enabled = !!botHost

        if (this.enabled) {
            this.botBaseUrl = `http://${botHost}:${botPort}`
            this.botLinkUrl = `${this.botBaseUrl}/link`
            this.botMoveUrl = `${this.botBaseUrl}/move`
            this.botRoomsUrl = `${this.botBaseUrl}/rooms`
        } else {
            console.log('[Discord] No BOT_API_HOST set — Discord integration disabled')
        }

        if (this.enabled) this.pushRooms()
    }

    async pushRooms(retries = 5, delay = 3000) {
        const rooms = Object.values(this.rooms).map((r: Room) => ({
            id: r.id,
            name: r.name,
            game: r.game,
        }))

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await fetch(this.botRoomsUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rooms)
                })

                if (response.ok) {
                    const data = await response.json() as { status: string }
                    console.log(`[Discord] Pushed ${rooms.length} rooms to bot: ${data.status}`)
                    return
                }

                const text = await response.text()
                console.warn(`[Discord] Bot returned ${response.status} (attempt ${attempt}/${retries}): ${text.slice(0, 200)}`)
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error)
                console.warn(`[Discord] Failed to reach bot (attempt ${attempt}/${retries}): ${msg}`)
            }

            if (attempt < retries) {
                await new Promise(r => setTimeout(r, delay))
            }
        }

        console.error(`[Discord] Could not push rooms to bot after ${retries} attempts`)
    }

    async linkDiscord(args: Args, user: GameUser) {
        if (!this.enabled) {
            user.send('error', { error: 'Discord integration is not configured.' })
            return
        }

        if (!args.code || typeof args.code !== 'string') {
            user.send('error', { error: 'Usage: !link <CODE>' })
            return
        }

        const code = (args.code as string).toUpperCase().trim()

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

            const data = await response.json() as { status: string }

            if (response.ok && data.status === 'linked') {
                user.send('error', { error: 'Discord account linked successfully!' })
            } else if (data.status === 'invalid_code') {
                user.send('error', { error: 'Invalid or expired code. Run !link in Discord for a new one.' })
            } else {
                user.send('error', { error: 'Failed to link account. Please try again.' })
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[Discord] Link error:', msg)
            user.send('error', { error: 'Could not reach Discord bot. Please try later.' })
        }
    }

    async onRoomJoin(user: GameUser, room: Room) {
        if (!this.enabled) return

        await this.ensureCacheFresh()

        const channelId = this.roomMap[room.id]
        if (!channelId) return

        const discordId = await this.getDiscordId(user.id)
        if (!discordId) return

        this.moveUser(user, discordId, channelId, room.id)
    }

    async getDiscordId(userId: number): Promise<string | null> {
        try {
            const link = await Database.discordLink.findUnique({
                where: { userId },
                select: { discordId: true }
            })
            return link ? link.discordId.toString() : null
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[Discord] Error fetching discord link:', msg)
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
            const mappings = await Database.roomChannelMapping.findMany({
                select: { roomId: true, channelId: true }
            })

            this.roomMap = {}
            for (const mapping of mappings) {
                this.roomMap[mapping.roomId] = mapping.channelId.toString()
            }

            this.cacheUpdatedAt = Date.now() / 1000
            console.log(`[Discord] Loaded ${mappings.length} room-channel mappings`)
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[Discord] Error loading room mappings:', msg)
        }
    }

    async moveUser(user: GameUser, discordId: string, channelId: string, roomId: number) {
        try {
            const response = await fetch(this.botMoveUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: discordId,
                    channel_id: channelId
                })
            })

            if (response.ok) {
                console.log(`[Discord] Moved ${user.username} (room ${roomId}) to channel ${channelId}`)
            } else {
                const data = await response.json() as { status: string }
                console.log(`[Discord] Move skipped for ${user.username}: ${data.status}`)
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error(`[Discord] Failed to reach bot at ${this.botMoveUrl}:`, msg)
        }
    }

}
