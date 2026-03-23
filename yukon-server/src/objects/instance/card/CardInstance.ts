import BaseInstance from '../BaseInstance'

import Ninja from './ninja/Ninja'
import Power from './Power'
import Rules from './Rules'

import type Card from './ninja/Card'
import type { Args } from '../../../server/Server'
import type GameUser from '@objects/user/GameUser'

export default class CardInstance extends BaseInstance {

    ninjas: Record<number, Ninja>
    powers: Power[]

    xpPercentageStart: number
    rankSpeed: number
    itemAwards: number[]
    postcardAwards: Record<number, number>

    constructor(waddle: any) {
        super(waddle, 998)

        this.ninjas = {}

        this.powers = []

        // xpPercentageIncrease(0) = 60
        this.xpPercentageStart = 60

        this.rankSpeed = 1

        this.itemAwards = [4025, 4026, 4027, 4028, 4029, 4030, 4031, 4032, 4033, 104]
        this.postcardAwards = { 1: 177, 5: 178, 9: 179 }

        ;(this as any).handleSendDeal = this.handleSendDeal.bind(this)
        ;(this as any).handlePickCard = this.handlePickCard.bind(this)
    }

    init() {
        super.init()

        for (const user of this.users) {
            if (!user) continue
            this.ninjas[user.id] = new Ninja(user)
        }

        for (const user of this.users) {
            if (!user) continue
            const opponent = this.getOpponent(user)

            if (opponent) {
                this.ninjas[user.id].opponent = this.ninjas[opponent.id]
            }
        }
    }

    addListeners(user: GameUser) {
        user.events!.on('send_deal', this.handleSendDeal)
        user.events!.on('pick_card', this.handlePickCard)

        super.addListeners(user)
    }

    removeListeners(user: GameUser) {
        user.events!.off('send_deal', this.handleSendDeal)
        user.events!.off('pick_card', this.handlePickCard)

        super.removeListeners(user)
    }

    handleSendDeal(args: Args, user: GameUser) {
        const me = this.ninjas[user.id]

        if (me.hasDealt) {
            return
        }

        const cards = me.dealCards()

        user.send('send_deal', { cards })
        me.opponent!.send('send_opponent_deal', { deal: cards.length })
    }

    handlePickCard(args: Args, user: GameUser) {
        const me = this.ninjas[user.id]

        if (!me.isInDealt(args.card) || me.pick) {
            return
        }

        me.pickCard(args.card)

        if (!me.opponent!.pick) {
            return
        }

        me.revealCards()
        this.judgeRound(me)
    }

    start() {
        const users = this.users.map(user => user && ({
            username: user.username,
            color: user.color,
            ninjaRank: user.ninjaRank
        }))

        this.send('start_game', { users })

        super.start()
    }

    judgeRound(me: Ninja) {
        const winner = this.getRoundWinner()

        this.send('judge', { winner })

        if (winner > -1) {
            this.checkWin(winner)
        }

        me.resetTurn()
        me.opponent!.resetTurn()
    }

    getRoundWinner() {
        const first = this.getPick(0)!
        const second = this.getPick(1)!

        this.applyPowers(first, second)

        this.powers = []

        this.checkPowersOnPlayed()
        this.checkPowerOnScored(first, second)

        return this.getWinningSeat(first, second)
    }

    applyPowers(first: Card, second: Card) {
        for (const power of this.powers) {
            const id = power.id

            if (id == 1) {
                this.reverseCardValues(first, second)
            }

            // +2 to self
            if (id == 2) {
                const target = power.seat == 0 ? first : second
                target.value += 2
            }

            // -2 from opponent
            if (id == 3) {
                const target = power.seat == 0 ? second : first
                target.value -= 2
            }
        }
    }

    reverseCardValues(first: Card, second: Card) {
        const swap = first.value

        first.value = second.value
        second.value = swap
    }

    checkPowersOnPlayed() {
        this.checkPowerOnPlayed(0)
        this.checkPowerOnPlayed(1)
    }

    checkPowerOnPlayed(seat: number) {
        this.checkPower(seat, true)
    }

    checkPowerOnScored(first: Card, second: Card) {
        const winSeat = this.getWinningSeat(first, second)

        if (winSeat > -1) {
            this.checkPower(winSeat, false)
        }
    }

    checkPower(seat: number, onPlayed: boolean) {
        const card = this.getPick(seat)!

        if (!this.hasPower(card)) {
            return
        }

        if (onPlayed && !this.isOnPlayed(card)) {
            return
        }
        if (!onPlayed && this.isOnPlayed(card)) {
            return
        }

        if (!Rules.currentRound.includes(card.powerId)) {
            this.addPower(seat, card)
            return
        }

        if (onPlayed) {
            this.replaceCards(card)
        } else {
            this.discardCards(card, seat)
        }
    }

    hasPower(card: Card) {
        return card.powerId > 0
    }

    isOnPlayed(card: Card) {
        return Rules.onPlayed.includes(card.powerId)
    }

    addPower(seat: number, card: Card) {
        if (card.powerId == 1) {
            const hasReverse = this.powers.some(power => power.id == 1)

            if (hasReverse) {
                return
            }
        }

        this.powers.push(new Power(seat, card))
    }

    replaceCards(card: Card) {
        const first = this.getPick(0)!
        const second = this.getPick(1)!

        const [original, replace] = Rules.replacements[card.powerId]

        if (first.element == original) {
            first.element = replace
        }

        if (second.element == original) {
            second.element = replace
        }
    }

    discardCards(card: Card, seat: number) {
        const opponent = this.getNinja(seat).opponent!

        if (card.powerId in Rules.discardElements) {
            this.discardElements(card, opponent)
        }

        if (card.powerId in Rules.discardColors) {
            this.discardColors(card, opponent)
        }
    }

