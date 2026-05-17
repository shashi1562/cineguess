<template>
  <div class="group-screen">

    <!-- ── MENU ─────────────────────────────────────────────────────────── -->
    <div v-if="step === 'menu'" class="section">
      <button class="back-btn" @click="goHome">← Home</button>
      <div class="hero">
        <div class="hero-icon">🎭</div>
        <h2>Group Play</h2>
        <p>Up to 6 players. One sets the movie — everyone guesses on their own board.</p>
      </div>
      <div class="choices">
        <button class="choice-card" @click="step = 'setup-create'">
          <span class="choice-icon">🏠</span>
          <div class="choice-text">
            <strong>Create Room</strong>
            <p>Host a game and invite up to 5 friends</p>
          </div>
        </button>
        <button class="choice-card" @click="step = 'setup-join'">
          <span class="choice-icon">🔗</span>
          <div class="choice-text">
            <strong>Join Room</strong>
            <p>Enter a room code to join a friend's game</p>
          </div>
        </button>
      </div>
    </div>

    <!-- ── SETUP: CREATE ────────────────────────────────────────────────── -->
    <div v-else-if="step === 'setup-create'" class="section">
      <button class="back-btn" @click="step = 'menu'">← Back</button>
      <div class="hero">
        <div class="hero-icon">🏠</div>
        <h2>Create Room</h2>
      </div>
      <form class="setup-form" @submit.prevent="doCreate">
        <label class="field-label">Your name</label>
        <input v-model="username" class="field-input" placeholder="Enter your name" maxlength="20"
          autocomplete="off" spellcheck="false" @input="createError = ''" />

        <label class="field-label">Number of rounds</label>
        <div class="rounds-row">
          <button type="button" class="round-btn" :disabled="rounds <= 1" @click="rounds--">−</button>
          <span class="rounds-val">{{ rounds }}</span>
          <button type="button" class="round-btn" :disabled="rounds >= 10" @click="rounds++">+</button>
        </div>

        <p v-if="createError" class="error-msg">{{ createError }}</p>
        <button type="submit" class="btn-primary" :disabled="!username.trim() || creating">
          {{ creating ? 'Creating…' : 'Create Room →' }}
        </button>
      </form>
    </div>

    <!-- ── SETUP: JOIN ───────────────────────────────────────────────────── -->
    <div v-else-if="step === 'setup-join'" class="section">
      <button class="back-btn" @click="step = 'menu'">← Back</button>
      <div class="hero">
        <div class="hero-icon">🔗</div>
        <h2>Join Room</h2>
      </div>
      <form class="setup-form" @submit.prevent="doJoin">
        <label class="field-label">Your name</label>
        <input v-model="username" class="field-input" placeholder="Enter your name" maxlength="20"
          autocomplete="off" spellcheck="false" @input="joinError = ''" />

        <label class="field-label">Room code</label>
        <input v-model="joinCode" class="code-input" placeholder="e.g. K7X2QP" maxlength="6"
          autocomplete="off" spellcheck="false"
          @input="joinCode = joinCode.toUpperCase().replace(/[^A-Z0-9]/g, ''); joinError = ''" />

        <p v-if="joinError" class="error-msg">{{ joinError }}</p>
        <button type="submit" class="btn-primary"
          :disabled="!username.trim() || joinCode.length < 6 || joining">
          {{ joining ? 'Joining…' : 'Join Room →' }}
        </button>
      </form>
    </div>

    <!-- ── LOBBY ─────────────────────────────────────────────────────────── -->
    <div v-else-if="step === 'lobby'" class="section">
      <button class="back-btn" @click="goHome">← Leave</button>
      <div class="lobby-top">
        <div class="hero-icon">🎭</div>
        <h2>Room Lobby</h2>
        <div class="code-display">
          <span class="code-label">Room code</span>
          <div class="code-chars">
            <span v-for="(ch, i) in gStore.roomCode" :key="i" class="code-char">{{ ch }}</span>
          </div>
          <button class="copy-btn" @click="copyCode">{{ copied ? '✅ Copied!' : '📋 Copy' }}</button>
        </div>
      </div>

      <div class="player-list">
        <div class="player-list-header">
          <span>Players ({{ gStore.playerList.length }}/6)</span>
          <span v-if="gStore.isHost" class="rounds-info">{{ gStore.totalRounds }} round{{ gStore.totalRounds > 1 ? 's' : '' }}</span>
        </div>
        <div v-for="p in gStore.playerList" :key="p.id" class="player-row">
          <span class="player-dot" :style="{ background: playerColor(p.id) }"></span>
          <span class="player-name">{{ p.name }}</span>
          <span v-if="p.id === gStore.myId" class="you-badge">You</span>
          <span v-if="p.id === gStore.playerList[0]?.id" class="host-badge">Host</span>
        </div>
      </div>

      <div v-if="gStore.isHost" class="host-actions">
        <p class="hint-text">{{ gStore.playerList.length < 2 ? 'Waiting for at least 1 more player to join…' : 'Ready! Start the game when everyone is here.' }}</p>
        <button class="btn-primary" :disabled="gStore.playerList.length < 2" @click="doStart">
          Start Game →
        </button>
      </div>
      <div v-else class="center-msg">
        <div class="thinking-dots">
          <span class="dot" /><span class="dot" /><span class="dot" />
        </div>
        <p>Waiting for the host to start…</p>
      </div>
    </div>

    <!-- ── SETTER: ENTER MOVIE ────────────────────────────────────────────── -->
    <div v-else-if="step === 'setting'" class="section">
      <div class="round-bar">
        <span class="round-tag">Round {{ gStore.currentRound }} / {{ gStore.totalRounds }}</span>
        <span class="setter-tag">Your turn to set!</span>
      </div>
      <div class="hero">
        <div class="hero-icon">🎬</div>
        <h2>Pick a Movie</h2>
        <p>Others will guess it letter by letter on their own private board.</p>
      </div>
      <form class="setup-form" @submit.prevent="doLock">
        <div class="input-wrapper">
          <input ref="movieInputRef" v-model="movieInput" type="password"
            class="field-input movie-secret" placeholder="Type movie name here…"
            autocomplete="off" spellcheck="false" maxlength="60"
            @input="movieError = ''" />
          <div v-if="movieInput" class="char-dots">
            <span v-for="(c, i) in movieInput" :key="i" class="char-dot">
              {{ c === ' ' ? ' ' : '•' }}
            </span>
          </div>
        </div>
        <p v-if="movieError" class="error-msg">{{ movieError }}</p>
        <button type="submit" class="btn-primary" :disabled="!movieInput.trim() || locking">
          {{ locking ? 'Locking…' : 'Lock In Movie 🔒' }}
        </button>
      </form>
    </div>

    <!-- ── GUESSER: WAITING FOR MOVIE ────────────────────────────────────── -->
    <div v-else-if="step === 'wait-movie'" class="section center">
      <div class="lobby-card">
        <div class="hero-icon">🎬</div>
        <h2>Get Ready!</h2>
        <p><strong>{{ gStore.currentSetterName }}</strong> is picking a movie…</p>
        <div class="thinking-dots">
          <span class="dot" /><span class="dot" /><span class="dot" />
        </div>
        <button class="btn-link" @click="goHome">← Leave</button>
      </div>
    </div>

    <!-- ── SETTER: WATCHING ────────────────────────────────────────────────── -->
    <div v-else-if="step === 'setter-watch'" class="section">
      <div class="game-topbar">
        <span class="round-tag">Round {{ gStore.currentRound }} / {{ gStore.totalRounds }}</span>
        <span class="timer-tag" :class="gStore.roundTimer <= 20 ? 'timer-urgent' : ''">
          ⏱ {{ fmtTime(gStore.roundTimer) }}
        </span>
      </div>
      <div class="watch-movie-label">You set: <strong>{{ gStore.currentMovie }}</strong></div>

      <!-- Notifications feed -->
      <div class="notif-feed">
        <div v-for="n in recentNotifs" :key="n.timestamp" class="notif-item" :class="`notif-${n.type}`">
          {{ notifText(n) }}
        </div>
        <div v-if="!gStore.notifications.length" class="notif-empty">Waiting for guesses…</div>
      </div>

      <!-- Live player boards -->
      <div class="watch-boards">
        <div v-for="pb in watchBoards" :key="pb.id" class="watch-card" :class="`ws-${pb.status}`">
          <div class="wc-header">
            <span class="wc-name">{{ pb.name }}</span>
            <span class="wc-status-badge">{{ statusLabel(pb.status) }}</span>
          </div>
          <div class="wc-hearts">
            <span v-for="i in 6" :key="i" class="wc-heart">{{ i <= pb.lives ? '❤️' : '🖤' }}</span>
          </div>
          <div class="wc-progress-bar">
            <div class="wc-progress-fill" :style="{ width: pb.pct + '%' }" :class="`wp-${pb.status}`"></div>
          </div>
          <span class="wc-pct">{{ pb.pct }}%</span>
        </div>
      </div>
    </div>

    <!-- ── GUESSING ────────────────────────────────────────────────────────── -->
    <div v-else-if="step === 'guessing'" class="section guessing-section">
      <!-- Toast notification -->
      <Transition name="toast">
        <div v-if="activeToast" class="toast" :class="`toast-${activeToast.type}`">
          {{ notifText(activeToast) }}
        </div>
      </Transition>

      <!-- Top bar -->
      <div class="game-topbar">
        <span class="round-tag">Round {{ gStore.currentRound }} / {{ gStore.totalRounds }}</span>
        <span class="timer-tag" :class="gStore.roundTimer <= 20 ? 'timer-urgent' : ''">
          ⏱ {{ fmtTime(gStore.roundTimer) }}
        </span>
      </div>
      <div class="setter-label">Movie by <strong>{{ gStore.currentSetterName }}</strong></div>

      <!-- Word display -->
      <div class="word-area">
        <div v-for="(word, wi) in wordDisplay" :key="wi" class="word-group">
          <div v-for="(cell, ci) in word" :key="ci" class="letter-cell"
            :class="cell.shown && cell.isLetter ? 'cell-revealed' : ''">
            <span v-if="!cell.isLetter">{{ cell.letter }}</span>
            <span v-else-if="cell.shown">{{ cell.letter }}</span>
            <span v-else class="blank">_</span>
          </div>
        </div>
      </div>

      <!-- Lives -->
      <div class="lives-row">
        <span v-for="i in 6" :key="i" class="heart">{{ i <= (gStore.myBoard?.lives ?? 6) ? '❤️' : '🖤' }}</span>
      </div>

      <!-- Status overlay when out or won -->
      <div v-if="gStore.myBoard?.status === 'won'" class="status-banner banner-won">
        You cracked it! Waiting for others…
      </div>
      <div v-else-if="gStore.myBoard?.status === 'out'" class="status-banner banner-out">
        Out of lives! Watching others…
      </div>

      <!-- Keyboard -->
      <div class="keyboard">
        <div v-for="(row, ri) in KEYS" :key="ri" class="key-row">
          <button v-for="l in row" :key="l"
            class="key" :class="keyClass(l)"
            :disabled="keyDisabled(l)"
            @click="handleGuess(l)">
            {{ l }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── SCOREBOARD ──────────────────────────────────────────────────────── -->
    <div v-else-if="step === 'scoreboard'" class="section">
      <div class="sb-header">
        <div class="sb-round">Round {{ gStore.currentRound }} / {{ gStore.totalRounds }}</div>
        <h2 class="sb-title">Round Complete!</h2>
        <div class="sb-movie">
          The movie was: <strong>{{ gStore.currentMovie }}</strong>
        </div>
        <div class="sb-setby">Set by {{ gStore.currentSetterName }}</div>
      </div>

      <div class="sb-table">
        <div class="sb-row sb-head">
          <span>Player</span><span>Result</span><span>Pts this round</span><span>Total</span>
        </div>
        <div v-for="(row, i) in scoreboardRows" :key="row.id"
          class="sb-row" :class="[i === 0 && row.roundScore > 0 ? 'sb-top' : '', `sb-${row.status}`]">
          <span class="sb-name">
            <span class="sb-rank">{{ i + 1 }}</span>
            {{ row.name }}
            <span v-if="row.id === gStore.myId" class="you-badge">You</span>
          </span>
          <span class="sb-result">{{ resultLabel(row) }}</span>
          <span class="sb-pts">{{ row.roundScore > 0 ? '+' + row.roundScore : '—' }}</span>
          <span class="sb-total">{{ row.totalScore }}</span>
        </div>
      </div>

      <div class="sb-countdown">
        <div class="sb-cd-bar" :style="{ width: (gStore.scorecardTimer / 45 * 100) + '%' }"></div>
        <span v-if="gStore.currentRound < gStore.totalRounds">
          Next round in {{ gStore.scorecardTimer }}s…
        </span>
        <span v-else>Game ending in {{ gStore.scorecardTimer }}s…</span>
      </div>
    </div>

    <!-- ── FINAL ───────────────────────────────────────────────────────────── -->
    <div v-else-if="step === 'final'" class="section center">
      <div class="final-card">
        <div class="hero-icon">🏆</div>
        <h2>Game Over!</h2>
        <div v-if="finalScores[0]" class="winner-banner">
          {{ finalScores[0].name }} wins!
        </div>
        <div class="final-table">
          <div v-for="(row, i) in finalScores" :key="row.id" class="final-row"
            :class="i === 0 ? 'final-first' : ''">
            <span class="final-place">{{ ['🥇','🥈','🥉'][i] || (i+1) + '.' }}</span>
            <span class="final-name">
              {{ row.name }}
              <span v-if="row.id === gStore.myId" class="you-badge">You</span>
            </span>
            <span class="final-pts">{{ row.totalScore }} pts</span>
          </div>
        </div>
        <button class="btn-primary" @click="goHome">← Back to Home</button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useGroupStore } from '../stores/group.js'
