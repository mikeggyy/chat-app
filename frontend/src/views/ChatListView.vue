<template>
  <section class="chat-list">
    <nav class="chat-list__tabs" aria-label="全部">
      <button
        type="button"
        :class="[
          'chat-list__tab',
          { 'chat-list__tab--active': activeTab === 'all' },
        ]"
        @click="setActiveTab('all')"
      >
        全部
      </button>
      <button
        type="button"
        :class="[
          'chat-list__tab',
          { 'chat-list__tab--active': activeTab === 'favorites' },
        ]"
        @click="setActiveTab('favorites')"
      >
        收藏
      </button>
    </nav>

    <ul v-if="filteredConversations.length" class="chat-list__items">
      <li
        v-for="conversation in filteredConversations"
        :key="conversation.id"
        class="chat-list__item"
      >
        <div
          class="chat-item"
          :style="getActionStyle(conversation)"
          :data-id="conversation.id"
          :class="{ 'chat-item--open': openSwipeId === conversation.id }"
          @pointerdown="handlePointerDown($event, conversation.id)"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerEnd"
          @pointercancel="handlePointerEnd"
          @pointerleave="handlePointerEnd"
        >
          <RouterLink
            class="chat-item__link"
            :to="`/chats/${conversation.id}`"
            @click="handleLinkClick"
          >
            <div class="chat-item__avatar" v-if="conversation.image">
              <img :src="conversation.image" :alt="conversation.aiName" />
            </div>
            <div class="chat-item__body">
              <div class="chat-item__row">
                <span class="chat-item__name">{{ conversation.aiName }}</span>
                <time class="chat-item__time">{{
                  formatTime(conversation.lastMessageAt)
                }}</time>
              </div>
              <div class="chat-item__row chat-item__row--meta">
                <span class="chat-item__tag">{{
                  conversation.intimacyLabel
                }}</span>
              </div>
              <p class="chat-item__preview">{{ conversation.lastMessage }}</p>
            </div>
          </RouterLink>
          <div class="chat-item__actions">
            <button
              v-if="supportsFavorite(conversation)"
              type="button"
              :class="[
                'chat-item__action',
                'chat-item__action--favorite',
                conversation.isFavorite
                  ? 'chat-item__action--favorite-remove'
                  : 'chat-item__action--favorite-add',
              ]"
              :aria-label="conversation.isFavorite ? '取消收藏' : '收藏'"
              :disabled="isProcessingFavorite(conversation)"
              @click.stop="handleFavoriteToggle(conversation)"
            >
              <span
                v-if="!isProcessingFavorite(conversation)"
                class="chat-item__action-label"
              >
                {{ conversation.isFavorite ? "取消收藏" : "收藏" }}
              </span>
              <span
                v-else
                class="chat-item__action-spinner"
                aria-hidden="true"
              ></span>
            </button>
            <button
              v-if="supportsFavorite(conversation)"
              type="button"
              class="chat-item__action chat-item__action--delete"
              aria-label="刪除對話"
              @click.stop="requestDelete(conversation)"
            >
              <svg
                class="chat-item__action-icon"
                aria-hidden="true"
                viewBox="0 0 24 24"
                focusable="false"
              >
                <path
                  fill="currentColor"
                  d="M9 3.75A1.75 1.75 0 0 1 10.75 2h2.5A1.75 1.75 0 0 1 15 3.75V5h4.25a.75.75 0 0 1 0 1.5h-.574l-.834 13.25A2.25 2.25 0 0 1 15.598 22H8.402a2.25 2.25 0 0 1-2.244-2.25L5.324 6.5H4.75a.75.75 0 0 1 0-1.5H9zm1.5 0v1.25h3V3.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25zM6.83 6.5l.828 13.182a.75.75 0 0 0 .744.818h7.196a.75.75 0 0 0 .744-.818L17.17 6.5zM10 9.25a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-1.5 0v-7A.75.75 0 0 1 10 9.25zm4 0a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-1.5 0v-7a.75.75 0 0 1 .75-.75z"
                />
              </svg>
            </button>
          </div>
        </div>
      </li>
    </ul>

    <p v-else class="chat-list__empty">{{ emptyMessage }}</p>
    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="刪除對話"
      :message="deleteConfirmMessage"
      confirm-label="刪除"
      cancel-label="取消"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
    <BaseToast
      :message="toastMessage"
      :visible="toastVisible"
      :type="toastType"
    />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { useChatStore } from "../stores/chatStore";
