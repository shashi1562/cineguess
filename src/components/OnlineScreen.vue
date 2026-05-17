<template>
  <div class="online-screen">

    <!-- Menu: Create or Join -->
    <div v-if="step === 'menu'" class="section">
      <button class="back-btn" @click="store.goHome()">← Home</button>
      <div class="hero">
        <div class="hero-icon">🌐</div>
        <h2>2 Player</h2>
        <p>Play with a friend on another device in real time</p>
      </div>
      <div class="choices">
        <button class="choice-card" @click="doCreateRoom">
          <span class="choice-icon">🏠</span>
          <div class="choice-text">
            <strong>Create Room</strong>
            <p>Create a room and share the code with your friend</p>
          </div>
        </button>
        <button class="choice-card" @click="step = 'join-form'">
          <span class="choice-icon">🔗</span>
          <div class="choice-text">
            <strong>Join Room</strong>
            <p>Enter a friend's room code to play together</p>
          </div>
        </button>
      </div>

    </div>

    <!-- Creating room spinner -->
    <div v-else-if="step === 'creating'" class="section center">
      <div class="lobby-card">
        <div class="lobby-icon">⏳</div>
        <h2>Creating Room…</h2>
        <div class="thinking-dots">
          <span class="dot" /><span class="dot" /><span class="dot" />
        </div>
      </div>
    </div>

    <!-- Creator: Waiting for friend to join -->
    <div v-else-if="step === 'create-waiting'" class="section center">
      <div class="lobby-card">
        <div class="lobby-icon">⏳</div>
        <h2>Waiting for friend…</h2>
        <p class="share-label">Share this code:</p>
        <div class="room-code">
          <span v-for="(ch, i) in store.roomCode" :key="i" class="code-char">{{ ch }}</span>
        </div>
        <button class="copy-btn" @click="copyCode">
          {{ copied ? '✅ Copied!' : '📋 Copy Code' }}
        </button>
        <p class="hint">Ask your friend to open the app and join with this code</p>
        <button class="btn-link" @click="cancelRoom">✕ Cancel</button>
      </div>
    </div>

    <!-- Creator: Friend joined — choose who guesses -->
    <div v-else-if="step === 'role-select'" class="section center">
      <div class="lobby-card">
        <div class="lobby-icon">✅</div>
        <h2>Friend joined!</h2>
        <p>Room: <strong class="code-inline">{{ store.roomCode }}</strong></p>
        <div class="presence-pill online"><span class="presence-pulse" />Friend is here</div>
        <p class="role-q">Who should guess the movie?</p>
        <div class="role-choices">
          <button class="role-card" @click="store.chooseRoles(true)">
            <span class="role-icon">🎮</span>
            <strong>I'll Guess</strong>
            <p>You guess — friend picks the movie</p>
          </button>
          <button class="role-card" @click="store.chooseRoles(false)">
            <span class="role-icon">🎬</span>
            <strong>Friend Guesses</strong>
            <p>You pick the movie — friend guesses</p>
          </button>
        </div>
      </div>
    </div>

    <!-- Joiner: Enter room code -->
    <div v-else-if="step === 'join-form'" class="section center">
      <div class="lobby-card">
        <button class="back-btn self-start" @click="step = 'menu'">← Back</button>
        <div class="lobby-icon">🔗</div>
        <h2>Enter Room Code</h2>
        <p>Ask your friend for their 6-character code</p>
        <input
          v-model="joinCode"
          class="code-input"
          placeholder="e.g. K7X2QP"
          maxlength="6"
          spellcheck="false"
          autocomplete="off"
          @input="joinCode = joinCode.toUpperCase().replace(/[^A-Z0-9]/g, ''); joinError = ''"
          @keyup.enter="doJoin"
        />
        <p v-if="joinError" class="error-msg">{{ joinError }}</p>
        <button
          class="btn-primary"
          :disabled="joinCode.length < 6 || joining"
          @click="doJoin"
        >
          {{ joining ? 'Joining…' : 'Join Room →' }}
        </button>
      </div>
    </div>

    <!-- Joiner: Waiting for creator to assign roles -->
    <div v-else-if="step === 'join-waiting'" class="section center">
      <div class="lobby-card">
        <div class="lobby-icon">🎬</div>
        <h2>Joined!</h2>
        <div class="room-code-small">Room: <span>{{ store.roomCode }}</span></div>
        <p>Waiting for the host to set roles…</p>
        <div class="thinking-dots">
          <span class="dot" /><span class="dot" /><span class="dot" />
        </div>
        <button class="btn-link" @click="leaveAndGoHome">← Leave Room</button>
      </div>
    </div>

    <!-- Setter: Choose language -->
    <div v-else-if="step === 'language'" class="section">
      <div class="hero">
        <div class="hero-icon">🎬</div>
        <h2>Choose Movie Language</h2>
        <p>You're the setter — pick a language for your movie</p>
      </div>
      <div class="lang-grid">
        <button
          v-for="lang in LANGUAGES"
          :key="lang.key"
          class="lang-card"
          @click="onLangSelect(lang.key)"
        >
          <span class="lang-script">{{ lang.script }}</span>
          <span class="lang-name">{{ lang.label }}</span>
        </button>
      </div>
    </div>

    <!-- Setter: Enter movie name -->
    <div v-else-if="step === 'enter-movie'" class="section">
      <div class="section-top">
        <button class="back-btn" @click="step = 'language'">← Language</button>
        <span class="lang-pill">{{ langEmoji }} {{ store.languageLabel }}</span>
      </div>
      <div class="hero">
        <div class="hero-icon">🎬</div>
        <h2>Enter a {{ store.languageLabel }} movie</h2>
        <p>Your friend will try to guess it letter by letter!</p>
      </div>
      <form class="movie-form" @submit.prevent="lockMovie">
        <div class="input-wrapper">
          <input
            ref="inputRef"
            v-model="movieInput"
            type="password"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            placeholder="Type movie name here..."
            class="movie-input"
            maxlength="60"
            @input="movieError = ''"
          />
          <div v-if="movieInput" class="char-dots">
            <span v-for="(c, i) in movieInput" :key="i" class="char-dot">
              {{ c === ' ' ? ' ' : '•' }}
            </span>
          </div>
        </div>
        <p v-if="movieError" class="error-msg">{{ movieError }}</p>
        <div class="hint-field">
          <input
            v-model="hintInput"
            type="text"
            placeholder="💡 Add a hint (optional) — revealed after 50% guessed"
            class="hint-input"
            maxlength="80"
          />
        </div>
        <button type="submit" class="btn-primary" :disabled="!movieInput.trim() || locking">
          {{ locking ? 'Locking in…' : 'Lock In Movie 🔒' }}
        </button>
      </form>
    </div>

    <!-- Setter: Waiting for guesser to start -->
    <div v-else-if="step === 'locked'" class="section center">
      <div class="lobby-card">
        <div class="lobby-icon">🔒</div>
        <h2>Movie Locked!</h2>
        <div class="presence-pill" :class="store.opponentPresent ? 'online' : 'offline'">
          <span v-if="store.opponentPresent" class="presence-pulse" />
          {{ store.opponentPresent ? 'Friend online' : 'Friend offline' }}
        </div>
        <p>Waiting for your friend to start the game…</p>
        <div class="thinking-dots">
          <span class="dot" /><span class="dot" /><span class="dot" />
        </div>
        <button class="btn-link" @click="leaveAndGoHome">← Leave</button>
      </div>
    </div>

    <!-- Guesser: Waiting for setter to pick movie -->
    <div v-else-if="step === 'waiting-movie'" class="section center">
      <div class="lobby-card">
        <div class="lobby-icon">🎬</div>
        <h2>Almost there!</h2>
        <div class="presence-pill" :class="store.opponentPresent ? 'online' : 'offline'">
          <span v-if="store.opponentPresent" class="presence-pulse" />
          {{ store.opponentPresent ? 'Friend online' : 'Friend offline' }}
        </div>
        <p>Waiting for your friend to pick a movie…</p>
        <div class="thinking-dots">
          <span class="dot" /><span class="dot" /><span class="dot" />
        </div>
        <button class="btn-link" @click="leaveAndGoHome">← Leave</button>
      </div>
    </div>

    <!-- Guesser: Ready to start -->
    <div v-else-if="step === 'ready-to-start'" class="section center">
      <div class="lobby-card">
        <div class="lobby-icon">🎮</div>
        <h2>Movie is set!</h2>
        <div class="presence-pill" :class="store.opponentPresent ? 'online' : 'offline'">
          <span v-if="store.opponentPresent" class="presence-pulse" />
          {{ store.opponentPresent ? 'Friend online' : 'Friend offline' }}
        </div>
        <p>Your friend picked a mystery movie. Ready to guess?</p>
        <button class="btn-primary start-btn" @click="startGame">
          🚀 Start Guessing!
        </button>
        <button class="btn-link" @click="leaveAndGoHome">← Leave</button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useGameStore } from '../stores/game.js'

