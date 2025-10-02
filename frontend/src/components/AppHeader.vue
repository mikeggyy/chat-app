<template>
  <header class="app-header">
    <h1 class="app-logo">AI Match</h1>
    <button class="logout-button" @click="$emit('logout')">Log out</button>
  </header>
</template>

<script setup>
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid #2c2c2c;
  background: #11131a;
  color: #f4f7ff;
}

.app-logo {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.logout-button {
  border: none;
  padding: 0.5rem 1rem;
  background: #f06595;
  color: #fff;
  border-radius: 999px;
  cursor: pointer;
}

.logout-button:hover {
  background: #e64980;
}
</style>