import {
  favoriteMatchCard,
  unfavoriteMatchCard,
} from "../services/matchService";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import BaseToast from "../components/BaseToast.vue";

const chatStore = useChatStore();
const activeTab = ref("all");
const openSwipeId = ref(null);
const pointerStartX = ref(0);
const pointerStartY = ref(0);
const currentSwipeId = ref(null);
const activePointerId = ref(null);
const isTrackingSwipe = ref(false);
const showDeleteConfirm = ref(false);
const pendingDeleteId = ref(null);
const pendingDeleteName = ref("");

const favoriteProcessingKeys = ref([]);
const toastMessage = ref("");
const toastVisible = ref(false);
const toastType = ref("success");
let toastTimer = null;

function getActionStyle(conversation) {
  const hasFavorite = supportsFavorite(conversation);
  const width = hasFavorite ? "calc(40px + 0.5rem + 140px)" : "40px";
  return { "--chat-action-width": width };
}

function getFavoriteKey(conversation) {
  if (!conversation || typeof conversation !== "object") return "";
  const candidates = [
    conversation.aiRoleId,
    conversation.roleId,
    conversation.card?.id,
    conversation.conversationId,
    conversation.id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length) {
        return trimmed;
      }
    }
  }
  return "";
}

function supportsFavorite(conversation) {
  return Boolean(getFavoriteKey(conversation));
}

function isProcessingFavorite(conversation) {
  const key = getFavoriteKey(conversation);
  if (!key) return false;
  return favoriteProcessingKeys.value.includes(key);
}

async function refreshConversations() {
  if (chatStore.loading) return;
  try {
    await chatStore.fetchConversations();
  } catch (error) {
    console.error("[chat-list] failed to refresh conversations", error);
  }
}

refreshConversations();

onMounted(() => {
  if (!chatStore.conversations.length) {
    refreshConversations();
  }
});

onBeforeUnmount(() => {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
});

const allConversations = computed(() => chatStore.conversations);
const favoriteConversations = computed(() => chatStore.favoriteConversations);

const filteredConversations = computed(() => {
  const source =
    activeTab.value === "favorites"
      ? favoriteConversations.value
      : allConversations.value;
  return [...source].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
});

const emptyMessage = computed(() =>
  activeTab.value === "favorites"
    ? "尚未收藏任何對話"
    : "目前沒有對話，開始新的聊天吧！"
);

function setActiveTab(tab) {
  activeTab.value = tab;
  openSwipeId.value = null;
}

const timeFormatter = new Intl.DateTimeFormat("zh-TW", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatTime(timestamp) {
  if (!timestamp) return "";
  return timeFormatter.format(new Date(timestamp));
}

const deleteConfirmMessage = computed(() =>
  pendingDeleteName.value
    ? `確定要刪除與 ${pendingDeleteName.value} 的對話嗎？`
    : "確定要刪除這個對話嗎？"
);

function requestDelete(conversation) {
  pendingDeleteId.value = conversation.id;
  pendingDeleteName.value = (conversation.aiName ?? "").trim();
  showDeleteConfirm.value = true;
}

function showToast(message, type = "success") {
  toastMessage.value = message;
  toastType.value = type;
  toastVisible.value = true;

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toastVisible.value = false;
    toastTimer = null;
  }, 800);
}

