<template>
  <div class="game-screen" :class="{ 'danger-state': dangerState }">
    <!-- Header -->
    <div class="game-header">
      <button class="back-btn" @click="store.goHome()">← Home</button>

      <div class="game-meta">
<span v-if="store.selectedLanguage" class="lang-tag">
          {{ store.languageLabel }}
        </span>
        <span class="guesser-tag">{{ store.guesserName }} Guessing</span>
      </div>

      <button
        class="mute-btn"
        :title="isMuted ? 'Unmute sounds' : 'Mute sounds'"
        @click="toggleMute"
      >
        {{ isMuted ? '🔇' : '🔊' }}
      </button>
    </div>

    <!-- Timer bar (shown whenever a human is guessing) -->
    <div v-if="store.playerIsGuessing" class="timer-wrap">
      <div
        class="timer-bar"
        :style="{ width: store.timerPercent + '%' }"
        :class="{
          warning: store.timer <= 45 && store.timer > 20,
          danger: store.timer <= 20,
        }"
      />
      <span class="timer-count" :class="{ danger: store.timer <= 20 }">
        {{ timerDisplay }}
      </span>
    </div>

    <!-- Lives -->
    <div class="lives-row" :class="{ shake: shakeHearts }">
      <span
        v-for="(alive, i) in store.heartsArray"
        :key="i"
        class="heart"
        :class="alive ? 'alive' : 'dead'"
      >
        {{ alive ? '❤️' : '🖤' }}
      </span>
      <span class="lives-label">{{ store.lives }} / 6</span>
    </div>

    <!-- Word display -->
    <div class="word-display">
      <TransitionGroup name="reveal">
        <template v-for="(item, i) in store.displayWord" :key="i">
          <span v-if="item.type === 'space'" class="word-space" />
          <span v-else-if="item.type === 'special'" class="letter-box special">
            {{ item.char }}
          </span>
          <span
            v-else
            class="letter-box"
            :class="{ revealed: item.shown }"
          >
            <span class="letter-inner">{{ item.shown ? item.char : '' }}</span>
          </span>
        </template>
      </TransitionGroup>
    </div>

    <!-- Word info row -->
    <div class="word-info">
      <span>{{ totalLetters }} letters</span>
      <span class="dot-sep">·</span>
      <span>{{ wordCount }} {{ wordCount === 1 ? 'word' : 'words' }}</span>
      <span class="dot-sep">·</span>
      <span class="revealed-count">{{ revealedCount }} revealed</span>
    </div>

    <!-- Wrong guesses -->
    <div v-if="store.wrongGuesses.length" class="wrong-row">
      <span class="wrong-label">Wrong:</span>
      <span v-for="l in store.wrongGuesses" :key="l" class="wrong-chip">
        {{ l.toUpperCase() }}
      </span>
    </div>

    <!-- Online: watching indicator for the setter -->
    <div v-if="store.mode === 'online' && store.onlineRole === 'setter'" class="watching-bar">
      <span>👁️</span>
      <span>You set the movie — watching your friend guess live</span>
    </div>

    <!-- Bot status indicator (only when bot is the guesser) -->
    <div v-if="store.mode === 'bot' && store.botSubMode === 'bot-guesses'" class="bot-status">
      <template v-if="store.lastBotGuess && !store.isGameOver">
        <span class="bot-icon">🤖</span>
        <span>Bot guessed</span>
        <span class="bot-letter" :class="store.lastBotGuessCorrect ? 'correct' : 'wrong'">
          {{ store.lastBotGuess }}
        </span>
        <span :class="store.lastBotGuessCorrect ? 'label-correct' : 'label-wrong'">
          {{ store.lastBotGuessCorrect ? '✅ Correct!' : '❌ Wrong!' }}
        </span>
      </template>
      <template v-else-if="!store.isGameOver">
        <span class="bot-icon">🤖</span>
        <span class="bot-thinking">
          Bot is thinking
          <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
        </span>
      </template>
    </div>

    <!-- Keyboard -->
    <div class="keyboard" :class="{
      'is-bot': store.mode === 'bot' && store.botSubMode === 'bot-guesses',
      'is-watching': store.mode === 'online' && store.onlineRole === 'setter',
    }">
      <div v-for="(row, ri) in KEYBOARD" :key="ri" class="key-row">
        <button
          v-for="letter in row"
          :key="letter"
          class="key"
          :class="[store.letterStatus(letter), { pressed: pressedKey === letter }]"
          :disabled="store.letterStatus(letter) !== 'idle' || store.isGameOver || !store.playerIsGuessing"
          @click="handleKeyClick(letter)"
        >
          {{ letter }}
        </button>
      </div>
    </div>

    <!-- Physical keyboard hint (desktop only) -->
    <p v-if="showKeyboardHint" class="keyboard-hint">
      ⌨️ Type letters with your keyboard
    </p>

    <!-- Game over overlay (briefly shown before result transition) -->
    <Transition name="overlay">
      <div v-if="store.isGameOver" class="game-over-overlay">
        <div
          class="game-over-box"
          :class="{ 'win-glow': store.isGameWon, 'lose-glow': store.isGameLost }"
        >
          <span class="game-over-icon">{{ store.isGameWon ? '🎉' : '💀' }}</span>
          <span class="game-over-text">
            {{ store.isGameWon ? 'Guessed it!' : 'Out of lives!' }}
          </span>
          <span class="game-over-movie">{{ store.movieWord }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '../stores/game.js'
import {
  soundCorrect, soundWrong, soundWin, soundLose, soundTick,
  isMuted, toggleMute,
} from '../sounds.js'

const KEYBOARD = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

const store = useGameStore()
const shakeHearts = ref(false)
const pressedKey = ref('')
let timerInterval = null

// Detect desktop for keyboard hint (rough check: hover media query)
const showKeyboardHint = ref(false)

const timerDisplay = computed(() => {
  const m = Math.floor(store.timer / 60)
  const s = store.timer % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
})

const dangerState = computed(
  () => store.timer <= 20 && store.timerActive && !store.isGameOver && store.playerIsGuessing
)

const totalLetters = computed(() =>
  store.movieWord.split('').filter((c) => /[a-zA-Z]/.test(c)).length
)
const wordCount = computed(() =>
  store.movieWord.trim().split(/\s+/).filter(Boolean).length
)
const revealedCount = computed(() => store.correctGuesses.length)

// Shake hearts on wrong guess
watch(
  () => store.lives,
  (newVal, oldVal) => {
    if (newVal < oldVal) {
      shakeHearts.value = true
      setTimeout(() => (shakeHearts.value = false), 600)
    }
  }
)

// Sound on each letter guess (covers player, bot, and online synced guesses)
watch(
  () => store.guessedLetters.length,
  (newLen, oldLen) => {
    if (newLen <= oldLen || store.isGameOver) return
    const lastLetter = store.guessedLetters[newLen - 1]
    if (!lastLetter) return
    const isCorrect = store.movieWord.toLowerCase().includes(lastLetter)
    if (isCorrect) {
      soundCorrect()
      if (navigator.vibrate) navigator.vibrate(50)
    } else {
      soundWrong()
      if (navigator.vibrate) navigator.vibrate([80, 30, 80])
    }
  }
)

// Sound and haptic on game over
watch(
  () => store.isGameOver,
  (val) => {
    if (!val) return
    if (store.isGameWon) {
      soundWin()
      if (navigator.vibrate) navigator.vibrate([100, 50, 200, 50, 300])
    } else {
      soundLose()
      if (navigator.vibrate) navigator.vibrate(500)
    }
  }
)

function flashPressedKey(letter) {
  pressedKey.value = letter
  setTimeout(() => {
    if (pressedKey.value === letter) pressedKey.value = ''
  }, 130)
}

// Physical keyboard support
function onKeydown(e) {
  if (e.repeat) return
  const letter = e.key.toUpperCase()
  if (!/^[A-Z]$/.test(letter)) return
  if (!store.playerIsGuessing || store.isGameOver) return
  if (store.letterStatus(letter.toLowerCase()) !== 'idle') return
  flashPressedKey(letter)
  store.guess(letter)
}

// Timer countdown (whenever a human is guessing)
onMounted(() => {
  window.addEventListener('keydown', onKeydown)

  // Detect desktop for hint (matchMedia hover)
  if (window.matchMedia?.('(hover: hover)').matches) {
    showKeyboardHint.value = true
  }

  if (!store.playerIsGuessing) return
  timerInterval = setInterval(() => {
    if (!store.timerActive || store.isGameOver) return
    if (store.timer > 0) {
      store.timer--
      if (store.timer <= 20 && store.timer > 0) soundTick()
    } else {
      store.timerExpired()
    }
  }, 1000)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearInterval(timerInterval)
})

function handleKeyClick(letter) {
  if (!store.playerIsGuessing || store.isGameOver) return
  flashPressedKey(letter)
  store.guess(letter)
}
</script>

<style scoped>
.game-screen {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  padding: 1rem 0 2rem;
  position: relative;
}

/* Danger state — subtle red vignette on the page */
.game-screen.danger-state::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 0 80px rgba(239, 68, 68, 0.1);
  z-index: 0;
}

