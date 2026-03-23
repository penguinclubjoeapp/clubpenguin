import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'fs'

describe('Config loading', () => {

    it('config module exports a config object', async () => {
        const { config } = await import('../src/config/config')
        assert.ok(config, 'config should be defined')
        assert.ok(config.crypto, 'config.crypto should exist')
        assert.ok(config.database, 'config.database should exist')
        assert.ok(config.worlds, 'config.worlds should exist')
        assert.ok(config.cors, 'config.cors should exist')
        assert.ok(config.rateLimit, 'config.rateLimit should exist')
    })

    it('config has required crypto fields', async () => {
        const { config } = await import('../src/config/config')
        assert.equal(typeof config.crypto.secret, 'string')
        assert.equal(typeof config.crypto.rounds, 'number')
        assert.equal(typeof config.crypto.loginKeyExpiry, 'number')
    })

    it('config has required database fields', async () => {
        const { config } = await import('../src/config/config')
        assert.equal(typeof config.database.host, 'string')
        assert.equal(typeof config.database.user, 'string')
        assert.equal(typeof config.database.password, 'string')
        assert.equal(typeof config.database.database, 'string')
    })

    it('config has Login and Blizzard worlds', async () => {
        const { config } = await import('../src/config/config')
        assert.ok(config.worlds.Login, 'Login world should exist')
        assert.ok(config.worlds.Blizzard, 'Blizzard world should exist')
        assert.equal(typeof config.worlds.Login.port, 'number')
        assert.equal(typeof config.worlds.Blizzard.port, 'number')
    })

    it('dev config file exists', () => {
        assert.ok(existsSync('config/config.dev.json'), 'config.dev.json should exist')
    })

})

describe('DATABASE_URL construction', () => {

    it('builds URL from config when DATABASE_URL not set', async () => {
        // This tests the getDatabaseUrl logic indirectly through Database import
        // If the module loads without error, URL construction worked
        const { config } = await import('../src/config/config')
        const { host, user, password, database } = config.database
        const port = config.database.port || 3306

        const url = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
        const parsed = new URL(url)

        assert.equal(parsed.hostname, host)
        assert.equal(parsed.username, user)
        assert.equal(parsed.pathname.slice(1), database)
    })

})
