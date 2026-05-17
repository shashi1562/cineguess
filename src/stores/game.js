import { defineStore } from 'pinia'
import { movies, moviesByLanguage } from '../data/movies.js'
import { db } from '../firebase.js'
import { ref as dbRef, set, update, onValue, get, remove, onDisconnect } from 'firebase/database'

const MAX_LIVES = 6
const MAX_TIMER = 150
const PASSPLAY_ROUNDS = 2
const BOT_DELAY = 1400

let _botTimer = null
let _unsubRoom = null

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── localStorage helpers ────────────────────────────────────────────────────
function saveSession(data) {
  try { localStorage.setItem('cg_session', JSON.stringify(data)) } catch {}
}
function clearSession() {
  try { localStorage.removeItem('cg_session') } catch {}
}
function getSession() {
  try { return JSON.parse(localStorage.getItem('cg_session') || 'null') } catch { return null }
}
function saveLocalSession(data) {
  try { localStorage.setItem('cg_local', JSON.stringify(data)) } catch {}
}
function clearLocalSession() {
  try { localStorage.removeItem('cg_local') } catch {}
}

// Synchronous reads used in state() initializer to avoid home-screen flash on refresh
function _readLocalSession() {
  try {
    const saved = localStorage.getItem('cg_local')
    if (!saved) return null
    const p = JSON.parse(saved)
    return (p?.mode && p.mode !== 'online' && p.movieWord) ? p : null
  } catch { return null }
}
function _hasOnlineSession() {
  try {
    const s = localStorage.getItem('cg_session')
    return !!(s && JSON.parse(s)?.roomCode)
  } catch { return false }
}

