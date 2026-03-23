import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('Discord plugin', () => {

    it('Discord.ts exists and exports a class', async () => {
        const mod = await import('../src/plugin/plugins/game/Discord')
        assert.ok(mod.default, 'Discord should be exported as default')
        assert.equal(typeof mod.default, 'function', 'Discord should be a class/constructor')
    })

    it('Discord plugin has required methods', async () => {
        const mod = await import('../src/plugin/plugins/game/Discord')
        const proto = mod.default.prototype

        assert.equal(typeof proto.pushRooms, 'function', 'should have pushRooms')
        assert.equal(typeof proto.linkDiscord, 'function', 'should have linkDiscord')
        assert.equal(typeof proto.onRoomJoin, 'function', 'should have onRoomJoin')
        assert.equal(typeof proto.getDiscordId, 'function', 'should have getDiscordId')
        assert.equal(typeof proto.ensureCacheFresh, 'function', 'should have ensureCacheFresh')
        assert.equal(typeof proto.refreshRoomMap, 'function', 'should have refreshRoomMap')
        assert.equal(typeof proto.moveUser, 'function', 'should have moveUser')
    })

    it('Discord plugin uses Prisma for DB queries', async () => {
        const { readFileSync } = await import('fs')
        const source = readFileSync('src/plugin/plugins/game/Discord.ts', 'utf-8')

        assert.ok(
            source.includes('Database.discordLink.findUnique'),
            'Should use Prisma discordLink.findUnique'
        )
        assert.ok(
            source.includes('Database.roomChannelMapping.findMany'),
            'Should use Prisma roomChannelMapping.findMany'
        )
        assert.ok(
            !source.includes('sequelize') && !source.includes('findOne') && !source.includes('findAll'),
            'Should not use Sequelize methods'
        )
    })

    it('Discord plugin handles missing BOT_API_HOST gracefully', async () => {
        const { readFileSync } = await import('fs')
        const source = readFileSync('src/plugin/plugins/game/Discord.ts', 'utf-8')

        assert.ok(
            source.includes('this.enabled = !!botHost'),
            'Should set enabled based on BOT_API_HOST'
        )
        assert.ok(
            source.includes('Discord integration disabled'),
            'Should log when disabled'
        )
    })

})

describe('Chat commands', () => {

    it('Chat.ts has room and link commands', async () => {
        const { readFileSync } = await import('fs')
        const source = readFileSync('src/plugin/plugins/game/Chat.ts', 'utf-8')

        assert.ok(source.includes("link: this.linkDiscord"), 'Should have link command')
        assert.ok(source.includes("room: this.showRoom"), 'Should have room command')
    })

    it('showRoom formats output correctly', async () => {
        const { readFileSync } = await import('fs')
        const source = readFileSync('src/plugin/plugins/game/Chat.ts', 'utf-8')

        assert.ok(
            source.includes('Room: ${r.name} | ID: ${r.id} | Players: ${players}/${r.maxUsers}'),
            'showRoom should format room info string'
        )
    })

})

describe('Room Discord hook', () => {

    it('Room.ts calls Discord onRoomJoin in add()', async () => {
        const { readFileSync } = await import('fs')
        const source = readFileSync('src/objects/room/Room.ts', 'utf-8')

        assert.ok(
            source.includes('discord?.onRoomJoin(user, this)'),
            'Room.add() should call discord.onRoomJoin'
        )
    })

})