async function handleFavorite(conversation) {
  const key = getFavoriteKey(conversation);
  if (!key || isProcessingFavorite(conversation)) {
    return;
  }

  favoriteProcessingKeys.value = [...favoriteProcessingKeys.value, key];
  try {
    const response = await favoriteMatchCard(key);
    const record = response?.data ?? null;
    const card = response?.card ?? null;

    conversation.isFavorite = true;

    if (card && typeof card === "object") {
      conversation.card = { ...(conversation.card ?? {}), ...card };
    }

    if (record && typeof record === "object") {
      const levelSource =
        typeof record?.intimacy?.level === "number"
          ? record.intimacy.level
          : conversation?.intimacy?.level;
      const level = Number.isFinite(levelSource) && levelSource > 0 ? Math.trunc(levelSource) : 1;
      const labelCandidate =
        typeof record?.intimacy?.label === "string" && record.intimacy.label.trim()
          ? record.intimacy.label.trim()
          : typeof record?.intimacyLabel === "string" && record.intimacyLabel.trim()
            ? record.intimacyLabel.trim()
            : null;
      const label = labelCandidate ? labelCandidate : '親密度等級 ' + level;

      conversation.intimacy = {
        ...(conversation.intimacy ?? {}),
        ...(record.intimacy ?? {}),
        level,
        label,
      };
      conversation.intimacyLabel = label;
    } else if (conversation.intimacy) {
      const level =
        Number.isFinite(conversation.intimacy.level) && conversation.intimacy.level > 0
          ? Math.trunc(conversation.intimacy.level)
          : 1;
      const label = '親密度等級 ' + level;
      conversation.intimacy = {
        ...(conversation.intimacy ?? {}),
        level,
        label,
      };
      conversation.intimacyLabel = label;
    }

    showToast("已加入收藏", "success");
  } catch (error) {
    console.error("[chat-list] favorite failed", error);
    const message =
      error instanceof Error ? error.message : "加入收藏失敗，請稍後再試";
    window.alert(message);
  } finally {
    favoriteProcessingKeys.value = favoriteProcessingKeys.value.filter(
      (value) => value !== key
    );
  }
}

async function handleUnfavorite(conversation) {
  const key = getFavoriteKey(conversation);
  if (!key || isProcessingFavorite(conversation)) {
    return;
  }

  favoriteProcessingKeys.value = [...favoriteProcessingKeys.value, key];
  try {
    await unfavoriteMatchCard(key);
    chatStore.removeFavoriteByKey(key);
    showToast("已取消收藏", "info");
  } catch (error) {
    console.error("[chat-list] unfavorite failed", error);
    const message =
      error instanceof Error ? error.message : "取消收藏失敗，請稍後再試";
    window.alert(message);
  } finally {
    favoriteProcessingKeys.value = favoriteProcessingKeys.value.filter(
      (value) => value !== key
    );
  }
}

async function handleFavoriteToggle(conversation) {
  if (!conversation || typeof conversation !== "object") {
    return;
  }

  if (!supportsFavorite(conversation)) {
    return;
  }

  if (conversation.isFavorite) {
    await handleUnfavorite(conversation);
  } else {
    await handleFavorite(conversation);
  }
}

function resetPendingDelete() {
  pendingDeleteId.value = null;
  pendingDeleteName.value = "";
}

async function confirmDelete() {
  if (!pendingDeleteId.value) {
    showDeleteConfirm.value = false;
    return;
  }

  const id = pendingDeleteId.value;

  try {
    await chatStore.deleteConversation(id);

    if (openSwipeId.value === id) {
      openSwipeId.value = null;
    }

    showDeleteConfirm.value = false;
    resetPendingDelete();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "刪除對話失敗，請稍後再試";
    window.alert(message);
  }
}

function cancelDelete() {
  showDeleteConfirm.value = false;
  resetPendingDelete();
}

function handlePointerDown(event, conversationId) {
  if (!["touch", "pen", "mouse"].includes(event.pointerType || "mouse")) return;
  if ("isPrimary" in event && event.isPrimary === false) return;

  pointerStartX.value = event.clientX;
  pointerStartY.value = event.clientY;
  currentSwipeId.value = conversationId;
  activePointerId.value = event.pointerId ?? null;
  isTrackingSwipe.value = true;

  if (typeof event.currentTarget?.setPointerCapture === "function") {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
}

function handlePointerMove(event) {
  if (!isTrackingSwipe.value || !currentSwipeId.value) return;
  if (
    activePointerId.value !== null &&
    event.pointerId !== activePointerId.value
  )
    return;

  const deltaX = event.clientX - pointerStartX.value;
  const deltaY = Math.abs(event.clientY - pointerStartY.value);

  if (Math.abs(deltaX) > deltaY && event.cancelable) {
    event.preventDefault();
  }

  if (deltaX < -40) {
    openSwipeId.value = currentSwipeId.value;
  } else if (deltaX > 40) {
    openSwipeId.value = null;
  }
}

function handlePointerEnd(event) {
  if (!isTrackingSwipe.value) return;
  if (
    activePointerId.value !== null &&
    event.pointerId !== activePointerId.value
  )
    return;

  if (typeof event.currentTarget?.releasePointerCapture === "function") {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  isTrackingSwipe.value = false;
  currentSwipeId.value = null;
  activePointerId.value = null;
}

function handleLinkClick() {
  openSwipeId.value = null;
}
</script>

<style scoped>
.chat-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 4rem;
}

.chat-list__header h2 {
  margin: 0;
  font-size: 1.8rem;
  letter-spacing: 0.02em;
}

.chat-list__header p {
  margin: 0.2rem 0 0;
  color: rgba(148, 163, 184, 0.8);
  font-size: 0.95rem;
}

.chat-list__tabs {
  display: inline-flex;
  gap: 1.5rem;
  position: relative;
  justify-content: center;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  padding: 0.75rem;
}

.chat-list__tab {
  position: relative;
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: rgba(148, 163, 184, 0.7);
  cursor: pointer;
  transition: color 0.2s ease;
}

.chat-list__tab--active {
  color: #fff;
}

.chat-list__tab--active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -0.4rem;
  height: 2px;
  background: linear-gradient(
    90deg,
    rgba(244, 114, 182, 0.95),
    rgba(244, 63, 94, 0.95)
  );
  border-radius: 2px;
}

