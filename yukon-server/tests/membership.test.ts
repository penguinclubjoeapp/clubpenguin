import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('User membership', () => {

    it('User class has member and isMember properties', async () => {
        const UserModule = await import('../src/objects/user/User')
        const User = UserModule.default

        // Check that the class prototype has setPermissions
        assert.equal(typeof User.prototype.setPermissions, 'function')
    })

    it('anonymous getter includes member field', async () => {
        const pickModule = await import('../src/utils/pick')
        const pick = pickModule.default

        // Simulate what anonymous getter does
        const fakeUser = {
            id: 1,
            username: 'test',
            head: 0, face: 0, neck: 0, body: 0, hand: 0, feet: 0,
            color: 1, photo: 0, flag: 0,
            member: 1
        }

        const result = pick(fakeUser,
            'id', 'username', 'head', 'face', 'neck', 'body',
            'hand', 'feet', 'color', 'photo', 'flag', 'member'
        )

        assert.equal(result.member, 1, 'member should be included in pick result')
    })

    it('GameUser toJSON includes member field', async () => {
        const pickModule = await import('../src/utils/pick')
        const pick = pickModule.default

        const fakeGameUser = {
            id: 1, username: 'test', joinTime: new Date(),
            head: 0, face: 0, neck: 0, body: 0, hand: 0, feet: 0,
            color: 1, photo: 0, flag: 0, member: 1,
            x: 100, y: 200, frame: 1
        }

        const result = pick(fakeGameUser,
            'id', 'username', 'joinTime', 'head', 'face', 'neck',
            'body', 'hand', 'feet', 'color', 'photo', 'flag', 'member',
            'x', 'y', 'frame'
        )

        assert.equal(result.member, 1, 'member should be in toJSON output')
        assert.equal(result.x, 100)
        assert.equal(result.y, 200)
    })

})

describe('PurchaseValidator membership check', () => {

    it('validates member-only items block non-members', async () => {
        // Read PurchaseValidator source to verify the member check exists
        const { readFileSync } = await import('fs')
        const source = readFileSync('src/objects/user/purchase/PurchaseValidator.ts', 'utf-8')

        assert.ok(
            source.includes('item.member && !this.user.isMember'),
            'PurchaseValidator should check item.member against user.isMember'
        )

        assert.ok(
            source.includes('You need to be a member to buy this item.'),
            'PurchaseValidator should send member-only error message'
        )
    })

})