const LANGUAGES = [
  { key: 'english',   label: 'English',   script: '🌍' },
  { key: 'hindi',     label: 'Hindi',     script: 'हिन्दी' },
  { key: 'telugu',    label: 'Telugu',    script: 'తెలుగు' },
  { key: 'tamil',     label: 'Tamil',     script: 'தமிழ்' },
  { key: 'kannada',   label: 'Kannada',   script: 'ಕನ್ನಡ' },
  { key: 'malayalam', label: 'Malayalam', script: 'മലയാളം' },
]
const LANG_EMOJI = {
  english: '🌍', hindi: '🇮🇳', telugu: '🟡',
  tamil: '🔴', kannada: '🟠', malayalam: '🟢',
}

const store = useGameStore()
const step = ref('menu')
const movieInput = ref('')
const hintInput = ref('')
const movieError = ref('')
const locking = ref(false)
const joinCode = ref('')
const joinError = ref('')
const joining = ref(false)
const copied = ref(false)
const inputRef = ref(null)

const langEmoji = computed(() => LANG_EMOJI[store.selectedLanguage] || '🌐')


// Rematch: store sets pendingOnlineStep before navigating back to 'online' screen.
// { immediate: true } ensures this fires as soon as the component is ready,
// regardless of transition timing.
watch(
  () => store.pendingOnlineStep,
  (v) => {
    if (!v) return
    step.value = v
    store.pendingOnlineStep = null
  },
  { immediate: true }
)

