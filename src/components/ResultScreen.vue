<template>
  <div class="result-screen">

    <!-- Confetti canvas -->
    <canvas v-if="confettiActive" ref="confettiCanvas" class="confetti-canvas" />

    <div class="result-card" :class="resultStyle">
      <div class="result-icon">{{ resultIcon }}</div>
      <h2 class="result-title">{{ resultTitle }}</h2>
      <p class="result-sub">{{ resultSub }}</p>

      <div class="movie-reveal">
        <span class="reveal-label">The movie was</span>
        <span class="reveal-movie">{{ store.movieWord }}</span>
      </div>

      <div class="stats-row">
        <div class="stat-box">
          <span class="stat-val correct-text">{{ store.correctGuesses.length }}</span>
          <span class="stat-lbl">Correct</span>
        </div>
        <div class="stat-box">
          <span class="stat-val wrong-text">{{ store.wrongGuesses.length }}</span>
          <span class="stat-lbl">Wrong</span>
        </div>
        <div class="stat-box">
          <span class="stat-val">{{ store.lives }}</span>
          <span class="stat-lbl">Lives left</span>
        </div>
        <div class="stat-box">
          <span class="stat-val">{{ store.guessedLetters.length }}</span>
          <span class="stat-lbl">Total guesses</span>
        </div>
      </div>

      <div class="result-actions">
        <button class="btn-primary" @click="store.playAgain()">
          {{ nextLabel }}
        </button>
        <button class="btn-secondary" @click="store.goHome()">← Home</button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useGameStore } from '../stores/game.js'

const store = useGameStore()

const guesserWon = computed(() => store.winner === 'guesser')

const resultIcon = computed(() => {
  if (store.mode === 'online') return guesserWon.value ? '🎉' : '🏆'
  if (store.mode === 'bot') {
    if (store.botSubMode === 'player-guesses') return guesserWon.value ? '🎉' : '🤖'
    return guesserWon.value ? '🤖' : '🏆'
  }
  return guesserWon.value ? '🎉' : '🏆'
})

const resultTitle = computed(() => {
  if (store.mode === 'online') {
    if (store.onlineRole === 'guesser') {
      return guesserWon.value ? 'You Win! 🎉' : 'Friend Wins! 🏆'
    }
    return guesserWon.value ? 'Friend Wins! 🎉' : 'You Win! 🏆'
  }
  if (store.mode === 'bot') {
    if (store.botSubMode === 'player-guesses') {
      return guesserWon.value ? 'You Win! 🎉' : 'Bot Wins! 🤖'
    }
    return guesserWon.value ? 'Bot Wins! 🤖' : 'You Win! 🏆'
  }
  return guesserWon.value ? 'Guesser Wins! 🎉' : 'Setter Wins! 🏆'
})

const resultSub = computed(() => {
  if (store.mode === 'online') {
    if (store.onlineRole === 'guesser') {
      return guesserWon.value
        ? 'You cracked it! Great guessing! 🎬'
        : "Your friend's movie stumped you! 🏆"
    }
    return guesserWon.value
      ? 'Your friend guessed your movie! 🎮'
      : 'You stumped your friend! Great pick! 🎬'
  }
  if (store.mode === 'bot') {
    if (store.botSubMode === 'player-guesses') {
      return guesserWon.value
        ? "You cracked the bot's mystery movie! 🎬"
        : 'The bot stumped you! Try again 🤖'
    }
    return guesserWon.value
      ? 'The bot cracked your movie! 🤖'
      : 'You stumped the bot! Great pick! 🎬'
  }
  return guesserWon.value ? 'The guesser figured it out!' : "The setter's movie held strong!"
})

const resultStyle = computed(() => (guesserWon.value ? 'guesser-wins' : 'setter-wins'))

const nextLabel = computed(() => {
  if (store.mode === 'online') return 'Play Again 🌐'
  return 'Play Again'
})

// ── Confetti ────────────────────────────────────────────────────────────────

const confettiCanvas = ref(null)
const confettiActive = ref(false)
let animFrame = null

function shouldShowConfetti() {
  if (store.mode === 'bot' && store.botSubMode === 'bot-guesses') return store.winner === 'setter'
  return store.winner === 'guesser'
}

function startConfetti() {
  if (!confettiCanvas.value) return
  const canvas = confettiCanvas.value
  const ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const colors = ['#a78bfa', '#22c55e', '#f59e0b', '#3b82f6', '#f472b6', '#34d399', '#fbbf24']
  const particles = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.4,
    size: Math.random() * 9 + 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    isCircle: Math.random() > 0.5,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 3.5 + 1.8,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.14,
  }))

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    let anyOnScreen = false
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.055
      p.vx *= 0.995
      p.angle += p.spin
      if (p.y < canvas.height + 30) anyOnScreen = true
      if (p.y > canvas.height + 30 || p.x < -40 || p.x > canvas.width + 40) continue
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle)
      ctx.fillStyle = p.color
      if (p.isCircle) {
        ctx.beginPath()
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      }
      ctx.restore()
    }
    if (anyOnScreen) animFrame = requestAnimationFrame(animate)
    else confettiActive.value = false
  }
  animFrame = requestAnimationFrame(animate)
}

onMounted(async () => {
  if (shouldShowConfetti()) {
    confettiActive.value = true
    await nextTick()
    setTimeout(startConfetti, 350)
  }
})

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame)
})
</script>

<style scoped>
.confetti-canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 200;
}

.result-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1.5rem 0;
}

.result-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2.5rem 2rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  text-align: center;
  animation: bounce-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.result-card.guesser-wins {
  border-color: var(--correct);
  box-shadow: 0 0 40px rgba(34, 197, 94, 0.1);
}

.result-card.setter-wins {
  border-color: var(--accent);
  box-shadow: 0 0 40px var(--accent-glow);
}

.result-icon {
  font-size: 3.5rem;
  line-height: 1;
  animation: pop-icon 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
}

.result-title {
  font-size: 1.8rem;
  font-weight: 800;
}

.guesser-wins .result-title { color: var(--correct); }
.setter-wins .result-title { color: var(--accent-light); }

.result-sub {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.movie-reveal {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 1rem 1.5rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.reveal-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  font-weight: 600;
}

.reveal-movie {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
  word-break: break-word;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  width: 100%;
}

.stat-box {
  background: var(--surface2);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.stat-val {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--text);
}

.stat-val.correct-text { color: var(--correct); }
.stat-val.wrong-text { color: var(--wrong); }

.stat-lbl {
  font-size: 0.62rem;
  color: var(--text-dim);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.result-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.25rem;
}

@keyframes pop-icon {
  0% { transform: scale(0); opacity: 0; }
  70% { transform: scale(1.25); }
  100% { transform: scale(1); opacity: 1; }
}
</style>
