<template>
  <section class="panel">
    <h2>InfoPanel</h2>
    <p>{{ detail }}</p>
    <p class="count">Now Count: {{ count.value }}</p>
    <button @click="add">Add</button>
  </section>
</template>

<script setup>
import { ref } from "@vueplay/reactivity"

const detail = "CamelCase component";
let count = ref(0);
const add = () => {
  count.value++;
}
</script>

<style scoped>
.panel {
  border: 1px dashed #9b9b9b;
  padding: 12px;
  margin-top: 12px;
}

button {
  background: #ff7a00;
  color: #1b0b00;
  border: 2px solid #1b0b00;
  padding: 6px 10px;
  border-radius: 999px;
}
</style>
