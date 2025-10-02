<template>
  <aside class="app-sidebar">
    <nav>
      <RouterLink to="/match">Match</RouterLink>
      <RouterLink to="/chats">Chats</RouterLink>
      <RouterLink to="/ai-roles/new">New AI Role</RouterLink>
      <RouterLink to="/store">Store</RouterLink>
      <RouterLink to="/profile">Profile</RouterLink>
    </nav>
  </aside>
</template>

<script setup>
import { RouterLink } from 'vue-router';
</script>

<style scoped>
.app-sidebar {
  display: flex;
  flex-direction: column;
  width: 200px;
  background: #0d1117;
  border-right: 1px solid #2c2c2c;
  padding: 1rem;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

a {
  color: #9ca3af;
  text-decoration: none;
  font-weight: 500;
}

a.router-link-active {
  color: #f9fafb;
}
</style>