/* Header */
.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-btn {
  background: none;
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  transition: all 0.2s;
}

.back-btn:hover {
  color: var(--text);
  border-color: var(--accent);
}

.game-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.round-tag,
.guesser-tag,
.lang-tag {
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.2rem 0.65rem;
  border-radius: 50px;
}

.round-tag {
  background: var(--accent-glow);
  border: 1px solid var(--accent);
  color: var(--accent-light);
}

.lang-tag {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid var(--correct);
  color: var(--correct);
}

.guesser-tag {
  background: var(--surface2);
  color: var(--text-muted);
}

/* Mute button */
.mute-btn {
  background: none;
  font-size: 1.05rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.55rem;
  line-height: 1;
  transition: border-color 0.2s, background 0.2s;
  flex-shrink: 0;
}

.mute-btn:hover {
  border-color: var(--accent);
  background: var(--accent-glow);
}

/* Timer */
.timer-wrap {
  position: relative;
  height: 6px;
  background: var(--surface2);
  border-radius: 50px;
  overflow: visible;
  display: flex;
  align-items: center;
}

.timer-bar {
  height: 100%;
  background: var(--correct);
  border-radius: 50px;
  transition: width 1s linear, background 0.5s;
}

.timer-bar.warning {
  background: var(--warn);
}

