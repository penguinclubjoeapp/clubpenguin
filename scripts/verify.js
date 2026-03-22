#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const mysql = require(path.join(__dirname, 'node_modules', 'mysql2', 'promise'))

// Load .env from project root
const envPath = path.join(__dirname, '..', '.env')
const env = {}
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.+?)\s*$/)
    if (match) env[match[1]] = match[2]
}

const DB_CONFIG = {
    host: env.MYSQL_HOST === 'mysql' ? '127.0.0.1' : (env.MYSQL_HOST || '127.0.0.1'),
    port: parseInt(env.MYSQL_PORT || '3306'),
    user: env.MYSQL_USER || 'penguin',
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE || 'yukon'
}

async function getConnection() {
    return mysql.createConnection(DB_CONFIG)
}

async function list(conn) {
    const [rows] = await conn.execute(`
        SELECT u.id, u.username, u.member, u.joinTime, u.\`rank\`,
               dl.discordId
        FROM users u
        LEFT JOIN discord_links dl ON dl.userId = u.id
        ORDER BY u.id
    `)

    if (rows.length === 0) {
        console.log('No accounts found.')
        return
    }

    console.log('')
    console.log('  ID  | Username     | Member | Discord          | Joined')
    console.log('  ----+--------------+--------+------------------+--------------------')

    for (const row of rows) {
        const id = String(row.id).padStart(3)
        const name = row.username.padEnd(12)
        const member = row.member ? ' yes  ' : ' no   '
        const discord = row.discordId ? String(row.discordId).padEnd(16) : 'not linked      '
        const joined = new Date(row.joinTime).toISOString().slice(0, 16).replace('T', ' ')
        console.log(`  ${id} | ${name} | ${member} | ${discord} | ${joined}`)
    }
    console.log('')
}

async function info(conn, username) {
    const [rows] = await conn.execute(`
        SELECT u.id, u.username, u.email, u.member, u.\`rank\`, u.permaBan,
               u.joinTime, u.coins,
               dl.discordId, dl.linkedAt
        FROM users u
        LEFT JOIN discord_links dl ON dl.userId = u.id
        WHERE u.username = ?
    `, [username])

    if (rows.length === 0) {
        console.log(`Player "${username}" not found.`)
        return
    }

    const r = rows[0]
    console.log('')
    console.log(`  Player: ${r.username} (ID ${r.id})`)
    console.log(`  Member: ${r.member ? 'yes' : 'no'}`)
    console.log(`  Rank:   ${r.rank} ${r.rank >= 2 ? '(moderator)' : '(regular)'}`)
    console.log(`  Coins:  ${r.coins}`)
    console.log(`  Joined: ${new Date(r.joinTime).toISOString().slice(0, 16).replace('T', ' ')}`)
    console.log(`  Email:  ${r.email || '(none)'}`)
    console.log(`  Banned: ${r.permaBan ? 'yes' : 'no'}`)
    console.log(`  Discord:${r.discordId ? ` ${r.discordId} (linked ${new Date(r.linkedAt).toISOString().slice(0, 10)})` : ' not linked'}`)
    console.log('')
}

async function grant(conn, username) {
    const [result] = await conn.execute(
        'UPDATE users SET member = 1 WHERE username = ? AND member = 0',
        [username]
    )

    if (result.affectedRows === 0) {
        const [check] = await conn.execute('SELECT id, member FROM users WHERE username = ?', [username])
        if (check.length === 0) {
            console.log(`Player "${username}" not found.`)
        } else {
            console.log(`${username} is already a member.`)
        }
    } else {
        console.log(`${username} is now a member.`)
    }
}

async function revoke(conn, username) {
    const [result] = await conn.execute(
        'UPDATE users SET member = 0 WHERE username = ? AND member = 1',
        [username]
    )

    if (result.affectedRows === 0) {
        const [check] = await conn.execute('SELECT id, member FROM users WHERE username = ?', [username])
        if (check.length === 0) {
            console.log(`Player "${username}" not found.`)
        } else {
            console.log(`${username} is already a non-member.`)
        }
    } else {
        console.log(`${username} membership revoked.`)
    }
}

async function main() {
    const [command, ...args] = process.argv.slice(2)

    if (!command || command === 'help') {
        console.log(`
  Usage: node scripts/verify.js <command> [args]

  Commands:
    list              Show all accounts with member/discord status
    info  <username>  Show detailed info for a player
    grant <username>  Grant membership to a player
    revoke <username> Revoke membership from a player
`)
        return
    }

    const conn = await getConnection()

    try {
        switch (command) {
            case 'list':
                await list(conn)
                break
            case 'info':
                if (!args[0]) { console.log('Usage: verify.js info <username>'); break }
                await info(conn, args[0])
                break
            case 'grant':
                if (!args[0]) { console.log('Usage: verify.js grant <username>'); break }
                await grant(conn, args[0])
                break
            case 'revoke':
                if (!args[0]) { console.log('Usage: verify.js revoke <username>'); break }
                await revoke(conn, args[0])
                break
            default:
                console.log(`Unknown command: ${command}. Run with "help" for usage.`)
        }
    } finally {
        await conn.end()
    }
}

main().catch(err => {
    console.error(err.message)
    process.exit(1)
})