    discardElements(card: Card, opponent: Ninja) {
        const element = Rules.discardElements[card.powerId]

        if (opponent.wins[element].length) {
            opponent.wins[element].pop()
        }
    }

    discardColors(card: Card, opponent: Ninja) {
        const color = Rules.discardColors[card.powerId]
        const wins = opponent.wins

        for (const element in wins) {
            const index = wins[element].findIndex(win => win.color == color)

            if (index > -1) {
                wins[element].splice(index, 1)
                return
            }
        }
    }

    getWinningSeat(first: Card, second: Card) {
        if (first.element != second.element) {
            return this.compareElements(first, second)
        }

        if (first.value > second.value) {
            return 0
        }

        if (second.value > first.value) {
            return 1
        }

        return -1
    }

    compareElements(first: Card, second: Card) {
        if (Rules.elements[first.element] == second.element) {
            return 0
        }

        return 1
    }

    checkWin(winSeat: number) {
        const winner = this.getNinja(winSeat)
        const winCard = winner.pick!

        const loser = this.getNinja(this.getOppositeSeat(winSeat))

        winner.wins[winCard.originalElement].push(winCard)

        const winningCards = this.getWinningCards(winner)

        if (winningCards) {
            this.updateNinja(winner, loser)
            this.sendWin(winSeat, winningCards)

        } else {
            this.checkPlayable()
        }
    }

    sendWin(winSeat: number, winningCards: Card[] = []) {
        this.send('winner', { winner: winSeat, cards: winningCards.map(card => card.id) })

        this.users.forEach(user => { if (user) super.remove(user) })
    }

    getWinningCards(winner: Ninja): Card[] | false {
        const wins = Object.values(winner.wins)

        for (const element of wins) {
            const result = this.check1ElementWin(element)

            if (result) {
                return result
            }
        }

        const result = this.check3ElementWin(wins)

        if (result) {
            return result
        }

        return false
    }

    check1ElementWin(element: Card[]): Card[] | false {
        const result: Card[] = []
        const colors: string[] = []

        for (const card of element) {
            if (colors.includes(card.color)) {
                continue
            }

            result.push(card)
            colors.push(card.color)

            if (result.length == 3) {
                return result
            }
        }

        return false
    }

    check3ElementWin(cards: Card[][]): Card[] | false {
        const product = this.product(cards)

        for (const combo of product) {
            const colors = new Set(combo.map(card => card.color))

            if (colors.size == 3) {
                return combo
            }
        }

        return false
    }

    checkPlayable() {
        const ninjas = [this.getNinja(0), this.getNinja(1)]

        for (const ninja of ninjas) {
            if (this.hasPlayableCards(ninja)) {
                continue
            }

            const winSeat = ninjas.indexOf(ninja.opponent!)

            this.updateNinja(ninja.opponent!, ninja)
            this.sendWin(winSeat)

            return
        }
    }

    hasPlayableCards(ninja: Ninja) {
        const limiters = this.powers.filter(power => power.id in Rules.limiters)

        for (const limiter of limiters) {
            const element = Rules.limiters[limiter.id]

            const target = this.getNinja(this.getOppositeSeat(limiter.seat))

            if (target == ninja) {
                return ninja.hasPlayableCards(element)
            }
        }

        return true
    }

    updateNinja(winner: Ninja, loser: Ninja) {
        this.updateProgress(winner.user as GameUser, true)
        this.updateProgress(loser.user as GameUser, false)
    }

    updateProgress(user: GameUser, won: boolean) {
        if (this.checkNoBeltWin(user, won)) {
            user.update({ ninjaProgress: 100 })

        } else if (user.ninjaRank < 9) {
            const speed = won ? this.rankSpeed : this.rankSpeed * 0.5

            const increase = this.xpPercentageIncrease(user.ninjaRank) * speed

            user.update({ ninjaProgress: user.ninjaProgress + increase })
        }

        if (user.ninjaProgress >= 100) {
            this.rankUp(user)
        }
    }

    checkNoBeltWin(user: GameUser, won: boolean) {
        return user.ninjaRank == 0 && won
    }

    xpPercentageIncrease(rank: number) {
        return Math.floor(this.xpPercentageStart / (rank + 1))
    }

    rankUp(user: GameUser) {
        const rank = user.ninjaRank + 1

        if (rank > this.itemAwards.length) {
            return
        }

        this.addAwards(user, rank)

        user.update({ ninjaRank: rank })
        user.update({ ninjaProgress: 0 })

        user.send('award', { rank: user.ninjaRank })
    }

    addAwards(user: GameUser, rank: number) {
        const item = this.itemAwards[rank - 1]

        if (!user.inventory.includes(item)) {
            user.inventory.add(item)
        }

        if (rank in this.postcardAwards) {
            user.addSystemMail(this.postcardAwards[rank])
        }
    }

    remove(user: GameUser) {
        super.remove(user)

        this.closeGame(user)
    }

    closeGame(user: GameUser) {
        this.send('close_game', { username: user.username })
    }

    getPick(seat: number) {
        const ninja = this.getNinja(seat)

        return ninja.pick
    }

    getNinja(seat: number) {
        const user = this.users[seat]!

        return this.ninjas[user.id]
    }

    getOpponent(user: GameUser) {
        const seat = this.getSeat(user)
        const opponentSeat = this.getOppositeSeat(seat)

        return this.users[opponentSeat]
    }

    getOppositeSeat(seat: number) {
        return (seat + 1) % 2
    }

    product(arrays: Card[][]): Card[][] {
        return (arrays as any).reduce((acc: any, arr: any) => acc.flatMap((x: any) => arr.map((y: any) => [x, y].flat())))
    }

}
