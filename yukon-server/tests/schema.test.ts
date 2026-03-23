import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

describe('Prisma schema', () => {

    const schema = readFileSync('prisma/schema.prisma', 'utf-8')

    it('has User model with member field', () => {
        assert.ok(schema.includes('model User {'), 'Should have User model')
        assert.ok(
            schema.includes('member') && schema.includes('@db.TinyInt'),
            'User model should have member Int field with TinyInt'
        )
    })

    it('has DiscordLink model', () => {
        assert.ok(schema.includes('model DiscordLink {'), 'Should have DiscordLink model')
        assert.ok(schema.includes('discordId BigInt'), 'DiscordLink should have discordId BigInt')
        assert.ok(schema.includes('@@map("discord_links")'), 'DiscordLink should map to discord_links table')
    })

    it('has RoomChannelMapping model', () => {
        assert.ok(schema.includes('model RoomChannelMapping {'), 'Should have RoomChannelMapping model')
        assert.ok(schema.includes('channelId BigInt'), 'RoomChannelMapping should have channelId BigInt')
        assert.ok(schema.includes('@@map("room_channel_mappings")'), 'Should map to room_channel_mappings table')
    })

    it('DiscordLink has cascade delete from User', () => {
        assert.ok(
            schema.includes('onDelete: Cascade, map: "discord_links_ibfk_1"'),
            'DiscordLink should cascade delete from User'
        )
    })

    it('User model has discordLink relation', () => {
        assert.ok(
            schema.includes('discordLink        DiscordLink?'),
            'User should have optional discordLink relation'
        )
    })

    it('has all original models', () => {
        const models = [
            'AuthToken', 'Ban', 'Buddy', 'Card', 'Furniture',
            'FurnitureInventory', 'Igloo', 'IglooInventory', 'Ignore',
            'Inventory', 'Pet', 'Postcard', 'User', 'World'
        ]

        for (const model of models) {
            assert.ok(schema.includes(`model ${model} {`), `Should have ${model} model`)
        }
    })

})
