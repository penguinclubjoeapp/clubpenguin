import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('Register plugin', () => {

    it('Register.ts exists and exports a class', async () => {
        const mod = await import('../src/plugin/plugins/login/Register')
        assert.ok(mod.default, 'Register should be exported as default')
        assert.equal(typeof mod.default, 'function', 'Register should be a class/constructor')
    })

    it('Register plugin has a register method', async () => {
        const mod = await import('../src/plugin/plugins/login/Register')
        assert.equal(typeof mod.default.prototype.register, 'function')
    })

    it('Register plugin has a createValidator method', async () => {
        const mod = await import('../src/plugin/plugins/login/Register')
        assert.equal(typeof mod.default.prototype.createValidator, 'function')
    })

})

describe('Server HTTP handler', () => {

    it('Server.ts has handleRegister method', async () => {
        const { readFileSync } = await import('fs')
        const source = readFileSync('src/server/Server.ts', 'utf-8')

        assert.ok(
            source.includes('handleRegister'),
            'Server.ts should contain handleRegister method'
        )

        assert.ok(
            source.includes('/api/register'),
            'Server.ts should route to /api/register'
        )

        assert.ok(
            source.includes('1024'),
            'Server.ts should limit request body to 1KB'
        )
    })

    it('LoginHandler.ts has register method', async () => {
        const { readFileSync } = await import('fs')
        const source = readFileSync('src/handlers/LoginHandler.ts', 'utf-8')

        assert.ok(
            source.includes('async register'),
            'LoginHandler should have an async register method'
        )

        assert.ok(
            source.includes('registerPlugin'),
            'LoginHandler should reference registerPlugin'
        )
    })

})
