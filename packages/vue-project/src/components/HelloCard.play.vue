<template>
  <div class="card">
    <h2>HelloCard</h2>
    <p>{{ text }}</p>
    <button @click="handler">
      {{ `Now Loading Status: ${loading.value}` }}
    </button>
  </div>
</template>

<script setup>
import { ref } from "@vueplay/reactivity"

const text = "Kebab-case component";
let loading = ref(false);

const handler = () => {
  console.log("click");
  loading.value = !loading.value;
}
</script>

<style scoped>
.card {
  border: 1px solid #c9c9c9;
  padding: 12px;
  margin-top: 12px;
}

button {
  background: #0f5cff;
  color: #fff;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
}
</style>