export const useGameStore = defineStore('game', {
  // Synchronously restore local game state so there is no home-screen flash on refresh
  state: () => {
    const local = _readLocalSession()
    const onlinePending = !local && _hasOnlineSession()
    return {
      screen: local ? 'game' : (onlinePending ? 'loading' : 'home'),
      setupVersion: 0,
      mode: local?.mode ?? null,
      botSubMode: local?.botSubMode ?? null,
      selectedLanguage: local?.selectedLanguage ?? null,
      movieWord: local?.movieWord ?? '',
      hint: local?.hint ?? '',
      guessedLetters: local?.guessedLetters ?? [],
      lives: local?.lives ?? MAX_LIVES,
      round: local?.round ?? 1,
      setterPlayer: local?.setterPlayer ?? 1,
      scores: local?.scores ?? { p1: 0, p2: 0 },
      winner: null,
      isFinalResult: false,
      isBotGuessing: false,
      lastBotGuess: '',
      lastBotGuessCorrect: false,
      timer: local?.timer ?? MAX_TIMER,
      timerActive: false, // set by resumeSession after validation
      revealUsed: local?.revealUsed ?? false,
      // Online mode
      onlineRole: null,
      roomCode: '',
      isCreator: false,
      opponentConnected: false,
      movieLocked: false,
      opponentPresent: false,
      pendingOnlineStep: null,
    }
  },

  getters: {
    setterName: (state) => {
      if (state.mode === 'online') return state.onlineRole === 'setter' ? 'You' : 'Friend'
      if (state.mode === 'bot') return state.botSubMode === 'player-guesses' ? 'Bot 🤖' : 'You'
      return `Player ${state.setterPlayer}`
    },

    guesserName: (state) => {
      if (state.mode === 'online') return state.onlineRole === 'guesser' ? 'You 🎮' : 'Friend 🎮'
      if (state.mode === 'bot') return state.botSubMode === 'player-guesses' ? 'You 🎮' : 'Bot 🤖'
      return `Player ${state.setterPlayer === 1 ? 2 : 1}`
    },

    guesserPlayer: (state) => {
      if (state.mode === 'passplay') return state.setterPlayer === 1 ? 2 : 1
      return null
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
      const letters = state.movieWord.split('').filter((c) => /[a-zA-Z]/.test(c))
      if (!letters.length) return false // movie with no letters is never "won"
      return letters.every((c) => state.guessedLetters.includes(c.toLowerCase()))
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
      Array(MAX_LIVES).fill(null).map((_, i) => i < state.lives),

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

    hintRevealed: (state) => {
      if (!state.hint || !state.movieWord) return false
      const total = [...new Set(
        state.movieWord.toLowerCase().split('').filter(c => /[a-z]/.test(c))
      )].length
      return total > 0 && state.correctGuesses.length >= Math.ceil(total * 0.5)
    },
  },

  actions: {
    selectMode(mode) {
      this.mode = mode
      this.botSubMode = null
      this.selectedLanguage = null
      this.round = 1
      this.setterPlayer = 1
      this.scores = { p1: 0, p2: 0 }
      this.setupVersion++
      this.screen = 'setup'
    },

    selectBotMode(subMode) {
      this.mode = 'bot'
      this.botSubMode = subMode
      this.selectedLanguage = null
      this.movieWord = ''
      this.hint = ''
      this.round = 1
      this.scores = { p1: 0, p2: 0 }
      this.setupVersion++
      this.screen = 'setup'
    },

    pickBotMovie() {
      const pool = (this.selectedLanguage && moviesByLanguage[this.selectedLanguage]) || movies
      this.movieWord = pool[Math.floor(Math.random() * pool.length)]
    },

    lockInMovie(word, hint = '') {
      this.movieWord = word.trim()
      this.hint = hint.trim()
    },

    startGame() {
      this.guessedLetters = []
      this.lives = MAX_LIVES
      this.winner = null
      this.lastBotGuess = ''
      this.lastBotGuessCorrect = false
      this.timer = MAX_TIMER
      this.timerActive = this.playerIsGuessing
      this.revealUsed = false
      this.screen = 'game'
      if (this.mode !== 'online') this._saveLocal()
      if (this.mode === 'bot' && this.botSubMode === 'bot-guesses') {
        this._startBot()
      }
    },

    _saveLocal() {
      if (this.mode === 'online') return
      saveLocalSession({
        mode: this.mode,
        botSubMode: this.botSubMode,
        selectedLanguage: this.selectedLanguage,
        movieWord: this.movieWord,
        hint: this.hint,
        guessedLetters: this.guessedLetters,
        lives: this.lives,
        timer: this.timer,
        round: this.round,
        setterPlayer: this.setterPlayer,
        scores: { ...this.scores },
        revealUsed: this.revealUsed,
      })
    },

    guess(letter) {
      if (this.mode === 'online') return this._guessOnline(letter)
      const l = letter.toLowerCase()
      if (this.guessedLetters.includes(l) || this.isGameOver) return
      this.guessedLetters.push(l)
      const correct = this.movieWord.toLowerCase().includes(l)
      if (!correct) this.lives--
      this.timer = MAX_TIMER
      this._saveLocal()
      this._checkEnd()
      return correct
    },

    revealLetter() {
      if (this.revealUsed || this.lives <= 1 || this.isGameOver) return
      const unguessed = [...new Set(
        this.movieWord.toLowerCase().split('').filter(c => /[a-z]/.test(c))
      )].filter(c => !this.guessedLetters.includes(c))
      if (!unguessed.length) return
      const pick = unguessed[Math.floor(Math.random() * unguessed.length)]
      this.revealUsed = true
      this.lives--
      if (this.mode === 'online') {
        this._guessOnlineReveal(pick)
      } else {
        this.guessedLetters = [...this.guessedLetters, pick]
        this.timer = MAX_TIMER
        this._saveLocal()
        this._checkEnd()
      }
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
      this._saveLocal()
      this._checkEnd()
    },

    _checkEnd() {
      if (this.isGameWon) {
        clearLocalSession()
        this._stopBot()
        this.timerActive = false
        this.winner = 'guesser'
        if (this.mode === 'passplay') {
          const gp = this.setterPlayer === 1 ? 2 : 1
          if (gp === 1) this.scores.p1++
          else this.scores.p2++
        }
        setTimeout(() => { this.screen = 'result' }, 700)
      } else if (this.isGameLost) {
        clearLocalSession()
        this._stopBot()
        this.timerActive = false
        this.winner = 'setter'
        if (this.mode === 'passplay') {
          if (this.setterPlayer === 1) this.scores.p1++
          else this.scores.p2++
        }
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
      clearLocalSession()
      this._stopBot()
      if (this.mode === 'online') {
        const code = this.roomCode
        // Reset room for a new round — keep both players connected
        update(dbRef(db, `rooms/${code}`), {
          status: 'joined',
          creatorRole: null,
          movieWord: '',
          hint: '',
          guessedLetters: '',
          lives: MAX_LIVES,
          winner: null,
        })
        this.onlineRole = null
        this.movieWord = ''
        this.hint = ''
        this.guessedLetters = []
        this.lives = MAX_LIVES
        this.winner = null
        this.movieLocked = false
        saveSession({ roomCode: code, isCreator: this.isCreator, onlineRole: null })
        this.pendingOnlineStep = this.isCreator ? 'role-select' : 'join-waiting'
        this.screen = 'online'
        return
      }
      if (this.mode === 'passplay') {
        if (this.round < PASSPLAY_ROUNDS) {
          this.round++
          this.setterPlayer = this.setterPlayer === 1 ? 2 : 1
          this.hint = ''
          this.setupVersion++
          this.screen = 'setup'
        } else {
          this.isFinalResult = true
        }
      } else {
        this.selectedLanguage = null
        this.hint = ''
        this.setupVersion++
        this.screen = 'setup'
      }
    },

    goOnline() {
      this.mode = 'online'
      this.screen = 'online'
    },

    goGroup() {
      this.screen = 'group'
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
        hint: '',
        guessedLetters: '',
        lives: MAX_LIVES,
        winner: null,
        creatorPresent: true,
        joinerPresent: false,
        createdAt: Date.now(),
      })
      onDisconnect(dbRef(db, `rooms/${code}/creatorPresent`)).set(false)

      this.mode = 'online'
      this.isCreator = true
      this.roomCode = code
      this.opponentConnected = false
      this.movieLocked = false
      saveSession({ roomCode: code, isCreator: true, onlineRole: null })
      this._subscribeOnline(code)
    },

    async joinRoom(code) {
      const key = code.toUpperCase()
      const snap = await get(dbRef(db, `rooms/${key}`))
      if (!snap.exists()) throw new Error('Room not found')
      const data = snap.val()
      if (data.status !== 'waiting') throw new Error('Room is not available')

      await update(dbRef(db, `rooms/${key}`), { status: 'joined', joinerPresent: true })
      onDisconnect(dbRef(db, `rooms/${key}/joinerPresent`)).set(false)

      this.mode = 'online'
      this.isCreator = false
      this.roomCode = key
      saveSession({ roomCode: key, isCreator: false, onlineRole: null })
      this._subscribeOnline(key)
    },

    async chooseRoles(creatorIsGuesser) {
      const creatorRole = creatorIsGuesser ? 'guesser' : 'setter'
      await update(dbRef(db, `rooms/${this.roomCode}`), { status: 'roles_set', creatorRole })
      this.onlineRole = creatorRole
      saveSession({ roomCode: this.roomCode, isCreator: this.isCreator, onlineRole: creatorRole })
    },

    async lockOnlineMovie(language, word, hint = '') {
      await update(dbRef(db, `rooms/${this.roomCode}`), {
        status: 'movie_ready',
        language,
        movieWord: word.trim(),
        hint: hint.trim(),
      })
      this.selectedLanguage = language
      this.movieWord = word.trim()
      this.hint = hint.trim()
      this.movieLocked = true
      saveSession({
        roomCode: this.roomCode, isCreator: this.isCreator, onlineRole: this.onlineRole,
        movieWord: word.trim(), selectedLanguage: language, hint: hint.trim(),
      })
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

    async _guessOnlineReveal(letter) {
      const newGuessed = [...this.guessedLetters, letter]
      const newLives = this.lives
      this.guessedLetters = newGuessed
      this.timer = MAX_TIMER
      const allLetters = this.movieWord.split('').filter(c => /[a-zA-Z]/.test(c))
      const won = allLetters.every(c => newGuessed.includes(c.toLowerCase()))
      const updates = { guessedLetters: newGuessed.join(','), lives: newLives }
      if (won) {
        this.winner = 'guesser'
        this.timerActive = false
        updates.winner = 'guesser'
        updates.status = 'result'
      }
      await update(dbRef(db, `rooms/${this.roomCode}`), updates)
      if (won) setTimeout(() => { this.screen = 'result' }, 700)
    },

    _subscribeOnline(code) {
      if (_unsubRoom) { _unsubRoom(); _unsubRoom = null }

      _unsubRoom = onValue(dbRef(db, `rooms/${code}`), (snap) => {
        if (!snap.exists()) {
          if (!this.isCreator && this.screen !== 'online') {
            this.leaveRoom()
            this.screen = 'online'
          }
          return
        }
        const data = snap.val()

        // Opponent presence
        const opponentField = this.isCreator ? 'joinerPresent' : 'creatorPresent'
        if (data[opponentField] !== undefined) this.opponentPresent = !!data[opponentField]

        // Joiner connected
        if (data.status === 'joined' && this.isCreator) this.opponentConnected = true

        // Roles assigned
        const rolesStatuses = ['roles_set', 'movie_ready', 'game', 'result']
        if (rolesStatuses.includes(data.status) && data.creatorRole && !this.onlineRole) {
          this.onlineRole = this.isCreator
            ? data.creatorRole
            : (data.creatorRole === 'guesser' ? 'setter' : 'guesser')
          saveSession({ roomCode: this.roomCode, isCreator: this.isCreator, onlineRole: this.onlineRole })
        }

        // Movie word sync — always take movieWord from Firebase so the guesser
        // (who never stores it in session) always sees the real value on refresh
        if (['movie_ready', 'game', 'result'].includes(data.status)) {
          if (data.language) this.selectedLanguage = data.language
          if (data.movieWord) this.movieWord = data.movieWord
          if (data.hint !== undefined) this.hint = data.hint || ''
          this.movieLocked = true
        }

        // ── Restore from refresh (screen === 'loading') ───────────────────
        if (this.screen === 'loading') {
          if (data.status === 'result') {
            clearSession()
            this.screen = 'home'
          } else if (data.status === 'game') {
            // movieWord/language/hint already set by the movie-sync block above
            // Explicitly set here too so guesser (who has no movieWord in session) always gets it
            if (data.movieWord) this.movieWord = data.movieWord
            const letters = data.guessedLetters ? data.guessedLetters.split(',').filter(Boolean) : []
            this.guessedLetters = letters
            this.lives = data.lives ?? MAX_LIVES
            this.winner = null
            this.timer = MAX_TIMER
            this.timerActive = this.onlineRole === 'guesser'
            this.revealUsed = false
            this.screen = 'game'
          } else if (data.status === 'joined') {
            // Rematch pending (play-again was clicked) — drive to role-select or join-waiting
            if (this.isCreator) {
              this.pendingOnlineStep = data.joinerPresent ? 'role-select' : 'create-waiting'
            } else {
              this.pendingOnlineStep = 'join-waiting'
            }
            this.screen = 'online'
          } else {
            // roles_set or movie_ready — return to lobby
            this.screen = 'online'
          }
          return // skip fresh-navigation and sync blocks on first restore fire
        }

        // ── Fresh navigation to game ──────────────────────────────────────
        if (data.status === 'game' && this.screen !== 'game') {
          this.guessedLetters = []
          this.lives = MAX_LIVES
          this.winner = null
          this.timer = MAX_TIMER
          this.timerActive = this.onlineRole === 'guesser'
          this.revealUsed = false
          this.screen = 'game'
        }

        // ── Real-time game state sync ─────────────────────────────────────
        if (data.status === 'game' || data.status === 'result') {
          const letters = data.guessedLetters ? data.guessedLetters.split(',').filter(Boolean) : []
          if (letters.join(',') !== this.guessedLetters.join(',')) this.guessedLetters = letters
          if (data.lives !== this.lives) this.lives = data.lives
          if (data.winner && !this.winner) this.winner = data.winner
          if (data.hint !== undefined && !this.hint) this.hint = data.hint || ''
        }

        // ── Game over ─────────────────────────────────────────────────────
        if (data.status === 'result' && this.screen === 'game') {
          this.timerActive = false
          if (data.winner) this.winner = data.winner
          setTimeout(() => { this.screen = 'result' }, 700)
        }
      })
    },

    leaveRoom() {
      if (_unsubRoom) { _unsubRoom(); _unsubRoom = null }
      if (this.roomCode) {
        if (this.isCreator) {
          remove(dbRef(db, `rooms/${this.roomCode}`))
        } else {
          update(dbRef(db, `rooms/${this.roomCode}`), { joinerPresent: false })
        }
      }
      clearSession()
      this.roomCode = ''
      this.onlineRole = null
      this.isCreator = false
      this.opponentConnected = false
      this.movieLocked = false
      this.opponentPresent = false
    },

    async rejoinRoom(code, isCreator, role) {
      const snap = await get(dbRef(db, `rooms/${code}`))
      if (!snap.exists()) throw new Error('Room not found')
      const data = snap.val()
      if (data.status === 'result') throw new Error('Game already ended')

      this.mode = 'online'
      this.isCreator = isCreator
      this.roomCode = code
      this.onlineRole = role || null
      this.movieLocked = false
      this.opponentConnected = false
      this.movieWord = ''
      this.guessedLetters = []
      this.lives = MAX_LIVES

      if (isCreator) {
        update(dbRef(db, `rooms/${code}`), { creatorPresent: true })
        onDisconnect(dbRef(db, `rooms/${code}/creatorPresent`)).set(false)
      } else {
        update(dbRef(db, `rooms/${code}`), { joinerPresent: true })
        onDisconnect(dbRef(db, `rooms/${code}/joinerPresent`)).set(false)
      }

      saveSession({ roomCode: code, isCreator, onlineRole: role })
      this._subscribeOnline(code)
      return data.status
    },

    async resumeSession() {
      // ── Local (bot / passplay) ─────────────────────────────────────────
      // State was already restored synchronously in state() — no flash.
      // Here we just validate and activate timers/bot.
      if (this.mode && this.mode !== 'online' && this.movieWord) {
        // Discard session if game was somehow already over (prevents false wins on restore)
        if (this.isGameWon || this.isGameLost) {
          clearLocalSession()
          this.screen = 'home'
          this.mode = null
          this.movieWord = ''
          this.guessedLetters = []
          this.lives = MAX_LIVES
          return false
        }
        this.timerActive = this.playerIsGuessing
        if (this.mode === 'bot' && this.botSubMode === 'bot-guesses') {
          this._startBot()
        }
        return true
      }

      // ── Online ─────────────────────────────────────────────────────────
      // screen === 'loading' is set in state() when cg_session exists
      if (this.screen !== 'loading') return false
      const session = getSession()
      if (!session?.roomCode) { this.screen = 'home'; return false }
      try {
        const snap = await get(dbRef(db, `rooms/${session.roomCode}`))
        if (!snap.exists()) { clearSession(); this.screen = 'home'; return false }
        const data = snap.val()
        if (!['joined', 'roles_set', 'movie_ready', 'game'].includes(data.status)) {
          clearSession(); this.screen = 'home'; return false
        }
        this.mode = 'online'
        this.isCreator = session.isCreator
        this.roomCode = session.roomCode
        // Re-register presence so opponent sees us as reconnected
        if (session.isCreator) {
          update(dbRef(db, `rooms/${session.roomCode}`), { creatorPresent: true })
          onDisconnect(dbRef(db, `rooms/${session.roomCode}/creatorPresent`)).set(false)
        } else {
          update(dbRef(db, `rooms/${session.roomCode}`), { joinerPresent: true })
          onDisconnect(dbRef(db, `rooms/${session.roomCode}/joinerPresent`)).set(false)
        }
        // Resolve onlineRole from session or Firebase
        if (session.onlineRole) {
          this.onlineRole = session.onlineRole
        } else if (data.creatorRole) {
          this.onlineRole = session.isCreator
            ? data.creatorRole
            : (data.creatorRole === 'guesser' ? 'setter' : 'guesser')
          saveSession({ roomCode: session.roomCode, isCreator: session.isCreator, onlineRole: this.onlineRole })
        }
        // _subscribeOnline handles all screen transitions — keeps 'loading' visible
        // until Firebase fires, then restores the correct state (prevents flash of
        // zeroed values for the guesser who has no movieWord in their session)
        this._subscribeOnline(session.roomCode)
        return true
      } catch {
        // Don't clear the session on network error so a refresh can retry.
        this.screen = 'home'
        return false
      }
    },

    // ── End online ──────────────────────────────────────────────────────────

    playAgainFresh() {
      clearLocalSession()
      this._stopBot()
      this.round = 1
      this.setterPlayer = 1
      this.selectedLanguage = null
      this.hint = ''
      this.setupVersion++
      this.screen = 'setup'
      setTimeout(() => {
        this.scores = { p1: 0, p2: 0 }
        this.isFinalResult = false
      }, 300)
    },

    goHome() {
      clearLocalSession()
      this._stopBot()
      this.leaveRoom()
      this.screen = 'home'
      this.mode = null
      this.botSubMode = null
      this.selectedLanguage = null
      this.movieWord = ''
      this.hint = ''
      this.guessedLetters = []
      this.lives = MAX_LIVES
      this.round = 1
      this.setterPlayer = 1
      this.scores = { p1: 0, p2: 0 }
      this.winner = null
      this.isFinalResult = false
      this.isBotGuessing = false
      this.lastBotGuess = ''
      this.timer = MAX_TIMER
      this.timerActive = false
      this.revealUsed = false
      this.onlineRole = null
      this.roomCode = ''
      this.opponentConnected = false
      this.opponentPresent = false
      this.pendingOnlineStep = null
    },
  },
})
