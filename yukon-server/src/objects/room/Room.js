export default class Room {

    constructor(data) {
        Object.assign(this, data)

        this.users = {}

        this.tables = {}
        this.waddles = {}
    }

    get userValues() {
        return Object.values(this.users)
    }

    get isFull() {
        return Object.keys(this.users).length >= this.maxUsers
    }

    add(user) {
        console.log('[DEBUG] Room.add: START, room =', this.id)
        this.users[user.socket.id] = user

        if (this.game) {
            console.log('[DEBUG] Room.add: sending join_game_room')
            return user.send('join_game_room', { game: this.id })
        }

        console.log('[DEBUG] Room.add: sending join_room')
        user.send('join_room', { room: this.id, users: this.userValues })
        console.log('[DEBUG] Room.add: sending add_player broadcast')
        this.send(user, 'add_player', { user: user })

        // Notify Discord plugin for voice channel sync
        console.log('[DEBUG] Room.add: calling Discord hook')
        user.handler.plugins.plugins.discord?.onRoomJoin(user, this)
        console.log('[DEBUG] Room.add: END')
    }

    remove(user) {
        if (!this.game) {
            this.send(user, 'remove_player', { user: user.id })
        }

        if (this.matchmaker && this.matchmaker.includes(user)) {
            this.matchmaker.remove(user)
        }

        delete this.users[user.socket.id]
    }

    /**
     * Sends a packet to all users in the room, by default the client is excluded.
     *
     * @param {User} user - Client User object
     * @param {string} action - Packet name
     * @param {object} args - Packet arguments
     * @param {Array} filter - Users to exclude
     * @param {boolean} checkIgnore - Whether or not to exclude users who have user added to their ignore list
     */
    send(user, action, args = {}, filter = [user], checkIgnore = false) {
        let users = this.userValues.filter(u => !filter.includes(u))

        for (let u of users) {
            if (checkIgnore && u.ignores.includes(user.id)) {
                continue
            }

            u.send(action, args)
        }
    }

}
