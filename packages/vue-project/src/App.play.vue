<template>
  <div class="app">
    <h1>VuePlay</h1>
    <p>Minimal setup + SFC compiler example. {{ message }}</p>
    <hello-card :pop="messageChange" />
    <InfoPanel :detail="message" />
  </div>
</template>

<script setup>
import { ref } from "@vueplay/reactivity"
import HelloCard from "./components/HelloCard.play.vue";
import InfoPanel from "./components/InfoPanel.play.vue";

const message = ref("Hello VuePlay");

const messageChange = () => {
  message.value += " wow!";
}
</script>

<style>
.app {
  font-family: Georgia, "Times New Roman", serif;
  padding: 32px;
}

h1 {
  margin: 0 0 8px;
}

.count {
  margin: 8px 0px;
  color: red;
}
</style>
