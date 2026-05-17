<template>
  <Transition name="screen" mode="out-in">
    <HomeScreen v-if="store.screen === 'home'" key="home" />
    <OnlineScreen v-else-if="store.screen === 'online'" key="online" />
    <SetupScreen v-else-if="store.screen === 'setup'" :key="'setup-' + store.setupVersion" />
    <GameScreen v-else-if="store.screen === 'game'" key="game" />
    <ResultScreen v-else-if="store.screen === 'result'" key="result" />
  </Transition>
</template>

<script setup>
import { watch } from 'vue'
import { useGameStore } from './stores/game.js'
import HomeScreen from './components/HomeScreen.vue'
import OnlineScreen from './components/OnlineScreen.vue'
import SetupScreen from './components/SetupScreen.vue'
import GameScreen from './components/GameScreen.vue'
import ResultScreen from './components/ResultScreen.vue'

const store = useGameStore()

watch(() => store.screen, () => window.scrollTo(0, 0))
</script>