import { useGameStore } from '../stores/game.js'

const KEYS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M'],
]

const PLAYER_COLORS = ['#8b5cf6','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899']

const gStore = useGroupStore()
const gameStore = useGameStore()

// ── Form state ─────────────────────────────────────────────────────────────
const step = ref('menu')
const username = ref('')
const rounds = ref(3)
const joinCode = ref('')
const movieInput = ref('')
const movieInputRef = ref(null)
const movieError = ref('')
const createError = ref('')
const joinError = ref('')
const creating = ref(false)
const joining = ref(false)
const locking = ref(false)
const copied = ref(false)
const pendingLetters = ref(new Set())

// ── Toast system ───────────────────────────────────────────────────────────
const activeToast = ref(null)
const toastQueue = ref([])
const shownNotifIds = new Set()
let toastTimer = null

watch(() => gStore.notifications, (notifs) => {
  notifs.forEach(n => {
    const key = n.timestamp + n.playerName + n.type
    if (!shownNotifIds.has(key)) {
      shownNotifIds.add(key)
      toastQueue.value.push(n)
    }
  })
  if (!activeToast.value) _showNextToast()
}, { deep: true })

function _showNextToast() {
  if (!toastQueue.value.length) { activeToast.value = null; return }
  activeToast.value = toastQueue.value.shift()
  toastTimer = setTimeout(() => {
    activeToast.value = null
    _showNextToast()
  }, 3500)
}

