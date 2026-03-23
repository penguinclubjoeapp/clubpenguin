const fs = require('fs')
const path = require('path')
const { glob } = require('node:fs')

const ROOT = path.resolve(__dirname, '..', '..', '..')
const ROOMS_DIR = path.join(ROOT, 'yukon', 'src', 'scenes', 'rooms')
const CLIENT_ROOMS_JSON = path.join(ROOT, 'yukon', 'assets', 'media', 'crumbs', 'en', 'rooms.json')
const SERVER_ROOMS_JSON = path.join(ROOT, 'yukon-server', 'data', 'rooms.json')

// Regex patterns for trigger types
const TRIGGER_ROOM = /this\.triggerRoom\((\d+),\s*(\d+),\s*(\d+)\)/
const TRIGGER_GAME = /this\.triggerGame\((\d+)\)/
const TRIGGER_TABLE = /this\.triggerTable\(['"](\w+)['"],\s*(\d+)/
const TRIGGER_WADDLE = /this\.triggerWaddle\((\d+)\)/
const TRIGGER_MAT = /this\.triggerMat\((\d+)\)/
const TRIGGER_AGENT = /this\.triggerAgent\(\)/
const TRIGGER_WIDGET = /this\.interface\.loadWidget\(['"](\w+)['"]\)/

function parseTriggerValue(value) {
    value = value.trim()

    if (value === 'null') {
        return { type: 'unimplemented' }
    }

    let m
    if ((m = TRIGGER_ROOM.exec(value))) {
        return { type: 'room', roomId: parseInt(m[1]), spawnX: parseInt(m[2]), spawnY: parseInt(m[3]) }
    }
    if ((m = TRIGGER_GAME.exec(value))) {
        return { type: 'game', gameId: parseInt(m[1]) }
    }
    if ((m = TRIGGER_TABLE.exec(value))) {
        return { type: 'table', gameName: m[1], tableId: parseInt(m[2]) }
    }
    if ((m = TRIGGER_WADDLE.exec(value))) {
        return { type: 'waddle', waddleId: parseInt(m[1]) }
    }
    if ((m = TRIGGER_MAT.exec(value))) {
        return { type: 'mat', waddleId: parseInt(m[1]) }
    }
    if ((m = TRIGGER_AGENT.exec(value))) {
        return { type: 'conditional_room', roomId: 803, condition: 'isSecretAgent' }
    }
    if ((m = TRIGGER_WIDGET.exec(value))) {
        return { type: 'widget', widgetName: m[1] }
    }

    return { type: 'unknown', raw: value }
}

function extractTriggersFromSource(source) {
    // Extract roomTriggers block
    const blockMatch = source.match(/this\.roomTriggers\s*=\s*\{([\s\S]*?)\n\s*\}/)
    if (!blockMatch) return []

    const block = blockMatch[1]
    const triggers = []

    // Process line by line to avoid commas inside function args breaking the match
    const lines = block.split('\n')
    for (const line of lines) {
        const m = line.match(/['"]?(\w+)['"]?\s*:\s*(.+?)\s*,?\s*$/)
        if (!m) continue
        const key = m[1]
        const value = m[2].trim()
        const parsed = parseTriggerValue(value)
        triggers.push({ key, ...parsed })
    }

    return triggers
}

function extractSceneKey(source) {
    const m = source.match(/super\(["'](\w+)["']\)/)
    return m ? m[1] : null
}

function buildRoomKeyToId(clientRoomsJson) {
    const map = {}
    for (const [id, room] of Object.entries(clientRoomsJson)) {
        map[room.key] = parseInt(id)
    }
    return map
}

function buildRoomIdToName(serverRoomsJson) {
    const map = {}
    for (const room of serverRoomsJson) {
        map[room.id] = room.name
    }
    return map
}

function extract() {
    const clientRooms = JSON.parse(fs.readFileSync(CLIENT_ROOMS_JSON, 'utf8'))
    const serverRooms = JSON.parse(fs.readFileSync(SERVER_ROOMS_JSON, 'utf8'))

    const keyToId = buildRoomKeyToId(clientRooms)
    const idToName = buildRoomIdToName(serverRooms)

    const roomDirs = fs.readdirSync(ROOMS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())

    const result = {}

    for (const dir of roomDirs) {
        const dirPath = path.join(ROOMS_DIR, dir.name)
        const files = fs.readdirSync(dirPath)
            .filter(f => /^[A-Z].*\.js$/.test(f) && f !== 'RoomScene.js')

        for (const file of files) {
            const filePath = path.join(dirPath, file)
            const source = fs.readFileSync(filePath, 'utf8')

            const sceneKey = extractSceneKey(source)
            if (!sceneKey) continue

            const roomId = keyToId[sceneKey]
            if (roomId === undefined) continue

            const triggers = extractTriggersFromSource(source)

            // Resolve room names for room-type triggers
            for (const trigger of triggers) {
                if (trigger.type === 'room' || trigger.type === 'conditional_room') {
                    trigger.roomName = idToName[trigger.roomId] || null
                }
                if (trigger.type === 'game') {
                    trigger.gameName = idToName[trigger.gameId] || null
                }
            }

            result[roomId] = {
                name: idToName[roomId] || sceneKey.toLowerCase(),
                triggers
            }
        }
    }

    return result
}

module.exports = { extract }

// Allow running standalone to generate JSON
if (require.main === module) {
    const data = extract()
    const outPath = path.join(ROOT, 'yukon-server', 'data', 'interactables.json')
    fs.writeFileSync(outPath, JSON.stringify(data, null, 4) + '\n')
    console.log(`Wrote ${Object.keys(data).length} rooms to ${outPath}`)
}
