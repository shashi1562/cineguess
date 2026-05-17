<template>
  <div class="home">
    <header class="home-header">
      <div class="logo">🎬</div>
      <h1>CineGuess</h1>
      <p class="tagline">Guess the hidden movie name, letter by letter</p>
    </header>

    <div class="mode-grid">
      <!-- Group Play -->
      <button class="mode-card flat-card group-card" @click="goGroup">
        <span class="mode-icon">🎭</span>
        <div class="mode-text">
          <h2>Group Play</h2>
          <p>Up to 6 players — everyone guesses on their own private board</p>
        </div>
        <span class="mode-badge group-badge">New</span>
      </button>

      <!-- 2 Player -->
      <button class="mode-card flat-card online-card" @click="goOnline">
        <span class="mode-icon">🌐</span>
        <div class="mode-text">
          <h2>2 Player</h2>
          <p>Play with a friend on another device using a room code</p>
        </div>
        <span class="mode-badge online-badge">Live</span>
      </button>

      <!-- vs Bot card — expandable -->
      <div class="mode-card bot-card" :class="{ expanded: botExpanded }">
        <button class="mode-card-header" @click="toggleBot">
          <span class="mode-icon">🤖</span>
          <div class="mode-text">
            <h2>vs Bot</h2>
            <p>Challenge the bot or watch it work</p>
          </div>
          <span class="chevron" :class="{ open: botExpanded }">›</span>
        </button>

        <Transition name="expand">
          <div v-if="botExpanded" class="bot-sub-options">
            <button class="sub-option" @click="selectBotMode('player-guesses')">
              <span class="sub-icon">🎮</span>
              <div class="sub-text">
                <strong>You Guess</strong>
                <p>Bot picks a mystery movie — you try to crack it</p>
              </div>
            </button>
            <div class="sub-divider" />
            <button class="sub-option" @click="selectBotMode('bot-guesses')">
              <span class="sub-icon">👁️</span>
              <div class="sub-text">
                <strong>Bot Guesses</strong>
                <p>You pick a movie — watch the bot try to guess it</p>
              </div>
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <div class="rules">
      <h3>How to Play</h3>
      <ul>
        <li>🎬 One player picks a secret movie name</li>
        <li>🔤 The guesser clicks letters one at a time</li>
        <li>❤️ 6 lives — each wrong letter costs one</li>
        <li>🏆 Guess the whole movie before lives run out!</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useGameStore } from '../stores/game.js'
import { soundClick } from '../sounds.js'

const store = useGameStore()
const botExpanded = ref(false)

function selectBotMode(sub) {
  soundClick()
  store.selectBotMode(sub)
}

function goOnline() {
  soundClick()
  store.goOnline()
}

function goGroup() {
  soundClick()
  store.goGroup()
}

function toggleBot() {
  soundClick()
  botExpanded.value = !botExpanded.value
}
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem 0;
}

.home-header {
  text-align: center;
}

.logo {
  font-size: 3.5rem;
  line-height: 1;
  margin-bottom: 0.5rem;
  filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.5));
  animation: float 3s ease-in-out infinite;
  display: inline-block;
}

h1 {
  font-size: 2.2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #a78bfa, #f0abfc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.4rem;
}

.tagline {
  color: var(--text-muted);
  font-size: 0.95rem;
}

/* Mode grid */
.mode-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mode-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.mode-card:hover,
.mode-card.expanded {
  border-color: var(--accent);
  box-shadow: 0 8px 30px rgba(139, 92, 246, 0.12);
}

/* Expandable bot card */
.bot-card {
  cursor: default;
}

.mode-card-header {
  width: 100%;
  background: none;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.mode-card-header:hover {
  background: rgba(139, 92, 246, 0.05);
}

/* Flat (non-expandable) cards */
.flat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  text-align: left;
  cursor: pointer;
  position: relative;
}

.flat-card:hover {
  background: rgba(139, 92, 246, 0.06);
}

.mode-icon {
  font-size: 1.9rem;
  line-height: 1;
  flex-shrink: 0;
}

.mode-text {
  flex: 1;
  min-width: 0;
}

.mode-text h2 {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.15rem;
}

.mode-text p {
  font-size: 0.82rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.chevron {
  font-size: 1.4rem;
  color: var(--text-dim);
  transition: transform 0.25s;
  line-height: 1;
  flex-shrink: 0;
}

.chevron.open {
  transform: rotate(90deg);
  color: var(--accent-light);
}

.mode-badge {
  display: inline-block;
  background: var(--accent-glow);
  border: 1px solid var(--accent);
  color: var(--accent-light);
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.15rem 0.55rem;
  border-radius: 50px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
}

.online-card:hover {
  border-color: #22c55e;
  box-shadow: 0 8px 30px rgba(34, 197, 94, 0.1);
}

.online-badge {
  background: rgba(34, 197, 94, 0.12);
  border-color: var(--correct);
  color: var(--correct);
}

.group-card:hover {
  border-color: #f59e0b;
  box-shadow: 0 8px 30px rgba(245, 158, 11, 0.1);
}

.group-badge {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.5);
  color: #fcd34d;
}

/* Bot sub-options */
.bot-sub-options {
  border-top: 1px solid var(--border);
  background: var(--surface2);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
}

.sub-option {
  background: none;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.9rem 1rem;
  border-radius: var(--radius-sm);
  text-align: left;
  transition: background 0.15s;
  width: 100%;
}

.sub-option:hover {
  background: var(--surface3);
}

.sub-option:active {
  transform: scale(0.98);
}

.sub-icon {
  font-size: 1.6rem;
  flex-shrink: 0;
}

.sub-text {
  flex: 1;
}

.sub-text strong {
  display: block;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.15rem;
}

.sub-text p {
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.35;
}

.sub-divider {
  height: 1px;
  background: var(--border);
  margin: 0 0.5rem;
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: opacity 0.2s, transform 0.2s;
  transform-origin: top;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: scaleY(0.85);
}

/* Rules */
.rules {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem 1.5rem;
}

.rules h3 {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.75rem;
}

.rules ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.rules li {
  font-size: 0.88rem;
  color: var(--text-muted);
}
</style>