// ── Step transitions via store state ────────────────────────────────────────
watch(() => gStore.status, (s) => {
  if (s === 'setting' && step.value === 'lobby') {
    step.value = gStore.isSetter ? 'setting' : 'wait-movie'
  }
  if (s === 'setting' && step.value === 'scoreboard') {
    shownNotifIds.clear(); toastQueue.value = []; activeToast.value = null
    step.value = gStore.isSetter ? 'setting' : 'wait-movie'
  }
  if (s === 'scoreboard') step.value = 'scoreboard'
  if (s === 'ended') step.value = 'final'
})

watch(() => gStore.roundPhase, (phase) => {
  if (phase === 'active') {
    if (gStore.isSetter) step.value = 'setter-watch'
    else step.value = 'guessing'
  }
})

// Focus movie input when entering setting step
watch(() => step.value, (s) => {
  if (s === 'setting') nextTick(() => movieInputRef.value?.focus())
})

// ── Computed ───────────────────────────────────────────────────────────────
const wordDisplay = computed(() => {
  const movie = gStore.currentMovie
  if (!movie) return []
  const guessed = gStore.myBoard?.guessedLetters || []
  return movie.split(' ').map(word =>
    word.split('').map(c => ({
      letter: c,
      shown: guessed.includes(c),
      isLetter: /[A-Z]/.test(c),
    }))
  )
})

