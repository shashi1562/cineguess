<template>
  <div v-if="store.screen === 'loading'" class="loading-screen">
    <div class="loading-spinner"></div>
    <p>Reconnecting…</p>
  </div>
  <Transition v-else name="screen" mode="out-in">
    <HomeScreen v-if="store.screen === 'home'" key="home" />
    <GroupScreen v-else-if="store.screen === 'group'" key="group" />
    <OnlineScreen v-else-if="store.screen === 'online'" key="online" />
    <SetupScreen v-else-if="store.screen === 'setup'" :key="'setup-' + store.setupVersion" />
    <GameScreen v-else-if="store.screen === 'game'" key="game" />
    <ResultScreen v-else-if="store.screen === 'result'" key="result" />
  </Transition>
</template>

<script setup>
import { watch, onMounted } from 'vue'
import { useGameStore } from './stores/game.js'
import HomeScreen from './components/HomeScreen.vue'
import GroupScreen from './components/GroupScreen.vue'
import OnlineScreen from './components/OnlineScreen.vue'
import SetupScreen from './components/SetupScreen.vue'
import GameScreen from './components/GameScreen.vue'
import ResultScreen from './components/ResultScreen.vue'

const store = useGameStore()

watch(() => store.screen, () => window.scrollTo(0, 0))

onMounted(async () => {
  await store.resumeSession()
})

</script>
