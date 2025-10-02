<template>
  <nav class="bottom-nav" aria-label="主選單">
    <RouterLink
      v-for="item in navItems"
      :key="item.name"
      class="bottom-nav__item"
      :class="{ active: isActive(item) }"
      :to="item.to"
    >
      <span class="bottom-nav__icon">{{ item.icon }}</span>
      <span class="bottom-nav__label">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

const navItems = [
  { name: 'match', label: '配對', icon: '💞', to: '/match' },
  { name: 'chatList', label: '聊天', icon: '💬', to: '/chats' },
  { name: 'store', label: '商城', icon: '🛍️', to: '/store' },
  { name: 'profile', label: '我的', icon: '👤', to: '/profile' },
];

const route = useRoute();
const activeRouteName = computed(() => (typeof route.name === 'string' ? route.name : ''));
const activePath = computed(() => route.path);

function isActive(item) {
  const name = activeRouteName.value;
  const path = activePath.value;

  if (item.name && name) {
    if (name === item.name) {
      return true;
    }

    if (name.startsWith(item.name)) {
      return true;
    }
  }

  return path.startsWith(item.to);
}
</script>

<style scoped>
.bottom-nav {
  position: sticky;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-items: center;
  background: rgba(9, 11, 16, 0.95);
  backdrop-filter: blur(16px);
  padding: 0.35rem calc(0.75rem + env(safe-area-inset-left, 0px)) calc(0.35rem + env(safe-area-inset-bottom, 0px))
    calc(0.75rem + env(safe-area-inset-right, 0px));
  border-top: 1px solid rgba(148, 163, 184, 0.14);
}

.bottom-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  text-decoration: none;
  padding: 0.4rem 0;
  color: rgba(226, 232, 240, 0.7);
  font-size: 0.8rem;
  transition: color 0.2s ease;
}

.bottom-nav__item.active {
  color: #fff;
}

.bottom-nav__item.active .bottom-nav__icon {
  transform: translateY(-2px);
}

.bottom-nav__icon {
  font-size: 1.2rem;
  transition: transform 0.2s ease;
}

.bottom-nav__label {
  font-weight: 600;
}
</style>
