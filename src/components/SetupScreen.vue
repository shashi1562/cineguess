<template>
  <div class="setup">

    <!-- ── STEP 1: Language Selection ──────────────────────────────────── -->
    <div v-if="step === 'language'" class="setup-enter">
      <div class="setup-top">
        <button class="back-btn" @click="store.goHome()">← Home</button>
      </div>

      <div class="setter-hero">
        <div class="setter-icon">🌐</div>
        <h2>Choose Movie Language</h2>
        <p>Pick the language you want to play with</p>
      </div>

      <div class="lang-grid">
        <button
          v-for="lang in LANGUAGES"
          :key="lang.key"
          class="lang-card"
          @click="onLanguageSelect(lang.key)"
        >
          <span class="lang-script">{{ lang.script }}</span>
          <span class="lang-name">{{ lang.label }}</span>
        </button>
      </div>
    </div>

    <!-- ── STEP 2a: Bot picked a movie (player-guesses mode) ─────────── -->
    <div v-else-if="step === 'bot-ready'" class="setup-handoff">
      <div class="handoff-card">
        <div class="lang-badge-big">{{ langEmoji }}</div>
        <div class="lock-icon">🤖</div>
        <h2>Bot has picked a {{ store.languageLabel }} movie!</h2>
        <p>Can you guess it letter by letter?</p>
        <p class="handoff-sub">6 lives · 2.5 min per letter</p>
        <button class="btn-primary" @click="store.startGame()">🎮 Start Guessing!</button>
        <button class="btn-link" @click="step = 'language'">← Change Language</button>
      </div>
    </div>

    <!-- ── STEP 2b: Movie entry form ─────────────────────────────────── -->
    <div v-else-if="step === 'enter'" class="setup-enter">
      <div class="setup-top">
        <button class="back-btn" @click="step = 'language'">← Language</button>
        <span class="lang-pill">{{ langEmoji }} {{ store.languageLabel }}</span>
      </div>

      <div class="setter-hero">
        <div class="setter-icon">🎬</div>
        <h2>{{ store.setterName }}, enter a {{ store.languageLabel }} movie</h2>
        <p v-if="store.mode !== 'bot'">Type secretly — the other player won't see it!</p>
        <p v-else>Pick any {{ store.languageLabel }} movie — the bot will try to guess it!</p>
      </div>

      <form class="movie-form" @submit.prevent="lockIn">
        <div class="input-wrapper">
          <input
            ref="inputRef"
            v-model="inputValue"
            type="password"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            placeholder="Type movie name here..."
            class="movie-input"
            maxlength="60"
            @input="errorMsg = ''"
          />
          <div v-if="inputValue" class="char-dots">
            <span v-for="(c, i) in inputValue" :key="i" class="char-dot">
              {{ c === ' ' ? ' ' : '•' }}
            </span>
          </div>
        </div>
        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
        <button type="submit" class="btn-primary" :disabled="!inputValue.trim()">
          Lock In 🔒
        </button>
      </form>
    </div>

    <!-- ── STEP 3: Handoff before game (bot-guesses / 2player / passplay) -->
    <div v-else-if="step === 'handoff'" class="setup-handoff">
      <div class="handoff-card">
        <div class="lang-badge-big">{{ langEmoji }}</div>
        <div class="lock-icon">🔒</div>
        <h2>Movie Locked!</h2>

        <template v-if="store.mode === 'bot'">
          <p>The bot is ready to guess your <strong>{{ store.languageLabel }}</strong> movie.</p>
          <div class="bot-preview">
            <span class="bot-dots">
              <span>•</span><span>•</span><span>•</span>
            </span>
            <span class="bot-label">Bot is warming up</span>
          </div>
        </template>

        <template v-else>
          <p>
            Pass the device to
            <strong>{{ store.guesserName }}</strong>
          </p>
          <p class="handoff-sub">
            They'll guess a <strong>{{ store.languageLabel }}</strong> movie — don't peek! 👀
          </p>
        </template>

        <button class="btn-primary" @click="store.startGame()">
          {{ store.mode === 'bot' ? '🤖 Start Bot Guessing!' : "✅ I'm ready — Start!" }}
        </button>

        <button class="btn-link" @click="step = 'enter'">← Change movie</button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
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
  english: '🌍', hindi: '🇮🇳', telugu: '🟡', tamil: '🔴',
  kannada: '🟠', malayalam: '🟢',
}

