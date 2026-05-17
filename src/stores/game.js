import { defineStore } from 'pinia'
import { movies, moviesByLanguage } from '../data/movies.js'
import { db } from '../firebase.js'
import { ref as dbRef, set, update, onValue, get, remove } from 'firebase/database'

const MAX_LIVES = 6
const MAX_TIMER = 150
const BOT_DELAY = 1400

let _botTimer = null
let _unsubRoom = null

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const useGameStore = defineStore('game', {
  state: () => ({
    screen: 'home',           // home | setup | game | result | online
    setupVersion: 0,
    mode: null,               // bot | online
    botSubMode: null,         // 'player-guesses' | 'bot-guesses'
    selectedLanguage: null,
    movieWord: '',
    guessedLetters: [],
    lives: MAX_LIVES,
    winner: null,             // 'guesser' | 'setter'
    isBotGuessing: false,
    lastBotGuess: '',
    lastBotGuessCorrect: false,
    timer: MAX_TIMER,
    timerActive: false,
    // Online mode
    onlineRole: null,         // 'setter' | 'guesser'
    roomCode: '',
    isCreator: false,
    opponentConnected: false,
    movieLocked: false,
    // Used to signal OnlineScreen which step to show on rematch
    pendingOnlineStep: null,  // 'role-select' | 'join-waiting' | null
  }),

  getters: {
    setterName: (state) => {
      if (state.mode === 'online') return state.onlineRole === 'setter' ? 'You' : 'Friend'
      if (state.mode === 'bot') {
        return state.botSubMode === 'player-guesses' ? 'Bot 🤖' : 'You'
      }
      return 'Player 1'
    },

    guesserName: (state) => {
      if (state.mode === 'online') return state.onlineRole === 'guesser' ? 'You 🎮' : 'Friend 🎮'
      if (state.mode === 'bot') {
        return state.botSubMode === 'player-guesses' ? 'You 🎮' : 'Bot 🤖'
      }
      return 'Player 2'
    },

    displayWord: (state) => {
      return state.movieWord.split('').map((char) => {
        if (char === ' ') return { char: ' ', type: 'space', shown: true }
        if (!/[a-zA-Z]/.test(char)) return { char, type: 'special', shown: true }
        const shown = state.guessedLetters.includes(char.toLowerCase())
        return { char: char.toUpperCase(), type: 'letter', shown }
      })
    },

    isGameWon: (state) => {
      if (!state.movieWord) return false
      return state.movieWord
        .split('')
        .filter((c) => /[a-zA-Z]/.test(c))
        .every((c) => state.guessedLetters.includes(c.toLowerCase()))
    },

    isGameLost: (state) => state.lives <= 0,

    isGameOver() {
      return this.isGameWon || this.isGameLost
    },

    wrongGuesses: (state) =>
      state.guessedLetters.filter((l) => !state.movieWord.toLowerCase().includes(l)),

    correctGuesses: (state) =>
      state.guessedLetters.filter((l) => state.movieWord.toLowerCase().includes(l)),

    letterStatus: (state) => (l) => {
      l = l.toLowerCase()
      if (!state.guessedLetters.includes(l)) return 'idle'
      return state.movieWord.toLowerCase().includes(l) ? 'correct' : 'wrong'
    },

    heartsArray: (state) =>
      Array(MAX_LIVES)
        .fill(null)
        .map((_, i) => i < state.lives),

    timerPercent: (state) => (state.timer / MAX_TIMER) * 100,

    playerIsGuessing: (state) => {
      if (state.mode === 'online') return state.onlineRole === 'guesser'
      return state.mode !== 'bot' || state.botSubMode === 'player-guesses'
    },

    languageLabel: (state) => {
      const map = {
        english: 'English', hindi: 'Hindi', telugu: 'Telugu',
        tamil: 'Tamil', kannada: 'Kannada', malayalam: 'Malayalam',
      }
      return state.selectedLanguage ? map[state.selectedLanguage] : ''
    },
  },

  actions: {
    selectBotMode(subMode) {
      this.mode = 'bot'
      this.botSubMode = subMode
      this.selectedLanguage = null
      this.movieWord = ''
      this.setupVersion++
      this.screen = 'setup'
    },

    pickBotMovie() {
      const pool = (this.selectedLanguage && moviesByLanguage[this.selectedLanguage])
        || movies
      this.movieWord = pool[Math.floor(Math.random() * pool.length)]
    },

    lockInMovie(word) {
      this.movieWord = word.trim()
    },

    startGame() {
      this.guessedLetters = []
      this.lives = MAX_LIVES
      this.winner = null
      this.lastBotGuess = ''
      this.lastBotGuessCorrect = false
      this.timer = MAX_TIMER
      this.timerActive = this.playerIsGuessing
      this.screen = 'game'
      if (this.mode === 'bot' && this.botSubMode === 'bot-guesses') {
        this._startBot()
      }
    },

    guess(letter) {
      if (this.mode === 'online') return this._guessOnline(letter)
      const l = letter.toLowerCase()
      if (this.guessedLetters.includes(l) || this.isGameOver) return
      this.guessedLetters.push(l)
      const correct = this.movieWord.toLowerCase().includes(l)
      if (!correct) this.lives--
      this.timer = MAX_TIMER
      this._checkEnd()
      return correct
    },

    timerExpired() {
      if (this.isGameOver) return
      if (this.mode === 'online' && this.onlineRole === 'guesser') {
        const newLives = this.lives - 1
        this.lives = newLives
        this.timer = MAX_TIMER
        const updates = { lives: newLives }
        if (newLives <= 0) {
          this.winner = 'setter'
          this.timerActive = false
          updates.winner = 'setter'
          updates.status = 'result'
        }
        update(dbRef(db, `rooms/${this.roomCode}`), updates)
        return
      }
      this.lives--
      this.timer = MAX_TIMER
      this._checkEnd()
    },

    _checkEnd() {
      if (this.isGameWon) {
        this._stopBot()
        this.timerActive = false
        this.winner = 'guesser'
        setTimeout(() => { this.screen = 'result' }, 700)
      } else if (this.isGameLost) {
        this._stopBot()
        this.timerActive = false
        this.winner = 'setter'
        setTimeout(() => { this.screen = 'result' }, 700)
      }
    },

    _startBot() {
      this.isBotGuessing = true
      const all = 'abcdefghijklmnopqrstuvwxyz'.split('')
      const tick = () => {
        if (!this.isBotGuessing || this.isGameOver) return
        const pool = all.filter((l) => !this.guessedLetters.includes(l))
        if (!pool.length) return
        const pick = pool[Math.floor(Math.random() * pool.length)]
        this.lastBotGuess = pick.toUpperCase()
        this.lastBotGuessCorrect = this.movieWord.toLowerCase().includes(pick)
        this.guess(pick)
        if (!this.isGameOver) _botTimer = setTimeout(tick, BOT_DELAY)
      }
      _botTimer = setTimeout(tick, BOT_DELAY + 200)
    },

    _stopBot() {
      this.isBotGuessing = false
      clearTimeout(_botTimer)
      _botTimer = null
    },

    playAgain() {
      this._stopBot()

      if (this.mode === 'online') {
        // Reset game state but keep room + subscription alive for rematch
        this.onlineRole = null
        this.movieLocked = false
        this.guessedLetters = []
        this.lives = MAX_LIVES
        this.winner = null
        this.timer = MAX_TIMER
        this.timerActive = false

        // Signal OnlineScreen which step to show (consumed via immediate watch)
        this.pendingOnlineStep = this.isCreator ? 'role-select' : 'join-waiting'

        // Creator resets the Firebase room back to post-join state
        if (this.isCreator && this.roomCode) {
          update(dbRef(db, `rooms/${this.roomCode}`), {
            status: 'joined',
            creatorRole: null,
            language: null,
            movieWord: '',
            guessedLetters: '',
            lives: MAX_LIVES,
            winner: null,
          })
        }

        this.screen = 'online'
        return
      }

      // Bot mode: reset and go back to language/setup
      this.selectedLanguage = null
      this.setupVersion++
      this.screen = 'setup'
    },

    goOnline() {
      this.mode = 'online'
      this.screen = 'online'
    },

    // ── Online multiplayer ──────────────────────────────────────────────────

    async createRoom() {
      let code, snap
      do {
        code = generateCode()
        snap = await get(dbRef(db, `rooms/${code}`))
      } while (snap.exists())

      await set(dbRef(db, `rooms/${code}`), {
        status: 'waiting',
        creatorRole: null,
        language: null,
        movieWord: '',
        guessedLetters: '',
        lives: MAX_LIVES,
        winner: null,
        createdAt: Date.now(),
      })

      this.mode = 'online'
      this.isCreator = true
      this.roomCode = code
      this.opponentConnected = false
      this.movieLocked = false
      this._subscribeOnline(code)
    },

    async joinRoom(code) {
      const key = code.toUpperCase()
      const snap = await get(dbRef(db, `rooms/${key}`))
      if (!snap.exists()) throw new Error('Room not found')
      const data = snap.val()
      if (data.status !== 'waiting') throw new Error('Room is not available')

      await update(dbRef(db, `rooms/${key}`), { status: 'joined' })

      this.mode = 'online'
      this.isCreator = false
      this.roomCode = key
      this._subscribeOnline(key)
    },

    async chooseRoles(creatorIsGuesser) {
      const creatorRole = creatorIsGuesser ? 'guesser' : 'setter'
      await update(dbRef(db, `rooms/${this.roomCode}`), {
        status: 'roles_set',
        creatorRole,
      })
      this.onlineRole = creatorRole
    },

    async lockOnlineMovie(language, word) {
      await update(dbRef(db, `rooms/${this.roomCode}`), {
        status: 'movie_ready',
        language,
        movieWord: word.trim(),
      })
      this.selectedLanguage = language
      this.movieWord = word.trim()
      this.movieLocked = true
    },

    async startOnlineGame() {
      await update(dbRef(db, `rooms/${this.roomCode}`), {
        status: 'game',
        guessedLetters: '',
        lives: MAX_LIVES,
        winner: null,
      })
    },

    async _guessOnline(letter) {
      const l = letter.toLowerCase()
      if (this.guessedLetters.includes(l) || this.isGameOver) return false

      const newGuessed = [...this.guessedLetters, l]
      const correct = this.movieWord.toLowerCase().includes(l)
      const newLives = correct ? this.lives : this.lives - 1

      this.guessedLetters = newGuessed
      this.lives = newLives
      this.timer = MAX_TIMER

      const allLetters = this.movieWord.split('').filter((c) => /[a-zA-Z]/.test(c))
      const won = allLetters.every((c) => newGuessed.includes(c.toLowerCase()))
      const lost = newLives <= 0

      const updates = { guessedLetters: newGuessed.join(','), lives: newLives }
      if (won || lost) {
        this.winner = won ? 'guesser' : 'setter'
        this.timerActive = false
        updates.winner = this.winner
        updates.status = 'result'
      }

      await update(dbRef(db, `rooms/${this.roomCode}`), updates)
      return correct
    },

    _subscribeOnline(code) {
      if (_unsubRoom) { _unsubRoom(); _unsubRoom = null }

      _unsubRoom = onValue(dbRef(db, `rooms/${code}`), (snap) => {
        if (!snap.exists()) {
          if (!this.isCreator && this.screen !== 'home') {
            this.leaveRoom()
            this.screen = 'home'
          }
          return
        }
        const data = snap.val()

        if (data.status === 'joined' && this.isCreator) {
          this.opponentConnected = true
        }

        const rolesStatuses = ['roles_set', 'movie_ready', 'game', 'result']
        if (rolesStatuses.includes(data.status) && data.creatorRole && !this.onlineRole) {
          this.onlineRole = this.isCreator
            ? data.creatorRole
            : (data.creatorRole === 'guesser' ? 'setter' : 'guesser')
        }

        if (['movie_ready', 'game', 'result'].includes(data.status) && !this.movieLocked) {
          if (data.language) this.selectedLanguage = data.language
          if (data.movieWord) this.movieWord = data.movieWord
          this.movieLocked = true
        }

        if (data.status === 'game' && this.screen !== 'game') {
          this.guessedLetters = []
          this.lives = MAX_LIVES
          this.winner = null
          this.timer = MAX_TIMER
          this.timerActive = this.onlineRole === 'guesser'
          this.screen = 'game'
        }

        if (data.status === 'game' || data.status === 'result') {
          const letters = data.guessedLetters
            ? data.guessedLetters.split(',').filter(Boolean)
            : []
          if (letters.join(',') !== this.guessedLetters.join(',')) this.guessedLetters = letters
          if (data.lives !== this.lives) this.lives = data.lives
          if (data.winner && !this.winner) this.winner = data.winner
        }

        if (data.status === 'result' && this.screen === 'game') {
          this.timerActive = false
          if (data.winner) this.winner = data.winner
          setTimeout(() => { this.screen = 'result' }, 700)
        }
      })
    },

    leaveRoom() {
      if (_unsubRoom) { _unsubRoom(); _unsubRoom = null }
      if (this.roomCode && this.isCreator) {
        remove(dbRef(db, `rooms/${this.roomCode}`))
      }
      this.roomCode = ''
      this.onlineRole = null
      this.isCreator = false
      this.opponentConnected = false
      this.movieLocked = false
    },

    // ── End online ──────────────────────────────────────────────────────────

    goHome() {
      this._stopBot()
      this.leaveRoom()
      this.screen = 'home'
      this.mode = null
      this.botSubMode = null
      this.selectedLanguage = null
      this.movieWord = ''
      this.guessedLetters = []
      this.lives = MAX_LIVES
      this.winner = null
      this.isBotGuessing = false
      this.lastBotGuess = ''
      this.timer = MAX_TIMER
      this.timerActive = false
      this.pendingOnlineStep = null
    },
  },
})
