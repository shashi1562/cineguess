# CineGuess 🎬

A multiplayer movie name guessing game — Hangman-style, cinema-themed, built with Vue 3.

Guess a hidden movie title letter by letter. 6 lives. Race the clock. Challenge a friend online or battle the bot.

---

## Features

- **Online Multiplayer** — Create a room, share a 6-character code, play with a friend on any device in real time (Firebase Realtime Database)
- **vs Bot** — Two sub-modes:
  - *You Guess* — Bot picks a mystery movie, you crack it
  - *Bot Guesses* — You set a movie, watch the bot attempt it letter by letter
- **6 Languages** — English, Hindi, Telugu, Tamil, Kannada, Malayalam (200+ movies total)
- **Sound Effects** — Procedural Web Audio API sounds: correct guess, wrong guess, victory fanfare, defeat melody, countdown ticks
- **Physical Keyboard** — Type A–Z directly on desktop; keys animate on press
- **Countdown Timer** — 2.5 min per letter; red pulse + tick sounds in final 20 seconds
- **Confetti** — Canvas-based particle celebration on wins
- **Haptic Feedback** — Vibration patterns on correct/wrong guesses (mobile)
- **Mute Toggle** — Silence sounds any time during the game
- **Rematch** — Play Again in online mode drops both players back to role selection without creating a new room

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| State | Pinia |
| Build | Vite 5 |
| Backend | Firebase Realtime Database |
| Styles | Scoped CSS + CSS custom properties |
| Sounds | Web Audio API (no external files) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Realtime Database enabled

### Install

```bash
npm install
```

### Configure Firebase

Create `src/firebase.js` with your project config:

```js
import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const app = initializeApp({
  apiKey: '...',
  authDomain: '...',
  databaseURL: '...',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...',
})

export const db = getDatabase(app)
```

### Run

```bash
npm run dev       # development server
npm run build     # production build
npm run preview   # preview production build
```

---

## Game Modes

### Online
1. One player creates a room → shares the 6-character code
2. Friend joins with the code
3. Creator picks who guesses
4. Setter enters a movie name (password-masked input)
5. Guesser clicks letters on the QWERTY keyboard (or types them)
6. 6 lives, 2.5-minute timer per guess
7. **Play Again** keeps the room alive and returns both players to role selection instantly

### vs Bot — You Guess
- Select a language → bot picks a random movie from that language's pool
- You guess letters; bot never makes mistakes picking the word

### vs Bot — Bot Guesses
- You enter any movie name → bot guesses a random letter every 1.4 seconds
- Watch the bot's progress; each guess shows ✅ Correct / ❌ Wrong

---

## Project Structure

```
src/
├── components/
│   ├── HomeScreen.vue       # Mode selection (Online, vs Bot)
│   ├── OnlineScreen.vue     # Room lobby — create/join, role select, movie entry
│   ├── SetupScreen.vue      # Language picker + movie entry for local modes
│   ├── GameScreen.vue       # Main gameplay — keyboard, timer, lives, word display
│   └── ResultScreen.vue     # Round result + confetti
├── stores/
│   └── game.js              # Pinia store — all game state + Firebase sync
├── data/
│   └── movies.js            # 200+ movies across 6 languages
├── sounds.js                # Web Audio API sound engine
├── firebase.js              # Firebase initialisation
└── style.css                # Global CSS variables + keyframes
```

---

## Firebase Database Rules (recommended)

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

For production, scope writes to authenticated users or add rate limiting.

---

## Movie Pool

| Language | Movies |
|---|---|
| English | 39 |
| Hindi | 31 |
| Telugu | 30 |
| Tamil | 29 |
| Kannada | 20 |
| Malayalam | 25 |

Movies span a wide difficulty range — classic titles to recent blockbusters.
