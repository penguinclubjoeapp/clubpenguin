const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { z } = require('zod')
const { extract } = require('./lib/extract')

const roomData = extract()

const server = new McpServer({
    name: 'club-penguin-rooms',
    version: '1.0.0',
})

server.tool(
    'get_room',
    'Get all interactables and exits for a specific room by ID or name',
    { room: z.string().describe('Room ID (e.g. "100") or room name (e.g. "town")') },
    async ({ room }) => {
        // Try as ID first, then search by name
        let data = roomData[room]
        if (!data) {
            const entry = Object.entries(roomData).find(([, v]) => v.name === room.toLowerCase())
            if (entry) {
                room = entry[0]
                data = entry[1]
            }
        }

        if (!data) {
            return { content: [{ type: 'text', text: `Room "${room}" not found. Use list_rooms to see all available rooms.` }] }
        }

        const exits = data.triggers.filter(t => t.type === 'room' || t.type === 'conditional_room')
        const games = data.triggers.filter(t => t.type === 'game')
        const tables = data.triggers.filter(t => t.type === 'table')
        const waddles = data.triggers.filter(t => t.type === 'waddle' || t.type === 'mat')
        const widgets = data.triggers.filter(t => t.type === 'widget')
        const unimplemented = data.triggers.filter(t => t.type === 'unimplemented')

        const lines = [`Room: ${data.name} (ID: ${room})`]

        if (exits.length) {
            lines.push('\nExits:')
            for (const e of exits) {
                const cond = e.condition ? ` [requires: ${e.condition}]` : ''
                lines.push(`  ${e.key} -> ${e.roomName} (${e.roomId}) spawn(${e.spawnX}, ${e.spawnY})${cond}`)
            }
        }

        if (games.length) {
            lines.push('\nGames:')
            for (const g of games) {
                lines.push(`  ${g.key} -> ${g.gameName || 'unknown'} (${g.gameId})`)
            }
        }

        if (tables.length) {
            lines.push('\nTables:')
            for (const t of tables) {
                lines.push(`  ${t.key} -> ${t.gameName} table #${t.tableId}`)
            }
        }

        if (waddles.length) {
            lines.push('\nWaddles:')
            for (const w of waddles) {
                lines.push(`  ${w.key} -> waddle #${w.waddleId} (${w.type})`)
            }
        }

        if (widgets.length) {
            lines.push('\nWidgets:')
            for (const w of widgets) {
                lines.push(`  ${w.key} -> ${w.widgetName}`)
            }
        }

        if (unimplemented.length) {
            lines.push('\nUnimplemented:')
            for (const u of unimplemented) {
                lines.push(`  ${u.key} (trigger zone exists but has no handler)`)
            }
        }

        if (!data.triggers.length) {
            lines.push('\nNo interactables defined for this room.')
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] }
    }
)

server.tool(
    'list_rooms',
    'List all rooms with their IDs and names',
    {},
    async () => {
        const lines = ['ID    | Name']
        lines.push('------+----------')
        const sorted = Object.entries(roomData).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        for (const [id, data] of sorted) {
            const triggerCount = data.triggers.length
            const exitCount = data.triggers.filter(t => t.type === 'room' || t.type === 'conditional_room').length
            lines.push(`${id.padStart(5)} | ${data.name.padEnd(12)} (${exitCount} exits, ${triggerCount} total triggers)`)
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] }
    }
)

server.tool(
    'get_room_map',
    'Get the full room adjacency graph showing all room-to-room connections',
    {},
    async () => {
        const lines = ['Room Map - All room-to-room connections\n']

        const sorted = Object.entries(roomData).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))

        for (const [id, data] of sorted) {
            const exits = data.triggers.filter(t => t.type === 'room' || t.type === 'conditional_room')
            if (!exits.length) {
                lines.push(`${data.name} (${id}): no exits`)
                continue
            }
            const exitList = exits.map(e => {
                const cond = e.condition ? ` [${e.condition}]` : ''
                return `${e.roomName}(${e.roomId})${cond}`
            }).join(', ')
            lines.push(`${data.name} (${id}): ${exitList}`)
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] }
    }
)

async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
}

main().catch(console.error)
