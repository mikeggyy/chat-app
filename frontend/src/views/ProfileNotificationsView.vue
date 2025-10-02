<template>
  <section class="notifications-view">
    <header class="notifications-header">
      <button
        type="button"
        class="back-button"
        aria-label="返回"
        @click="goBack"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M15.75 4.5 8.25 12l7.5 7.5"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
          />
        </svg>
      </button>
      <h1>通知</h1>
    </header>

    <ul v-if="notifications.length" class="notification-list">
      <li v-for="notification in notifications" :key="notification.id">
        <article class="notification-card">
          <div class="notification-text">
            <h2>{{ notification.title }}</h2>
            <p>{{ notification.body }}</p>
          </div>
          <svg class="chevron-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M9 5.25 15.75 12 9 18.75"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
            />
          </svg>
        </article>
      </li>
    </ul>

    <p v-else class="empty-state">目前尚無通知</p>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const notifications = ref([
  {
    id: 'n1',
    title: '通知',
    body: '文字文字文字文字文字文字文字文字文字文字文字文字文字文字文字文字',
  },
  {
    id: 'n2',
    title: '通知',
    body: '文字文字文字文字文字文字文字文字文字文字文字文字文字文字文字文字',
  },
  {
    id: 'n3',
    title: '通知',
    body: '文字文字文字文字文字文字文字文字文字文字文字文字文字文字文字文字',
  },
]);

function goBack() {
  router.back();
}
</script>

<style scoped>
.notifications-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.25rem;
  padding-top: 0.75rem;
}

.notifications-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.notifications-header h1 {
  font-size: 1.15rem;
  font-weight: 700;
}

.back-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(232, 232, 255, 0.05);
  color: #f3f4ff;
  display: grid;
  place-items: center;
}

.back-button svg {
  width: 18px;
  height: 18px;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.notification-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.2rem;
  border-radius: 1.1rem;
  background: rgba(245, 237, 255, 0.06);
  color: #f6f0ff;
}

.notification-text h2 {
  font-size: 1rem;
  margin: 0 0 0.35rem;
}

.notification-text p {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
  opacity: 0.75;
}

.chevron-icon {
  width: 20px;
  height: 20px;
  color: rgba(255, 255, 255, 0.55);
}

.empty-state {
  margin: 0 auto;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
}
</style>
