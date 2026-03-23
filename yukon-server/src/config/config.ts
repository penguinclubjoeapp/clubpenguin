import { loadJson } from '@utils/loadJson'
import { existsSync } from 'fs'

import type { Assert } from 'ts-runtime-checks'

export interface Config {
    crypto: {
        secret: string
        rounds: number
        loginKeyExpiry: number
    }
    database: {
        host: string
        user: string
        password: string
        database: string
        port?: number
        debug: boolean
        logQueryParameters: boolean
    }
    socketio: {
        https: boolean
        ssl: {
            cert: string
            ca: string
            key: string
        }
    }
    cors: {
        origin: string
    }
    rateLimit: {
        enabled: boolean
        addressConnectsPerSecond: number
        addressEventsPerSecond: number
        userEventsPerSecond: number
        ipAddressHeader: false | string
    }
    worlds: Record<string, {
        host: string
        port: number
        maxUsers?: number
    }>
    cooldowns: Record<string, number>
    game: {
        preferredSpawn: number
        iglooIdOffset: number
    }
}

function loadConfig(): Config {
    const isDev = process.env.NODE_ENV === 'development'
    let configPath: string

    if (isDev && existsSync('config/config.dev.json')) {
        configPath = 'config/config.dev'
    } else if (existsSync('config/config.json')) {
        configPath = 'config/config'
    } else {
        configPath = 'config/config_example'
    }

    const loaded = loadJson(configPath) as Assert<Config>

    // Allow env vars to override database config
    if (process.env.MYSQL_HOST) loaded.database.host = process.env.MYSQL_HOST
    if (process.env.MYSQL_USER) loaded.database.user = process.env.MYSQL_USER
    if (process.env.MYSQL_PASSWORD) loaded.database.password = process.env.MYSQL_PASSWORD
    if (process.env.MYSQL_DATABASE) loaded.database.database = process.env.MYSQL_DATABASE

    // Allow env vars to override ports
    if (process.env.DEV_MYSQL_PORT) loaded.database.port = parseInt(process.env.DEV_MYSQL_PORT)
    if (process.env.DEV_LOGIN_PORT) loaded.worlds.Login.port = parseInt(process.env.DEV_LOGIN_PORT)
    if (process.env.DEV_WORLD_PORT) loaded.worlds.Blizzard.port = parseInt(process.env.DEV_WORLD_PORT)

    return loaded
}

export const config = loadConfig()
