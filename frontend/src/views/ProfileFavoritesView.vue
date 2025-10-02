<template>
  <section class="favorites-view">
    <header class="favorites-header">
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
      <h1>我的收藏</h1>
    </header>

    <div class="favorites-tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        :class="['tab-button', { active: selectedTab === tab.id }]"
        :aria-selected="selectedTab === tab.id"
        role="tab"
        @click="selectedTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <transition name="fade" mode="out-in">
      <div v-if="!isLoading" :key="selectedTab" class="favorites-grid">
        <article
          v-for="item in activeItems"
          :key="item.id"
          class="favorite-card"
        >
          <button
            type="button"
            class="favorite-action"
            aria-label="取消收藏"
            :disabled="isRemoving(getItemKey(item))"
            @click="handleUnfavorite(item)"
          >
            <span
              v-if="!isRemoving(getItemKey(item))"
              class="favorite-action__label"
            >
              取消收藏
            </span>
            <span
              v-else
              class="favorite-action__spinner"
              aria-hidden="true"
            ></span>
          </button>
          <div class="favorite-image" :style="getCoverStyle(item.cover)" />
          <footer class="favorite-info">
            <h2>{{ item.title }}</h2>
            <p v-if="item.persona" class="favorite-subtitle">{{ item.persona }}</p>
          </footer>
        </article>
      </div>
    </transition>

    <p v-if="isLoading" class="empty-state">載入中...</p>
    <p v-else-if="emptyMessage" class="empty-state">{{ emptyMessage }}</p>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { listMatchFavorites, unfavoriteMatchCard } from '../services/matchService';
import { getAiRoleById, mapAiRoleToCard } from '../data/aiRoles';

const router = useRouter();

const tabs = [{ id: 'roles', label: 'AI 角色' }];
const selectedTab = ref('roles');
const collections = ref({ roles: [] });
const isLoading = ref(false);
const errorMessage = ref('');
const removingIds = ref([]);

const activeItems = computed(() => collections.value[selectedTab.value] ?? []);
const emptyMessage = computed(() => {
  if (errorMessage.value) {
    return errorMessage.value;
  }
  if (!activeItems.value.length) {
    return '目前尚無收藏';
  }
  return '';
});

function getItemKey(item) {
  if (!item || typeof item !== 'object') return '';
  if (typeof item.roleId === 'string' && item.roleId.trim().length) {
    return item.roleId.trim();
  }
  if (typeof item.id === 'string' && item.id.trim().length) {
    return item.id.trim();
  }
  return '';
}

function isRemoving(id) {
  if (!id) return false;
  return removingIds.value.includes(id);
}

function getCoverStyle(cover) {
  if (cover) {
    return { backgroundImage: 'url(' + cover + ')' };
  }
  return {
    backgroundImage:
      'linear-gradient(135deg, rgba(59, 130, 246, 0.55), rgba(236, 72, 153, 0.55))',
  };
}

async function handleUnfavorite(item) {
  const roleId = getItemKey(item);
  if (!roleId || isRemoving(roleId)) {
    return;
  }

  removingIds.value = [...removingIds.value, roleId];
  try {
    await unfavoriteMatchCard(roleId);
    collections.value.roles = collections.value.roles.filter(
      (entry) => getItemKey(entry) !== roleId
    );
  } catch (error) {
    console.error('[favorites] unfavorite failed', error);
    const message = error instanceof Error ? error.message : '取消收藏失敗，請稍後再試';
    window.alert(message);
  } finally {
    removingIds.value = removingIds.value.filter((value) => value !== roleId);
  }
}

async function loadFavorites() {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const response = await listMatchFavorites();
    const responseCards = Array.isArray(response?.cards) ? response.cards : [];
    const favorites = Array.isArray(response?.data) ? response.data : [];

    const items = (responseCards.length ? responseCards : favorites)
      .map((entry) => {
        const card = entry?.card && typeof entry.card === 'object' ? entry.card : null;
        const roleId =
          entry?.roleId ?? entry?.id ?? entry?.aiRoleId ?? entry?.cardId ?? card?.id ?? '';
        const role = roleId ? getAiRoleById(roleId) : null;
        const cardDetails = role ? mapAiRoleToCard(role) : null;

        const title =
          entry?.name ?? card?.name ?? cardDetails?.name ?? role?.name ?? '';
        const persona =
          entry?.persona ??
          card?.persona ??
          cardDetails?.persona ??
          role?.persona ??
          '';
        const cover =
          entry?.portraitImageUrl ??
          card?.portraitImageUrl ??
          entry?.coverImageUrl ??
          card?.coverImageUrl ??
          cardDetails?.image ??
          role?.image ??
          '';
        const lastMessage = typeof entry?.lastMessage === 'string' ? entry.lastMessage : '';
        const lastMessageAt =
          typeof entry?.lastMessageAt === 'number' ? entry.lastMessageAt : null;

        if (!roleId && !title) {
          return null;
        }

        return {
          id: roleId || entry?.id || title,
          roleId: roleId || entry?.id || title,
          title,
          persona,
          cover,
          lastMessage,
          lastMessageAt,
        };
      })
      .filter((item) => item && item.id);

    collections.value.roles = items;
  } catch (error) {
    console.error('[favorites] load failed', error);
    errorMessage.value = error.message ?? '無法載入收藏';
    collections.value.roles = [];
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  router.back();
}

onMounted(() => {
  loadFavorites();
});
</script>

<style scoped>
.favorites-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.25rem;
  padding-top: 0.75rem;
}

.favorites-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.favorites-header h1 {
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

.favorites-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  padding: 0.3rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
}

.tab-button {
  border: none;
  border-radius: 999px;
  padding: 0.55rem 1rem;
  font-weight: 600;
  font-size: 0.95rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
}

.tab-button.active {
  background: linear-gradient(135deg, #ff78d2, #ff3fa7);
  color: #fff;
  box-shadow: 0 10px 18px rgba(255, 104, 188, 0.35);
}

.favorites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 1rem;
}

.favorite-card {
  position: relative;
  border-radius: 1.1rem;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 124, 207, 0.45);
  display: flex;
  flex-direction: column;
  min-height: 180px;
}

.favorite-action {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  border: none;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  min-height: 34px;
  min-width: 96px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  background: rgba(15, 23, 42, 0.65);
  color: rgba(248, 113, 113, 0.95);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 6px 14px rgba(248, 113, 113, 0.35);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.favorite-action:hover:not([disabled]) {
  transform: scale(1.05);
}

.favorite-action:disabled {
  opacity: 0.65;
  cursor: wait;
}

.favorite-action__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(248, 113, 113, 0.35);
  border-top-color: rgba(248, 113, 113, 0.95);
  border-radius: 50%;
  animation: favorite-spin 0.8s linear infinite;
}

.favorite-action__label {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  color: inherit;
  line-height: 1;
}

@keyframes favorite-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.favorite-image {
  flex: 1;
  background-position: center;
  background-size: cover;
}

.favorite-info {
  padding: 0.75rem;
  background: rgba(9, 9, 12, 0.65);
}

.favorite-info h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.favorite-subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.65);
}

.empty-state {
  text-align: center;
  color: rgba(255, 255, 255, 0.45);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>





