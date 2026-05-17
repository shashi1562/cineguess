import { ref } from 'vue'

let _ctx = null

function getCtx() {
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch { return null }
  }
  if (_ctx?.state === 'suspended') _ctx.resume()
  return _ctx
}

function tone(freq, type, duration, vol = 0.22, delay = 0) {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, t + delay)
  gain.gain.setValueAtTime(vol, t + delay)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + duration)
  osc.start(t + delay)
  osc.stop(t + delay + duration + 0.05)
}

export const isMuted = ref(false)
export function toggleMute() { isMuted.value = !isMuted.value }

function play(fn) { if (!isMuted.value) fn() }

// Pleasant C-E-G ascending arpeggio
export function soundCorrect() {
  play(() => {
    tone(523.25, 'sine', 0.14, 0.22, 0)
    tone(659.25, 'sine', 0.14, 0.22, 0.07)
    tone(783.99, 'sine', 0.18, 0.22, 0.14)
  })
}

// Low sawtooth buzz
export function soundWrong() {
  play(() => {
    tone(200, 'sawtooth', 0.1, 0.28, 0)
    tone(155, 'sawtooth', 0.15, 0.22, 0.09)
  })
}

// Victory fanfare
export function soundWin() {
  play(() => {
    const melody = [523, 659, 784, 1047]
    melody.forEach((f, i) => tone(f, 'sine', 0.3, 0.26, i * 0.1))
    tone(1047, 'sine', 0.7, 0.32, 0.45)
    tone(784, 'sine', 0.5, 0.2, 0.5)
    tone(1047, 'sine', 0.5, 0.3, 0.65)
  })
}

// Descending sad melody
export function soundLose() {
  play(() => {
    const melody = [330, 277, 220, 165]
    melody.forEach((f, i) => tone(f, 'sawtooth', 0.35, 0.25, i * 0.16))
  })
}

// Timer tick (plays when ≤20s remaining)
export function soundTick() {
  play(() => tone(900, 'sine', 0.04, 0.12, 0))
}

// Subtle click for UI interactions
export function soundClick() {
  play(() => tone(700, 'square', 0.04, 0.08, 0))
}