// Drive step transitions from store state changes
watch(() => store.opponentConnected, (v) => {
  if (v && step.value === 'create-waiting') step.value = 'role-select'
})

watch(() => store.onlineRole, (role) => {
  if (!role) return
  if (['join-waiting', 'create-waiting', 'role-select'].includes(step.value)) {
    step.value = role === 'setter' ? 'language' : 'waiting-movie'
  }
})

watch(() => store.movieLocked, (v) => {
  if (!v) return
  step.value = store.onlineRole === 'guesser' ? 'ready-to-start' : 'locked'
})

async function doCreateRoom() {
  step.value = 'creating'
  try {
    await store.createRoom()
    step.value = 'create-waiting'
  } catch {
    step.value = 'menu'
  }
}

async function doJoin() {
  if (joinCode.value.length < 6 || joining.value) return
  joining.value = true
  joinError.value = ''
  try {
    await store.joinRoom(joinCode.value)
    step.value = 'join-waiting'
  } catch (e) {
    joinError.value = e.message === 'Room not found'
      ? 'Room not found. Double-check the code.'
      : e.message
  } finally {
    joining.value = false
  }
}

function onLangSelect(langKey) {
  store.selectedLanguage = langKey
  step.value = 'enter-movie'
  nextTick(() => inputRef.value?.focus())
}

async function lockMovie() {
  const val = movieInput.value.trim()
  if (!val || val.length < 2) { movieError.value = 'Movie name is too short'; return }
  if (!/[a-zA-Z]/.test(val)) { movieError.value = 'Must contain at least one letter'; return }
  locking.value = true
  try {
    await store.lockOnlineMovie(store.selectedLanguage, val, hintInput.value)
    // step transitions to 'locked' via the movieLocked watcher
  } catch {
    movieError.value = 'Failed to lock movie. Check your connection and try again.'
  } finally {
    locking.value = false
  }
}

function copyCode() {
  navigator.clipboard?.writeText(store.roomCode)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function startGame() {
  store.startOnlineGame()
  // Both devices navigate to GameScreen via _subscribeOnline
}

function cancelRoom() {
  store.leaveRoom()
  step.value = 'menu'
}

function leaveAndGoHome() {
  store.goHome()
}
</script>

<style scoped>
.online-screen {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 1.5rem 0;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.section.center {
  align-items: center;
  justify-content: center;
  flex: 1;
}

.section-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-btn {
  background: none;
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 500;
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  transition: all 0.2s;
}
.back-btn:hover { color: var(--text); border-color: var(--accent); }
.self-start { align-self: flex-start; }

.lang-pill {
  background: var(--accent-glow);
  border: 1px solid var(--accent);
  color: var(--accent-light);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.75rem;
  border-radius: 50px;
}

/* Hero */
.hero { text-align: center; }
.hero-icon { font-size: 3rem; margin-bottom: 0.75rem; line-height: 1; }
.hero h2 { font-size: 1.35rem; font-weight: 700; margin-bottom: 0.4rem; }
.hero p { color: var(--text-muted); font-size: 0.9rem; }

/* Choice cards */
.choices {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.choice-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.18s;
  color: var(--text);
}
.choice-card:hover {
  border-color: var(--accent);
  background: rgba(139, 92, 246, 0.07);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.12);
}
.choice-icon { font-size: 2rem; flex-shrink: 0; }
.choice-text strong { display: block; font-size: 1rem; font-weight: 700; margin-bottom: 0.2rem; color: var(--text); }
.choice-text p { font-size: 0.82rem; color: var(--text-muted); }

/* Lobby card */
.lobby-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2.25rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  max-width: 420px;
  animation: bounce-in 0.35s ease;
}
.lobby-icon { font-size: 3rem; line-height: 1; }
.lobby-card h2 { font-size: 1.4rem; font-weight: 800; color: var(--text); }
.lobby-card p { color: var(--text-muted); font-size: 0.9rem; }