const canGuess = computed(() =>
  gStore.myBoard?.status === 'playing' && gStore.roundPhase === 'active'
)

const watchBoards = computed(() =>
  gStore.playerList
    .filter(p => p.id !== gStore.myId)
    .map(p => {
      const board = gStore.boards[p.id] || {}
      const guessed = board.guessedLetters || []
      const ml = gStore.currentMovie.replace(/[^A-Z]/g, '')
      const pct = ml.length
        ? Math.round(ml.split('').filter(c => guessed.includes(c)).length / ml.length * 100)
        : 0
      return {
        id: p.id,
        name: p.name,
        lives: board.lives ?? 6,
        status: board.status || 'playing',
        pct,
      }
    })
)

const recentNotifs = computed(() =>
  [...gStore.notifications].reverse().slice(0, 5)
)

const scoreboardRows = computed(() => {
  const setter = gStore.currentSetterId
  return gStore.playerList
    .map(p => {
      const board = gStore.boards[p.id] || {}
      return {
        id: p.id,
        name: p.name,
        isSetter: p.id === setter,
        status: p.id === setter ? 'setter' : (board.status || 'out'),
        roundScore: board.roundScore || 0,
        totalScore: p.totalScore || 0,
        lives: board.lives || 0,
        completedAt: board.completedAt,
      }
    })
    .sort((a, b) => {
      if (a.isSetter) return 1
      if (b.isSetter) return -1
      return b.roundScore - a.roundScore
    })
})