.timer-bar.danger {
  background: var(--wrong);
  animation: pulse-bar 0.6s ease infinite;
}

.timer-count {
  position: absolute;
  right: 0;
  top: -18px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted);
  transition: color 0.3s;
}

.timer-count.danger {
  color: var(--wrong);
  animation: blink 0.6s ease infinite;
}

/* Lives */
.lives-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lives-row.shake {
  animation: shake 0.5s ease;
}

.heart {
  font-size: 1.4rem;
  transition: all 0.3s;
}

.heart.dead {
  opacity: 0.3;
  filter: grayscale(1);
}

.lives-label {
  margin-left: auto;
  font-size: 0.8rem;
  color: var(--text-dim);
  font-weight: 600;
}

/* Word display */
.word-display {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  padding: 1rem 0 0.25rem;
  min-height: 80px;
  align-items: flex-end;
}

.word-space {
  width: 14px;
  display: inline-block;
}

.letter-box {
  width: 34px;
  height: 46px;
  border-bottom: 3px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 700;
  border-radius: 4px 4px 0 0;
  transition: all 0.3s;
  position: relative;
}

.letter-box.special {
  border-bottom-color: transparent;
  color: var(--text-muted);
}

.letter-box.revealed {
  border-bottom-color: var(--correct);
  background: var(--correct-bg);
}

