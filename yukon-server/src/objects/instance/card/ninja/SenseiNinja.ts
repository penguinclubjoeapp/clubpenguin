import Ninja from './Ninja'

import Card from './Card'
import Rules from '../Rules'

import { cards } from '@data'

export default class SenseiNinja extends Ninja {

    moves: Record<number, number[]>

    constructor() {
        super()

        this.moves = {}
    }

    dealCards(opponentCards: any, canBeatSensei?: any) {
        const currentDealt: Card[] = []
        const dealNumber = this.dealtSize - this.dealt.length

        for (let i = 0; i < dealNumber; i++) {
            const deal = canBeatSensei ? this.dealRandomCard() : this.dealWinCard(opponentCards[i])

            const card = new Card(Number(deal))

            currentDealt.push(card)
            this.dealt.push(card)

            this.addToMoves(opponentCards[i].id, Number(deal))
        }

        return currentDealt
    }

    dealRandomCard() {
        const ids = Object.keys(cards)

        return this.getRandomElement(ids)
    }

    dealWinCard(card: Card) {
        const winCards = Object.keys(cards).filter(c => this.beatsCard(cards[c], card))

        if (!winCards.length) {
            return this.dealRandomCard()
        }

        return this.getRandomElement(winCards)
    }

    beatsCard(first: { element: string, value: number }, second: Card) {
        if (first.element != second.element) {
            return this.compareElements(first, second)
        }

        return first.value > second.value
    }

    compareElements(first: { element: string }, second: { element: string }) {
        return Rules.elements[first.element] == second.element
    }

    pickCard(opponentCard: number) {
        const card = this.removeFromMoves(opponentCard)
        this.pick = this.getPick(card)!

        this.opponent!.send('pick_card', { card: this.dealt.indexOf(this.pick) })

        this.dealt.splice(this.dealt.indexOf(this.pick), 1)
    }

    addToMoves(opponentCard: number, deal: number) {
        if (!this.moves[opponentCard]) {
            this.moves[opponentCard] = []
        }

        this.moves[opponentCard].push(deal)
    }

    removeFromMoves(opponentCard: number) {
        const card = this.moves[opponentCard].pop()!

        if (!this.moves[opponentCard].length) {
            delete this.moves[opponentCard]
        }

        return card
    }

    getRandomElement<T>(array: T[]): T {
        return array[Math.floor(Math.random() * array.length)]
    }

    send() {

    }

}
