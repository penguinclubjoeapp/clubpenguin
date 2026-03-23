import { PrismaClient } from '../generated/prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { config } from '@config'

function getDatabaseUrl(): string {
    if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL
    }

    // Construct from config (which already has env var overrides applied)
    const { host, user, password, database, port } = config.database
    const dbPort = port || 3306
    return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${dbPort}/${database}`
}

const url = new URL(getDatabaseUrl())

const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1)
})

class Database extends PrismaClient {

    constructor() {
        super({ adapter })
    }

    async connect() {
        try {
            await this.$queryRaw`SELECT 1`

            console.log('Connected to database')

        } catch (error) {
            console.log(error)
        }
    }

}

export default new Database()
