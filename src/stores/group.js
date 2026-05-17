import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../firebase.js'
import { ref as dbRef, set, get, update, onValue, off, push } from 'firebase/database'

const LIVES = 6
const ROUND_SECS = 120
const SCORECARD_SECS = 30

function mkCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join('')
}
function mkId() {
  return Math.random().toString(36).slice(2, 11)
}

export const useGroupStore = defineStore('group', () => {
  const myId = ref(null)
  const myName = ref('')
  const roomCode = ref('')
  const isHost = ref(false)
  const totalRounds = ref(3)

  const status = ref('idle') // idle | lobby | setting | guessing | scoreboard | ended
  const players = ref({})   // { id: { name, totalScore, joinedAt } }
  const setterOrder = ref([])
  const currentRound = ref(0)
  const currentSetterId = ref('')
  const currentMovie = ref('')
  const roundPhase = ref('')  // waiting | active | ended
  const roundStartedAt = ref(null)
  const boards = ref({})      // { id: { guessedLetters, lives, status, completedAt, roundScore } }
  const notifications = ref([])
  const roundTimer = ref(ROUND_SECS)
  const scorecardTimer = ref(SCORECARD_SECS)

  let _timerInterval = null
  let _scorecardInterval = null
  let _subscribedCode = null
  let _endingRound = false
  let _skippingToNextSetter = false

  // ── Computed ──────────────────────────────────────────────────────────────
  const isSetter = computed(() => currentSetterId.value === myId.value)
  const myBoard = computed(() => boards.value[myId.value] ?? null)
  const playerList = computed(() =>
    Object.entries(players.value)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => a.joinedAt - b.joinedAt)
  )
  const currentSetterName = computed(() => players.value[currentSetterId.value]?.name ?? '')

  // ── Room creation ─────────────────────────────────────────────────────────
  async function createRoom(username, rounds) {
    myId.value = mkId()
    myName.value = username
    const code = mkCode()

    await set(dbRef(db, `groupRooms/${code}`), {
      host: myId.value,
      rounds,
      status: 'lobby',
      currentRound: 0,
      setterOrder: [],
      players: { [myId.value]: { name: username, totalScore: 0, joinedAt: Date.now() } },
    })

    roomCode.value = code
    isHost.value = true
    totalRounds.value = rounds
    _subscribe(code)
    return code
  }

  async function joinRoom(code, username) {
    const snap = await get(dbRef(db, `groupRooms/${code}`))
    if (!snap.exists()) throw new Error('Room not found')
    const data = snap.val()
    if (data.status !== 'lobby') throw new Error('Game already started')
    if (Object.keys(data.players || {}).length >= 6) throw new Error('Room is full (max 6 players)')

    myId.value = mkId()
    myName.value = username
    roomCode.value = code
    isHost.value = false
    totalRounds.value = data.rounds

    await set(dbRef(db, `groupRooms/${code}/players/${myId.value}`), {
      name: username, totalScore: 0, joinedAt: Date.now(),
    })

    _subscribe(code)
  }

  // ── Firebase listener ─────────────────────────────────────────────────────
  function _subscribe(code) {
    _subscribedCode = code
    onValue(dbRef(db, `groupRooms/${code}`), (snap) => {
      if (!snap.exists()) return
      const d = snap.val()

      players.value = d.players || {}
      status.value = d.status
      totalRounds.value = d.rounds
      currentRound.value = d.currentRound || 0
      setterOrder.value = d.setterOrder || []

      if (d.currentRound && d.roundData?.[d.currentRound]) {
        const rd = d.roundData[d.currentRound]
        currentSetterId.value = rd.setterId || ''
        roundPhase.value = rd.phase || ''
        roundStartedAt.value = rd.startedAt || null
        currentMovie.value = rd.movie || ''
        boards.value = rd.boards || {}

        notifications.value = Object.values(rd.notifications || {})
          .sort((a, b) => a.timestamp - b.timestamp)

        if (rd.phase === 'active' && !_timerInterval && rd.startedAt) {
          _startRoundTimer(rd.startedAt)
        }
      }

      if (d.status === 'scoreboard' && !_scorecardInterval) {
        _startScorecardTimer()
      }

      // Host detects when all boards are done and ends the round
      if (isHost.value && d.status === 'guessing') {
        const rd = d.roundData?.[d.currentRound]
        if (rd?.phase === 'active' && !_endingRound) {
          const bds = rd.boards || {}
          const allDone = Object.keys(bds).length > 0 &&
            Object.values(bds).every(b => b.status !== 'playing')
          if (allDone) _endRound(d.currentRound, bds, rd.startedAt)
        }
      }

      // Host detects when assigned setter has left during 'setting' phase
      if (isHost.value && d.status === 'setting' && d.currentRound && !_skippingToNextSetter) {
        const rd = d.roundData?.[d.currentRound]
        if (rd?.phase === 'waiting' && rd.setterId && !d.players?.[rd.setterId]) {
          _skipToNextSetter(d.currentRound)
        }
      }
    })
  }

  // ── Host: start game ──────────────────────────────────────────────────────
  async function startGame() {
    const order = playerList.value.map(p => p.id)
    const setterId = order[0]
    const roundBoards = {}
    order.forEach(id => {
      if (id !== setterId) {
        roundBoards[id] = { guessedLetters: [], lives: LIVES, status: 'playing', completedAt: null, roundScore: 0 }
      }
    })

    await update(dbRef(db, `groupRooms/${roomCode.value}`), {
      status: 'setting',
      currentRound: 1,
      setterOrder: order,
      'roundData/1': {
        setterId,
        setterName: players.value[setterId]?.name || '',
        movie: '',
        phase: 'waiting',
        startedAt: null,
        endedAt: null,
        boards: roundBoards,
        notifications: {},
      },
    })
  }

  // ── Setter: lock movie ────────────────────────────────────────────────────
  async function lockMovie(word) {
    const now = Date.now()
    const rn = currentRound.value
    await update(dbRef(db, `groupRooms/${roomCode.value}/roundData/${rn}`), {
      movie: word.toUpperCase(),
      phase: 'active',
      startedAt: now,
    })
    await update(dbRef(db, `groupRooms/${roomCode.value}`), { status: 'guessing' })
  }

  // ── Guesser: guess letter ─────────────────────────────────────────────────
  async function guessLetter(letter) {
    if (!myBoard.value || myBoard.value.status !== 'playing') return
    const movie = currentMovie.value
    if (!movie) return

    const board = myBoard.value
    const prevGuessed = board.guessedLetters || []
    if (prevGuessed.includes(letter)) return

    const guessedLetters = [...prevGuessed, letter]
    const isCorrect = movie.includes(letter)
    const newLives = isCorrect ? board.lives : board.lives - 1

    const movieLetters = movie.replace(/[^A-Z]/g, '')
    const allRevealed = movieLetters.split('').every(c => guessedLetters.includes(c))
    const newStatus = allRevealed ? 'won' : (newLives <= 0 ? 'out' : 'playing')
    const completedAt = allRevealed ? Date.now() : null

    const prevPct = Math.round(
      (movieLetters.split('').filter(c => prevGuessed.includes(c)).length / movieLetters.length) * 100
    )
    const newPct = Math.round(
      (movieLetters.split('').filter(c => guessedLetters.includes(c)).length / movieLetters.length) * 100
    )

    const rn = currentRound.value
    await update(dbRef(db, `groupRooms/${roomCode.value}/roundData/${rn}/boards/${myId.value}`), {
      guessedLetters,
      lives: newLives,
      status: newStatus,
      completedAt,
      roundScore: 0,
    })

    await _fireNotification(rn, isCorrect, newPct, prevPct, newLives, newStatus)
  }

  async function _fireNotification(rn, isCorrect, pct, prevPct, lives, status) {
    let notif = null
    const name = myName.value
    const ts = Date.now()

    if (status === 'won') {
      notif = { type: 'won', playerName: name, data: {}, timestamp: ts }
    } else if (status === 'out') {
      notif = { type: 'out', playerName: name, data: {}, timestamp: ts }
    } else if (!isCorrect && lives <= 2) {
      notif = { type: 'lives', playerName: name, data: { lives }, timestamp: ts }
    } else if (isCorrect) {
      const hit = [25, 50, 75].find(m => prevPct < m && pct >= m)
      if (hit) notif = { type: 'progress', playerName: name, data: { pct: hit }, timestamp: ts }
    }

    if (notif) {
      await push(dbRef(db, `groupRooms/${roomCode.value}/roundData/${rn}/notifications`), notif)
    }
  }

  // ── Round timer ───────────────────────────────────────────────────────────
  function _startRoundTimer(startedAt) {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      roundTimer.value = Math.max(0, ROUND_SECS - elapsed)
      if (roundTimer.value <= 0 && isHost.value && roundPhase.value === 'active' && !_endingRound) {
        clearInterval(_timerInterval)
        _timerInterval = null
        _forceEndRound()
      }
    }
    tick()
    _timerInterval = setInterval(tick, 1000)
  }

  async function _forceEndRound() {
    const rn = currentRound.value
    const snap = await get(dbRef(db, `groupRooms/${roomCode.value}/roundData/${rn}/boards`))
    if (!snap.exists()) return
    const bds = snap.val()
    const updates = {}
    Object.entries(bds).forEach(([id, b]) => {
      if (b.status === 'playing') updates[`roundData/${rn}/boards/${id}/status`] = 'out'
    })
    if (Object.keys(updates).length) {
      await update(dbRef(db, `groupRooms/${roomCode.value}`), updates)
    }
    const updatedBds = { ...bds }
    Object.keys(updates).forEach(k => {
      const id = k.split('/')[2]
      updatedBds[id] = { ...updatedBds[id], status: 'out' }
    })
    await _endRound(rn, updatedBds, roundStartedAt.value)
  }

  async function _endRound(rn, bds, startedAt) {
    if (_endingRound) return
    _endingRound = true

    // Guard: check phase hasn't already been set to ended
    const phaseSnap = await get(dbRef(db, `groupRooms/${roomCode.value}/roundData/${rn}/phase`))
    if (phaseSnap.val() === 'ended') { _endingRound = false; return }

    const now = Date.now()
    const updates = {
      [`roundData/${rn}/phase`]: 'ended',
      [`roundData/${rn}/endedAt`]: now,
      status: 'scoreboard',
    }

    Object.entries(bds).forEach(([id, b]) => {
      if (b.status === 'won' && b.completedAt && startedAt) {
        const secs = Math.floor((b.completedAt - startedAt) / 1000)
        const timeBonus = Math.max(0, ROUND_SECS - secs)
        const livesBonus = (b.lives || 0) * 15
        const score = 200 + timeBonus + livesBonus
        updates[`roundData/${rn}/boards/${id}/roundScore`] = score
        updates[`players/${id}/totalScore`] = (players.value[id]?.totalScore || 0) + score
      }
    })

    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null }
    await update(dbRef(db, `groupRooms/${roomCode.value}`), updates)
    setTimeout(() => { _endingRound = false }, 6000)
  }

  // ── Scoreboard countdown ──────────────────────────────────────────────────
  function _startScorecardTimer() {
    if (_scorecardInterval) { clearInterval(_scorecardInterval); _scorecardInterval = null }
    scorecardTimer.value = SCORECARD_SECS
    _scorecardInterval = setInterval(async () => {
      scorecardTimer.value--
      if (scorecardTimer.value <= 0) {
        clearInterval(_scorecardInterval)
        _scorecardInterval = null
        if (isHost.value) await _advanceRound()
      }
    }, 1000)
  }

  async function _advanceRound() {
    const next = currentRound.value + 1
    if (next > totalRounds.value) {
      await update(dbRef(db, `groupRooms/${roomCode.value}`), { status: 'ended' })
      return
    }

    const setterIdx = (next - 1) % setterOrder.value.length
    const setterId = setterOrder.value[setterIdx]
    const roundBoards = {}
    setterOrder.value.forEach(id => {
      if (id !== setterId) {
        roundBoards[id] = { guessedLetters: [], lives: LIVES, status: 'playing', completedAt: null, roundScore: 0 }
      }
    })

    await update(dbRef(db, `groupRooms/${roomCode.value}`), {
      status: 'setting',
      currentRound: next,
      [`roundData/${next}`]: {
        setterId,
        setterName: players.value[setterId]?.name || '',
        movie: '',
        phase: 'waiting',
        startedAt: null,
        endedAt: null,
        boards: roundBoards,
        notifications: {},
      },
    })
  }

  // ── Skip to next setter when current setter leaves ────────────────────────
  async function _skipToNextSetter(rn) {
    _skippingToNextSetter = true
    try {
      const order = setterOrder.value
      const currentIdx = order.indexOf(currentSetterId.value)
      const remaining = Object.keys(players.value)

      let nextSetter = null
      for (let i = 1; i <= order.length; i++) {
        const candidate = order[(currentIdx + i) % order.length]
        if (remaining.includes(candidate)) { nextSetter = candidate; break }
      }

      if (!nextSetter || remaining.length < 2) {
        await update(dbRef(db, `groupRooms/${roomCode.value}`), { status: 'ended' })
        return
      }

      // Change setter; remove new setter's old guesser board if they had one
      const updates = {
        [`roundData/${rn}/setterId`]: nextSetter,
        [`roundData/${rn}/setterName`]: players.value[nextSetter]?.name || '',
        [`roundData/${rn}/boards/${nextSetter}`]: null,
      }
      await update(dbRef(db, `groupRooms/${roomCode.value}`), updates)
    } finally {
      setTimeout(() => { _skippingToNextSetter = false }, 3000)
    }
  }

  // ── Leave / reset ─────────────────────────────────────────────────────────
  function leaveRoom() {
    const code = _subscribedCode
    const pid = myId.value
    const rn = currentRound.value
    const curStatus = status.value
    const curPhase = roundPhase.value
    const board = myBoard.value

    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null }
    if (_scorecardInterval) { clearInterval(_scorecardInterval); _scorecardInterval = null }
    if (code) { off(dbRef(db, `groupRooms/${code}`)); _subscribedCode = null }
    _endingRound = false; _skippingToNextSetter = false

    myId.value = null; myName.value = ''; roomCode.value = ''; isHost.value = false
    totalRounds.value = 3; status.value = 'idle'; players.value = {}
    setterOrder.value = []; currentRound.value = 0; currentSetterId.value = ''
    currentMovie.value = ''; roundPhase.value = ''; roundStartedAt.value = null
    boards.value = {}; notifications.value = []
    roundTimer.value = ROUND_SECS; scorecardTimer.value = SCORECARD_SECS

    // Fire-and-forget: remove player from room and mark board out if mid-game
    if (code && pid) {
      const updates = { [`players/${pid}`]: null }
      if (curStatus === 'guessing' && curPhase === 'active' && board?.status === 'playing') {
        updates[`roundData/${rn}/boards/${pid}/status`] = 'out'
      }
      update(dbRef(db, `groupRooms/${code}`), updates).catch(() => {})
    }
  }

  return {
    myId, myName, roomCode, isHost, totalRounds, status, players, setterOrder,
    currentRound, currentSetterId, currentMovie, roundPhase, roundStartedAt,
    boards, notifications, roundTimer, scorecardTimer,
    isSetter, myBoard, playerList, currentSetterName,
    createRoom, joinRoom, startGame, lockMovie, guessLetter, leaveRoom,
  }
})
