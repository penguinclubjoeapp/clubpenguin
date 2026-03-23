import CardInstance from './CardInstance'

import SenseiNinja from './ninja/SenseiNinja'

import type Ninja from './ninja/Ninja'
import type { Args } from '../../../server/Server'
import type GameUser from '@objects/user/GameUser'

export default class SenseiInstance extends CardInstance {

    user: GameUser
    senseiData: { username: string, color: number, ninjaRank: number, sensei: boolean }
    sensei: SenseiNinja | null
    me: Ninja | null

    constructor(user: GameUser) {
        super({ users: [user] })

        this.user = user

        this.senseiData = {
            username: 'Sensei',
            color: 14,
            ninjaRank: 10,
            sensei: true
        }

        this.sensei = null
        this.me = null
    }

    init() {
        super.init()

        this.sensei = new SenseiNinja()
        this.me = this.ninjas[this.user.id]

        this.sensei.opponent = this.me
        this.me.opponent = this.sensei
    }

    start() {
        const users = [
            this.senseiData,
            {
                username: this.user.username,
                color: this.user.color,
                ninjaRank: this.user.ninjaRank
            }
        ]

        this.send('start_game', { users })

        this.started = true
    }

    handleStartGame() {
        this.start()
    }

    handleSendDeal(args: Args, user: GameUser) {
        if (this.me!.hasDealt) {
            return
        }

        const canBeatSensei = user.ninjaRank >= this.itemAwards.length - 1

        const cards = this.me!.dealCards(canBeatSensei)
        const senseiCards = this.sensei!.dealCards(cards, canBeatSensei)

        user.send('send_deal', { cards })
        user.send('send_opponent_deal', { deal: senseiCards.length })
    }

    handlePickCard(args: Args, _user: GameUser) {
        if (!this.me!.isInDealt(args.card) || this.me!.pick) {
            return
        }

        this.me!.pickCard(args.card)
        this.sensei!.pickCard(args.card)

        this.me!.revealCards()
        this.judgeRound(this.me!)
    }

    updateProgress(user: GameUser, won: boolean) {
        if (!user) {
            return
        }

        if (this.checkBlackBeltWin(user, won)) {
            user.update({ ninjaProgress: 100 })
        }

        super.updateProgress(user, won)
    }

    checkBlackBeltWin(user: GameUser, won: boolean) {
        return user.ninjaRank == 9 && won
    }

    getNinja(seat: number) {
        return [this.sensei!, this.me!][seat]
    }

}
