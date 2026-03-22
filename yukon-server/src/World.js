import Database from './database/Database'
import GameHandler from './handlers/GameHandler'
import LoginHandler from './handlers/LoginHandler'
import Server from './server/Server'

import configProd from '../config/config.json'
import configDev from '../config/config.dev.json'

const config = process.env.NODE_ENV === 'development' ? configDev : configProd

// Allow env vars to override database config (secrets stay in .env, not in tracked files)
if (process.env.MYSQL_HOST) config.database.host = process.env.MYSQL_HOST
if (process.env.MYSQL_USER) config.database.user = process.env.MYSQL_USER
if (process.env.MYSQL_PASSWORD) config.database.password = process.env.MYSQL_PASSWORD
if (process.env.MYSQL_DATABASE) config.database.database = process.env.MYSQL_DATABASE


class World extends Server {

    constructor(id) {
        console.log(`[${id}] Starting world ${id} on port ${config.worlds[id].port}`)

        let users = {}
        let db = new Database(config.database)

        let handler = (id == 'Login') ? LoginHandler : GameHandler
        handler = new handler(id, users, db, config)

        super(id, users, db, handler, config)
    }

}

let args = process.argv.slice(2)

for (let world of args) {
    if (world in config.worlds) {
        new World(world)
    }
}