const store = useGameStore()
const step = ref('language')
const inputValue = ref('')
const errorMsg = ref('')
const inputRef = ref(null)

const langEmoji = computed(() => LANG_EMOJI[store.selectedLanguage] || '🌐')

onMounted(() => {
  // For passplay round 2+: language already chosen, skip to entry
  if (store.selectedLanguage) {
    if (store.mode === 'bot' && store.botSubMode === 'player-guesses') {
      store.pickBotMovie()
      step.value = 'bot-ready'
    } else {
      step.value = 'enter'
      nextTick(() => inputRef.value?.focus())
    }
  }
})

function onLanguageSelect(langKey) {
  store.selectedLanguage = langKey
  if (store.mode === 'bot' && store.botSubMode === 'player-guesses') {
    store.pickBotMovie()
    step.value = 'bot-ready'
  } else {
    step.value = 'enter'
    nextTick(() => inputRef.value?.focus())
  }
}

function lockIn() {
  const val = inputValue.value.trim()
  if (!val) { errorMsg.value = 'Please enter a movie name'; return }
  if (val.length < 2) { errorMsg.value = 'Movie name is too short'; return }
  if (!/[a-zA-Z]/.test(val)) { errorMsg.value = 'Must contain at least one letter'; return }
  store.lockInMovie(val)
  step.value = 'handoff'
}
</script>

<style scoped>
.setup {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 1.5rem 0;
}

/* Shared entry layout */
.setup-enter {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.setup-top {
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

.back-btn:hover {
  color: var(--text);
  border-color: var(--accent);
}

.round-pill,
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
.setter-hero {
  text-align: center;
}

.setter-icon {
  font-size: 3rem;
  margin-bottom: 0.75rem;
}

.setter-hero h2 {
  font-size: 1.35rem;
  font-weight: 700;
  margin-bottom: 0.4rem;
}

.setter-hero p {
  color: var(--text-muted);
  font-size: 0.9rem;
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
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.12);
}

.lang-card:active {
  transform: translateY(0);
}

.lang-script {
  font-size: 1.5rem;
  line-height: 1.2;
  font-weight: 700;
  color: var(--accent-light);
}

.lang-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
}

.lang-count {
  font-size: 0.7rem;
  color: var(--text-dim);
}

/* Movie entry form */
.movie-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.input-wrapper {
  width: 100%;
}

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

.movie-input::placeholder {
  color: var(--text-dim);
  letter-spacing: 0;
}

.movie-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.char-dots {
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 0 0.25rem;
  min-height: 1.4rem;
}

.char-dot {
  font-size: 1rem;
  color: var(--accent-light);
  width: 0.9rem;
  text-align: center;
}

.error {
  color: var(--wrong);
  font-size: 0.85rem;
  text-align: center;
}

/* Handoff */
.setup-handoff {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 2rem 0;
}

.handoff-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2.25rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  max-width: 420px;
  animation: bounce-in 0.35s ease;
}

.lang-badge-big {
  font-size: 2rem;
  line-height: 1;
}

.lock-icon {
  font-size: 2.5rem;
  line-height: 1;
  margin-top: -0.5rem;
}

.handoff-card h2 {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--correct);
}

.handoff-card p {
  color: var(--text-muted);
  font-size: 0.92rem;
}

.handoff-card strong {
  color: var(--accent-light);
}

.handoff-sub {
  font-size: 0.82rem !important;
  color: var(--text-dim) !important;
}

.bot-preview {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: var(--surface2);
  border-radius: 50px;
  padding: 0.45rem 1rem;
}

.bot-dots {
  display: flex;
  gap: 3px;
}

.bot-dots span {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: 50%;
  animation: blink 1.2s ease infinite;
}

.bot-dots span:nth-child(2) { animation-delay: 0.2s; }
.bot-dots span:nth-child(3) { animation-delay: 0.4s; }

.bot-label {
  font-size: 0.83rem;
  color: var(--text-muted);
}

.btn-link {
  background: none;
  color: var(--text-dim);
  font-size: 0.85rem;
  padding: 0.4rem;
  margin-top: -0.25rem;
  transition: color 0.2s;
}

.btn-link:hover {
  color: var(--text-muted);
}

@media (max-width: 380px) {
  .lang-grid {
    grid-template-columns: 1fr;
  }
}
</style>