const finalScores = computed(() =>
  gStore.playerList
    .map(p => ({ id: p.id, name: p.name, totalScore: p.totalScore || 0 }))
    .sort((a, b) => b.totalScore - a.totalScore)
)

// ── Helpers ────────────────────────────────────────────────────────────────
function playerColor(id) {
  const idx = gStore.playerList.findIndex(p => p.id === id)
  return PLAYER_COLORS[idx % PLAYER_COLORS.length]
}

function fmtTime(secs) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

function notifText(n) {
  const isSelf = n.playerName === gStore.myName
  const name = isSelf ? 'You' : n.playerName
  switch (n.type) {
    case 'progress': return `🎯 ${name} — ${n.data.pct}% revealed`
    case 'lives':    return `💔 ${name} — ${n.data.lives} ${n.data.lives === 1 ? 'life' : 'lives'} left`
    case 'out':      return isSelf ? `💀 You are out!` : `💀 ${name} is out!`
    case 'won':      return isSelf ? `✅ You cracked it!` : `✅ ${name} cracked it!`
    default:         return name
  }
}

function statusLabel(s) {
  if (s === 'playing') return '🟢 Playing'
  if (s === 'won') return '✅ Won'
  if (s === 'out') return '💀 Out'
  return s
}

function resultLabel(row) {
  if (row.isSetter) return '🎬 Set the movie'
  if (row.status === 'won') return '✅ Guessed!'
  if (row.status === 'out') return '💀 Eliminated'
  return '⏱ Time up'
}

function keyClass(l) {
  const board = gStore.myBoard
  if (!board) return ''
  const guessed = board.guessedLetters || []
  if (!guessed.includes(l)) return ''
  return gStore.currentMovie.includes(l) ? 'k-correct' : 'k-wrong'
}

function keyDisabled(l) {
  const guessed = gStore.myBoard?.guessedLetters || []
  return guessed.includes(l) || pendingLetters.value.has(l) || !canGuess.value
}

async function handleGuess(l) {
  if (keyDisabled(l)) return
  pendingLetters.value = new Set([...pendingLetters.value, l])
  await gStore.guessLetter(l)
  const next = new Set(pendingLetters.value)
  next.delete(l)
  pendingLetters.value = next
}