/* Room code display */
.share-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  font-weight: 600;
  margin-bottom: -0.25rem;
}
.room-code {
  display: flex;
  gap: 6px;
}
.code-char {
  width: 40px;
  height: 52px;
  background: var(--surface2);
  border: 2px solid var(--accent);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--accent-light);
}
.copy-btn {
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  cursor: pointer;
}
.copy-btn:hover { border-color: var(--accent); color: var(--accent-light); }

.hint {
  font-size: 0.8rem !important;
  color: var(--text-dim) !important;
}
.start-btn { margin-top: 0.25rem; }

/* Role selection */
.role-q {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  margin-top: 0.25rem;
}
.role-choices {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}
.role-card {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.1rem 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  transition: all 0.18s;
  text-align: center;
  color: var(--text);
}
.role-card:hover {
  border-color: var(--accent);
  background: rgba(139, 92, 246, 0.07);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.1);
}
.role-icon { font-size: 2rem; }
.role-card strong { font-size: 1rem; font-weight: 700; color: var(--text); }
.role-card p { font-size: 0.8rem; color: var(--text-muted); }

.code-inline {
  color: var(--accent-light);
  letter-spacing: 0.1em;
}

/* Code input for join */
.code-input {
  width: 100%;
  background: var(--surface2);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 1.8rem;
  font-weight: 900;
  padding: 0.7rem 1rem;
  text-align: center;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  transition: border-color 0.2s;
}
.code-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.code-input::placeholder { color: var(--text-dim); font-weight: 400; font-size: 1.1rem; letter-spacing: 0.1em; }

.room-code-small {
  font-size: 0.8rem;
  color: var(--text-dim);
}
.room-code-small span {
  font-weight: 700;
  color: var(--accent-light);
  letter-spacing: 0.15em;
}

/* Language grid */
.lang-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}
.lang-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.1rem 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  transition: all 0.18s;
  color: var(--text);
}
.lang-card:hover {
  border-color: var(--accent);
  background: rgba(139, 92, 246, 0.07);
  transform: translateY(-2px);
}
.lang-script { font-size: 1.5rem; font-weight: 700; color: var(--accent-light); }
.lang-name { font-size: 0.95rem; font-weight: 700; }
.lang-count { font-size: 0.7rem; color: var(--text-dim); }

/* Movie form */
.movie-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.input-wrapper { width: 100%; }
.movie-input {
  width: 100%;
  background: var(--surface2);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 1.1rem;
  font-weight: 500;
  padding: 0.85rem 1.1rem;
  transition: border-color 0.2s;
  letter-spacing: 0.1em;
}
.movie-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.movie-input::placeholder { color: var(--text-dim); letter-spacing: 0; }
.char-dots {
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 0 0.25rem;
}
.char-dot { font-size: 1rem; color: var(--accent-light); width: 0.9rem; text-align: center; }

/* Thinking dots */
.thinking-dots {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0;
}
.dot {
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
  animation: blink 1.2s ease infinite;
}
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

.btn-link {
  background: none;
  color: var(--text-dim);
  font-size: 0.85rem;
  padding: 0.4rem;
  transition: color 0.2s;
}
.btn-link:hover { color: var(--text-muted); }

.error-msg {
  color: var(--wrong);
  font-size: 0.85rem;
  text-align: center;
}

/* Hint field */
.hint-field { width: 100%; }
.hint-input {
  width: 100%;
  background: rgba(245, 158, 11, 0.05);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: var(--radius-sm);
  color: #fcd34d;
  font-size: 0.85rem;
  padding: 0.65rem 1rem;
  transition: border-color 0.2s;
  font-family: inherit;
}
.hint-input:focus { outline: none; border-color: rgba(245, 158, 11, 0.55); box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.08); }
.hint-input::placeholder { color: rgba(245, 158, 11, 0.4); font-size: 0.8rem; }

/* Presence pill */
.presence-pill {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.3rem 0.8rem;
  border-radius: 50px;
}
.presence-pill.online {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.35);
  color: var(--correct);
}
.presence-pill.offline {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--wrong);
}
.presence-pulse {
  width: 7px;
  height: 7px;
  background: var(--correct);
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse-p 2s ease infinite;
}
@keyframes pulse-p {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
  50% { box-shadow: 0 0 0 4px rgba(34,197,94,0); }
}

@media (max-width: 380px) {
  .lang-grid { grid-template-columns: 1fr; }
  .code-char { width: 34px; height: 44px; font-size: 1.2rem; }
}
</style>