.letter-inner {
  color: var(--correct);
  animation: revealLetter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

/* Word info row */
.word-info {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.74rem;
  color: var(--text-dim);
  margin-top: -0.35rem;
}

.dot-sep {
  color: var(--border);
}

.revealed-count {
  color: var(--correct);
  font-weight: 600;
}

/* Wrong guesses */
.wrong-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.wrong-label {
  font-size: 0.8rem;
  color: var(--text-dim);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.wrong-chip {
  background: var(--wrong-bg);
  border: 1px solid var(--wrong);
  color: var(--wrong);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

/* Online watching bar */
.watching-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid var(--correct);
  border-radius: var(--radius-sm);
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  color: var(--correct);
  font-weight: 500;
}

.keyboard.is-watching {
  opacity: 0.35;
  pointer-events: none;
}

/* Bot status */
.bot-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
}

.bot-icon {
  font-size: 1.2rem;
}

.bot-letter {
  font-size: 1.2rem;
  font-weight: 800;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.bot-letter.correct {
  background: var(--correct-bg);
  color: var(--correct);
}

.bot-letter.wrong {
  background: var(--wrong-bg);
  color: var(--wrong);
}

.label-correct {
  color: var(--correct);
  font-weight: 600;
}

.label-wrong {
  color: var(--wrong);
  font-weight: 600;
}

.bot-thinking {
  color: var(--text-muted);
}

.dot {
  animation: blink 1.2s ease infinite;
  display: inline-block;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

/* Keyboard */
.keyboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  margin-top: 0.25rem;
}

.keyboard.is-bot {
  opacity: 0.45;
  pointer-events: none;
}

.key-row {
  display: flex;
  gap: 5px;
}

.key {
  width: 34px;
  height: 44px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0;
  transition: background 0.15s, border-color 0.15s, transform 0.08s, box-shadow 0.08s;
  border: 1px solid transparent;
}

.key.idle {
  background: var(--surface3);
  color: var(--text);
  border-color: var(--border);
}

.key.idle:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.35);
}

.key.idle:active:not(:disabled),
.key.pressed {
  transform: scale(0.88) translateY(2px) !important;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3) !important;
  transition: transform 0.05s, box-shadow 0.05s !important;
}

.key.correct {
  background: #15803d;
  color: #fff;
  border-color: var(--correct);
}

.key.wrong {
  background: #7f1d1d;
  color: #fca5a5;
  border-color: #991b1b;
}

.key:disabled.idle {
  opacity: 0.5;
}

/* Keyboard hint */
.keyboard-hint {
  text-align: center;
  font-size: 0.7rem;
  color: var(--text-dim);
  margin-top: -0.35rem;
  opacity: 0.7;
}

/* Game over overlay */
.game-over-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
}

.game-over-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2rem 2.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  animation: bounce-in 0.3s ease;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.game-over-box.win-glow {
  border-color: var(--correct);
  box-shadow: 0 0 50px rgba(34, 197, 94, 0.25);
}

.game-over-box.lose-glow {
  border-color: var(--wrong);
  box-shadow: 0 0 50px rgba(239, 68, 68, 0.2);
}

.game-over-icon {
  font-size: 3rem;
}

.game-over-text {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text);
}

.game-over-movie {
  color: var(--accent-light);
  font-size: 1rem;
  font-weight: 600;
  word-break: break-word;
  max-width: 280px;
}

/* Transitions */
.overlay-enter-active {
  transition: opacity 0.2s, transform 0.2s;
}

.overlay-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.reveal-enter-active {
  transition: all 0.3s;
}

@keyframes pulse-bar {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.65; }
}

@media (max-width: 400px) {
  .key {
    width: 27px;
    height: 38px;
    font-size: 0.7rem;
  }

  .key-row {
    gap: 3px;
  }

  .keyboard {
    gap: 4px;
  }

  .letter-box {
    width: 28px;
    height: 38px;
    font-size: 1rem;
  }
}
</style>