function copyCode() {
  navigator.clipboard?.writeText(gStore.roomCode)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function goHome() {
  if (toastTimer) clearTimeout(toastTimer)
  gStore.leaveRoom()
  gameStore.goHome()
}

// ── Actions ────────────────────────────────────────────────────────────────
async function doCreate() {
  if (!username.value.trim()) return
  creating.value = true
  createError.value = ''
  try {
    await gStore.createRoom(username.value.trim(), rounds.value)
    step.value = 'lobby'
  } catch (e) {
    createError.value = e.message || 'Failed to create room.'
  } finally {
    creating.value = false
  }
}

async function doJoin() {
  if (!username.value.trim() || joinCode.value.length < 6) return
  joining.value = true
  joinError.value = ''
  try {
    await gStore.joinRoom(joinCode.value, username.value.trim())
    step.value = 'lobby'
  } catch (e) {
    joinError.value = e.message || 'Failed to join room.'
  } finally {
    joining.value = false
  }
}

async function doStart() {
  await gStore.startGame()
}

async function doLock() {
  const val = movieInput.value.trim()
  if (!val || val.length < 2) { movieError.value = 'Movie name is too short'; return }
  if (!/[a-zA-Z]/.test(val)) { movieError.value = 'Must contain at least one letter'; return }
  locking.value = true
  try {
    await gStore.lockMovie(val)
    movieInput.value = ''
  } catch {
    movieError.value = 'Failed to lock movie. Check connection.'
  } finally {
    locking.value = false
  }
}
</script>

<style scoped>
.group-screen {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 1.5rem 0;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.section.center {
  align-items: center;
  justify-content: center;
  flex: 1;
}
.guessing-section { gap: 1rem; }

/* Back / nav */
.back-btn {
  background: none;
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 500;
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  align-self: flex-start;
  transition: all 0.2s;
}
.back-btn:hover { color: var(--text); border-color: var(--accent); }

/* Hero */
.hero { text-align: center; }
.hero-icon { font-size: 3rem; line-height: 1; margin-bottom: 0.5rem; }
.hero h2 { font-size: 1.35rem; font-weight: 700; margin-bottom: 0.3rem; }
.hero p { color: var(--text-muted); font-size: 0.88rem; }

/* Choice cards */
.choices { display: flex; flex-direction: column; gap: 0.85rem; }
.choice-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 1.25rem; display: flex; align-items: center; gap: 1rem;
  text-align: left; cursor: pointer; transition: all 0.18s; color: var(--text);
}
.choice-card:hover {
  border-color: var(--accent); background: rgba(139,92,246,0.07);
  transform: translateY(-2px); box-shadow: 0 6px 20px rgba(139,92,246,0.12);
}
.choice-icon { font-size: 2rem; flex-shrink: 0; }
.choice-text strong { display: block; font-weight: 700; font-size: 1rem; margin-bottom: 0.2rem; }
.choice-text p { font-size: 0.82rem; color: var(--text-muted); }

/* Setup form */
.setup-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field-label { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.field-input {
  width: 100%; background: var(--surface2); border: 2px solid var(--border);
  border-radius: var(--radius); color: var(--text); font-size: 1rem; font-weight: 500;
  padding: 0.75rem 1rem; transition: border-color 0.2s; font-family: inherit;
}
.field-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.field-input::placeholder { color: var(--text-dim); }

.movie-secret { letter-spacing: 0.25em; }
.input-wrapper { display: flex; flex-direction: column; gap: 0.4rem; }
.char-dots { display: flex; flex-wrap: wrap; gap: 3px; padding: 0 0.1rem; }
.char-dot { font-size: 1rem; color: var(--accent-light); width: 0.9rem; text-align: center; }

.code-input {
  width: 100%; background: var(--surface2); border: 2px solid var(--border);
  border-radius: var(--radius); color: var(--text); font-size: 1.8rem; font-weight: 900;
  padding: 0.7rem 1rem; text-align: center; letter-spacing: 0.3em;
  text-transform: uppercase; transition: border-color 0.2s; font-family: inherit;
}
.code-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.code-input::placeholder { color: var(--text-dim); font-weight: 400; font-size: 1.1rem; letter-spacing: 0.1em; }

.rounds-row { display: flex; align-items: center; gap: 1.2rem; }
.round-btn {
  width: 38px; height: 38px; border-radius: 50%; background: var(--surface2);
  border: 1px solid var(--border); color: var(--text); font-size: 1.3rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center; transition: all 0.15s;
}
.round-btn:not(:disabled):hover { border-color: var(--accent); background: rgba(139,92,246,0.1); }
.round-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.rounds-val { font-size: 1.5rem; font-weight: 800; color: var(--accent-light); min-width: 2rem; text-align: center; }

/* Lobby */
.lobby-top { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-align: center; }
.lobby-top h2 { font-size: 1.35rem; font-weight: 700; }
.code-display { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.code-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); font-weight: 600; }
.code-chars { display: flex; gap: 5px; }
.code-char {
  width: 38px; height: 50px; background: var(--surface2); border: 2px solid var(--accent);
  border-radius: 8px; display: flex; align-items: center; justify-content: center;
  font-size: 1.3rem; font-weight: 900; color: var(--accent-light);
}
.copy-btn {
  background: var(--surface2); border: 1px solid var(--border); color: var(--text-muted);
  font-size: 0.82rem; font-weight: 600; padding: 0.4rem 1rem; border-radius: var(--radius-sm);
  transition: all 0.2s; cursor: pointer;
}
.copy-btn:hover { border-color: var(--accent); color: var(--accent-light); }

.player-list { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.player-list-header {
  display: flex; justify-content: space-between; padding: 0.65rem 1rem;
  font-size: 0.75rem; font-weight: 600; color: var(--text-muted);
  border-bottom: 1px solid var(--border); text-transform: uppercase; letter-spacing: 0.05em;
}
.player-row {
  display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
}
.player-row:last-child { border-bottom: none; }
.player-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.player-name { flex: 1; font-size: 0.95rem; font-weight: 600; }
.you-badge, .host-badge {
  font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.5rem;
  border-radius: 50px; text-transform: uppercase; letter-spacing: 0.05em;
}
.you-badge { background: var(--accent-glow); border: 1px solid var(--accent); color: var(--accent-light); }
.host-badge { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.4); color: #fcd34d; }

.host-actions { display: flex; flex-direction: column; gap: 0.75rem; }
.hint-text { font-size: 0.83rem; color: var(--text-muted); text-align: center; }
.rounds-info { color: var(--accent-light); }

.center-msg { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }

/* Thinking dots */
.thinking-dots { display: flex; gap: 6px; align-items: center; justify-content: center; }
.dot { width: 8px; height: 8px; background: var(--accent); border-radius: 50%; animation: blink 1.2s ease infinite; }
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

/* Lobby card */
.lobby-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 2.25rem 2rem; text-align: center; display: flex; flex-direction: column;
  align-items: center; gap: 0.9rem; width: 100%; max-width: 400px;
}
.lobby-card h2 { font-size: 1.4rem; font-weight: 800; }
.lobby-card p { color: var(--text-muted); font-size: 0.9rem; }

/* Top bar (game views) */
.game-topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.5rem 0;
}
.round-tag {
  font-size: 0.75rem; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.round-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.5rem 0;
}
.setter-tag {
  font-size: 0.75rem; font-weight: 700; color: var(--accent-light);
  background: var(--accent-glow); padding: 0.2rem 0.65rem; border-radius: 50px;
  border: 1px solid var(--accent);
}
.timer-tag {
  font-size: 0.9rem; font-weight: 700; color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.timer-urgent { color: var(--wrong) !important; animation: pulse-timer 0.8s ease infinite; }
@keyframes pulse-timer { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

.setter-label, .watch-movie-label {
  font-size: 0.9rem; color: var(--text-muted); text-align: center;
}
.setter-label strong, .watch-movie-label strong { color: var(--text); }

/* Setter watch — notification feed */
.notif-feed {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem;
  max-height: 160px; overflow-y: auto;
}
.notif-item {
  font-size: 0.83rem; font-weight: 500; padding: 0.3rem 0.5rem;
  border-radius: var(--radius-sm); color: var(--text-muted);
}
.notif-won { color: var(--correct); background: rgba(34,197,94,0.08); }
.notif-out { color: var(--wrong); background: rgba(239,68,68,0.08); }
.notif-progress { color: var(--accent-light); background: var(--accent-glow); }
.notif-lives { color: #fcd34d; background: rgba(245,158,11,0.1); }
.notif-empty { font-size: 0.8rem; color: var(--text-dim); text-align: center; padding: 0.5rem; }

/* Setter watch — player boards */
.watch-boards { display: flex; flex-direction: column; gap: 0.65rem; }
.watch-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 0.85rem 1rem; display: flex; flex-direction: column; gap: 0.4rem;
}
.ws-won { border-color: var(--correct); }
.ws-out { opacity: 0.6; }
.wc-header { display: flex; justify-content: space-between; align-items: center; }
.wc-name { font-weight: 700; font-size: 0.95rem; }
.wc-status-badge { font-size: 0.72rem; }
.wc-hearts { display: flex; gap: 3px; font-size: 0.9rem; }
.wc-progress-bar {
  height: 6px; background: var(--surface2); border-radius: 50px; overflow: hidden;
}
.wc-progress-fill {
  height: 100%; background: var(--accent); border-radius: 50px; transition: width 0.4s;
}
.wp-won { background: var(--correct); }
.wp-out { background: var(--wrong); }
.wc-pct { font-size: 0.72rem; color: var(--text-muted); text-align: right; }

/* Toast */
.toast {
  position: fixed; top: 1rem; left: 50%; transform: translateX(-50%);
  z-index: 100; padding: 0.6rem 1.25rem; border-radius: 50px;
  font-size: 0.87rem; font-weight: 600; white-space: nowrap;
  background: var(--surface); border: 1px solid var(--border); color: var(--text);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.toast-won { background: rgba(34,197,94,0.15); border-color: var(--correct); color: var(--correct); }
.toast-out { background: rgba(239,68,68,0.1); border-color: var(--wrong); color: var(--wrong); }
.toast-progress { background: var(--accent-glow); border-color: var(--accent); color: var(--accent-light); }
.toast-lives { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.5); color: #fcd34d; }
.toast-enter-active { transition: all 0.25s ease; }
.toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
.toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }

/* Word display */
.word-area {
  display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center;
  padding: 0.5rem 0;
}
.word-group { display: flex; gap: 4px; }
.letter-cell {
  width: 28px; height: 36px; display: flex; align-items: center; justify-content: center;
  border-bottom: 2px solid var(--border); font-size: 1.1rem; font-weight: 700;
  color: var(--text); transition: all 0.2s;
}
.cell-revealed { border-color: var(--accent); color: var(--correct); }
.blank { color: var(--text-dim); font-size: 1.3rem; font-weight: 300; }

/* Lives */
.lives-row { display: flex; gap: 4px; justify-content: center; font-size: 1.2rem; }

/* Status banner */
.status-banner {
  text-align: center; padding: 0.6rem 1rem; border-radius: var(--radius);
  font-size: 0.88rem; font-weight: 600;
}
.banner-won { background: rgba(34,197,94,0.1); color: var(--correct); border: 1px solid rgba(34,197,94,0.3); }
.banner-out { background: rgba(239,68,68,0.08); color: var(--wrong); border: 1px solid rgba(239,68,68,0.25); }

/* Keyboard */
.keyboard { display: flex; flex-direction: column; gap: 6px; align-items: center; margin-top: auto; padding-top: 0.5rem; }
.key-row { display: flex; gap: 5px; }
.key {
  width: 31px; height: 42px; background: var(--surface2); border: 1px solid var(--border);
  border-radius: 6px; color: var(--text); font-size: 0.85rem; font-weight: 700;
  cursor: pointer; transition: all 0.12s; display: flex; align-items: center; justify-content: center;
}
.key:not(:disabled):hover { border-color: var(--accent); background: rgba(139,92,246,0.1); }
.key:disabled { opacity: 0.4; cursor: not-allowed; }
.k-correct { background: rgba(34,197,94,0.2) !important; border-color: var(--correct) !important; color: var(--correct) !important; opacity: 1 !important; }
.k-wrong { background: rgba(239,68,68,0.12) !important; border-color: rgba(239,68,68,0.3) !important; color: var(--wrong) !important; opacity: 0.6 !important; }

/* Scoreboard */
.sb-header { text-align: center; display: flex; flex-direction: column; gap: 0.35rem; }
.sb-round { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
.sb-title { font-size: 1.5rem; font-weight: 800; }
.sb-movie { font-size: 0.95rem; color: var(--text-muted); }
.sb-movie strong { color: var(--accent-light); }
.sb-setby { font-size: 0.8rem; color: var(--text-dim); }

.sb-table { display: flex; flex-direction: column; gap: 3px; }
.sb-head { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); padding: 0 0.75rem; }
.sb-row { display: grid; grid-template-columns: 1fr auto auto auto; gap: 0.75rem; align-items: center; padding: 0.65rem 0.75rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.sb-top { border-color: var(--correct); background: rgba(34,197,94,0.06); }
.sb-name { font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem; }
.sb-rank { font-size: 0.72rem; color: var(--text-dim); min-width: 1.2rem; }
.sb-result { font-size: 0.8rem; color: var(--text-muted); }
.sb-pts { font-weight: 700; font-size: 0.9rem; color: var(--correct); text-align: right; }
.sb-total { font-size: 0.85rem; font-weight: 700; color: var(--accent-light); text-align: right; }

.sb-countdown {
  position: relative; height: 36px; background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.sb-cd-bar { position: absolute; left: 0; top: 0; height: 100%; background: var(--accent-glow); transition: width 1s linear; }
.sb-countdown span { position: relative; z-index: 1; font-size: 0.82rem; font-weight: 600; color: var(--text-muted); }

/* Final */
.final-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 2.5rem 2rem; width: 100%; max-width: 420px;
  display: flex; flex-direction: column; align-items: center; gap: 1.25rem; text-align: center;
}
.final-card h2 { font-size: 1.6rem; font-weight: 800; }
.winner-banner {
  background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.4);
  color: #fcd34d; font-size: 1rem; font-weight: 700; padding: 0.5rem 1.5rem;
  border-radius: 50px;
}
.final-table { width: 100%; display: flex; flex-direction: column; gap: 4px; }
.final-row {
  display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem;
  background: var(--surface2); border-radius: var(--radius-sm);
}
.final-first { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); }
.final-place { font-size: 1.1rem; flex-shrink: 0; }
.final-name { flex: 1; font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem; }
.final-pts { font-weight: 700; font-size: 0.9rem; color: var(--accent-light); }

/* Shared */
.btn-primary {
  width: 100%; padding: 0.9rem; background: var(--accent); color: white;
  border-radius: var(--radius); font-size: 1rem; font-weight: 700;
  cursor: pointer; transition: all 0.2s;
}
.btn-primary:not(:disabled):hover { background: #7c3aed; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-link { background: none; color: var(--text-dim); font-size: 0.85rem; padding: 0.4rem; transition: color 0.2s; }
.btn-link:hover { color: var(--text-muted); }
.error-msg { color: var(--wrong); font-size: 0.85rem; text-align: center; }

@media (max-width: 360px) {
  .key { width: 27px; height: 38px; font-size: 0.78rem; }
  .letter-cell { width: 24px; height: 32px; font-size: 1rem; }
}
</style>