.chat-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chat-list__item {
  position: relative;
}

.chat-item {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: stretch;
  touch-action: pan-y;
  --chat-action-width: 40px;
  --chat-action-gap: 0.9rem;
}

.chat-item__link {
  flex: 1;
  display: flex;
  gap: 0.9rem;
  align-items: stretch;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  /* background: rgba(15, 19, 28, 0.95); */
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-decoration: none;
  color: inherit;
  transform: translateX(0);
  transition: border 0.2s ease, transform 0.2s ease;
}

.chat-item__link:hover {
  border-color: rgba(244, 114, 182, 0.35);
}

.chat-item__avatar {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  overflow: hidden;
  flex-shrink: 0;
}

.chat-item__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.chat-item__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.chat-item__row--meta {
  justify-content: flex-start;
}

.chat-item__name {
  font-weight: 600;
  font-size: 1rem;
}

.chat-item__time {
  color: rgba(148, 163, 184, 0.7);
  font-size: 0.8rem;
}

.chat-item__tag {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.75rem;
  color: rgba(244, 114, 182, 0.95);
  background: rgba(244, 114, 182, 0.15);
}

.chat-item__preview {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(148, 163, 184, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 60vw;
}

.chat-item__actions {
  position: absolute;
  top: 0;
  bottom: 0;
  right: calc(-1 * var(--chat-action-gap));
  margin: auto;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  width: var(--chat-action-width);
  max-width: calc(100% - 2rem);
  transform: translateX(100%);
  transition: transform 0.2s ease, opacity 0.2s ease;
  pointer-events: none;
}

.chat-item__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  height: 40px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    rgba(248, 113, 113, 0.95),
    rgba(220, 38, 38, 0.95)
  );
  color: #fff;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}

.chat-item__action--delete {
  min-width: 40px;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 50%;
  font-size: 0;
}

.chat-item__action--favorite {
  min-width: 96px;
  height: 42px;
  padding: 0.45rem 0.95rem;
  font-size: 0.82rem;
}

.chat-item__action--favorite-add {
  background: linear-gradient(135deg, #ff7ac3, #ff4588);
  box-shadow: 0 12px 28px rgba(255, 70, 142, 0.3);
}

.chat-item__action--favorite-remove {
  background: linear-gradient(135deg, #5b21b6, #3730a3);
  box-shadow: 0 12px 28px rgba(59, 61, 176, 0.35);
}

.chat-item__action:disabled {
  opacity: 0.65;
  cursor: wait;
}

.chat-item__action-icon {
  width: 24px;
  height: 24px;
}

.chat-item__action-label {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.chat-item__action-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: chat-item-spin 0.8s linear infinite;
}

@keyframes chat-item-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.chat-item--open .chat-item__actions {
  transform: translateX(-3rem);
  pointer-events: auto;
}

.chat-item--open .chat-item__link {
  transform: translateX(
    calc(-1 * (var(--chat-action-width) + var(--chat-action-gap)))
  );
}

.chat-list__empty {
  margin: 2rem 0 0;
  text-align: center;
  color: rgba(148, 163, 184, 0.75);
}

@media (max-width: 640px) {
  .chat-list {
    gap: 1.25rem;
  }

  .chat-item__link {
    padding: 0.85rem 0.9rem;
  }
}
</style>
