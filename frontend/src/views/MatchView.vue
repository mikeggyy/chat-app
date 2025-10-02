<template>
  <section class="match-screen">
    <div class="match-screen__card-area">
      <Transition name="card" mode="out-in">
        <div
          v-if="isLoadingDeck && !currentCard"
          key="loading"
          class="loading-state"
        >
          <BaseLoadingSpinner :show-label="true" label="配對資料載入中⋯" />
        </div>

        <article
          v-else-if="currentCard"
          :key="currentCardKey"
          class="match-card"
          :style="cardStyle"
          @pointerdown="startDrag"
          @pointermove="onDrag"
          @pointerup="endDrag"
          @pointercancel="endDrag"
          @pointerleave="onPointerLeave"
        >
          <div class="match-card__surface">
            <div class="match-card__swipe-hints">
              <div class="match-card__hint match-card__hint--left">
                <span class="match-card__hint-icon">←</span>
              </div>
              <div class="match-card__hint match-card__hint--center">
                拖曳卡片來探索
              </div>
              <div class="match-card__hint match-card__hint--right">
                <span class="match-card__hint-icon">→</span>
              </div>
            </div>
            <img
              :src="currentCard.image"
              :alt="currentCard.name"
              class="match-card__image"
            />
            <div class="match-card__shade" />

            <div class="match-card__details">
              <div class="match-card__copy">
                <h3 class="match-card__name">{{ currentCard.name }}</h3>
                <p class="match-card__bio">{{ currentCard.bio }}</p>
              </div>

              <ul class="match-card__tags">
                <li
                  v-for="tag in currentCard.tags"
                  :key="tag"
                  class="match-card__tag"
                >
                  {{ tag }}
                </li>
              </ul>

              <div class="match-card__buttons">
                <button
                  class="ghost"
                  @click="handleFavoriteToggle"
                  :disabled="isProcessing"
                >
                  {{ favoriteButtonLabel }}
                </button>
                <button
                  class="cta"
                  @click="handleEnterChat"
                  :disabled="isProcessing"
                >
                  開始聊天
                </button>
              </div>
            </div>
          </div>
        </article>

        <div v-else-if="hasAttemptedLoad" key="empty" class="empty-state">
          <h3>還沒有可以配對的角色</h3>
          <p>調整條件或建立新的 AI 夥伴讓我們重新為你配對。</p>
          <button class="ghost" @click="resetDeck" :disabled="isLoadingDeck">
            重新整理牌組
          </button>
        </div>

        <div v-else key="idle" class="loading-placeholder" aria-hidden="true" />
      </Transition>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import BaseLoadingSpinner from "../components/BaseLoadingSpinner.vue";
import {
  fetchMatchDeck,
  favoriteMatchCard,
  unfavoriteMatchCard,
} from "../services/matchService";
import { useChatStore } from "../stores/chatStore";

const router = useRouter();
const chatStore = useChatStore();

const cards = ref([]);
const currentIndex = ref(0);
const favorites = ref([]);
const isProcessing = ref(false);
const isLoadingDeck = ref(false);
const hasAttemptedLoad = ref(false);
const lastAction = ref(null);
let toastTimer = null;

const dragX = ref(0);
const dragY = ref(0);
const isDragging = ref(false);
const startPointer = { x: 0, y: 0 };
const swipeThreshold = 120;

const currentCard = computed(() => cards.value[currentIndex.value] ?? null);
const currentCardKey = computed(() =>
  currentCard.value ? `${currentCard.value.id}-${currentIndex.value}` : "empty"
);
const favoriteButtonLabel = computed(() =>
  currentCard.value?.isFavorite ? "取消收藏" : "收藏"
);

const cardStyle = computed(() => {
  const translate = `translate3d(${dragX.value}px, ${dragY.value}px, 0)`;
  const rotate = `rotate(${dragX.value * 0.04}deg)`;
  const opacity = 1 - Math.min(Math.abs(dragX.value) / 400, 0.35);
  return {
    transform: `${translate} ${rotate}`,
    opacity: Math.max(opacity, 0.65),
    transition: isDragging.value
      ? "none"
      : "transform 0.25s ease, opacity 0.25s ease",
  };
});

function normalizeMatchCard(card) {
  if (!card) return null;

  const tags = Array.isArray(card.tags) ? card.tags : [];
  const metrics =
    typeof card.metrics === "object" && card.metrics !== null
      ? card.metrics
      : {};

  const sampleMessages = Array.isArray(card.sampleMessages)
    ? card.sampleMessages
        .map((message) => (typeof message === "string" ? message.trim() : ""))
        .filter(Boolean)
    : [];

  return {
    id: card.id,
    name: card.name ?? "",
    persona: card.persona ?? "",
    bio: card.summary ?? card.persona ?? card.bio ?? "",
    tags,
    image: card.portraitImageUrl ?? card.coverImageUrl ?? card.image ?? "",
    sampleMessages,
    metrics,
    isFavorite: Boolean(card.isFavorite),
  };
}

async function loadDeck({ resetIndex = true } = {}) {
  if (isLoadingDeck.value) return;

  isLoadingDeck.value = true;
  try {
    const response = await fetchMatchDeck();
    const rawCards = Array.isArray(response?.data) ? response.data : [];
    const normalizedCards = rawCards
      .map((rawCard) => normalizeMatchCard(rawCard))
      .filter((card) => card && card.id);

    const favoritesList = Array.isArray(response?.favorites)
      ? Array.from(new Set(response.favorites))
      : [];
    const favoritesSet = new Set(favoritesList);

    cards.value = normalizedCards.map((card) => ({
      ...card,
      isFavorite: card.isFavorite || favoritesSet.has(card.id),
    }));
    favorites.value = favoritesList;

    if (resetIndex || currentIndex.value >= cards.value.length) {
      currentIndex.value = 0;
    }

    lastAction.value = null;
  } catch (error) {
    console.error("[match] failed to load deck", error);
    cards.value = [];
    favorites.value = [];
    setLastAction("error", { message: error.message ?? "無法載入配對列表" });
  } finally {
    isLoadingDeck.value = false;
    hasAttemptedLoad.value = true;
  }
}

function setLastAction(type, payload = {}) {
  lastAction.value = { type, ...payload, timestamp: Date.now() };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    lastAction.value = null;
    toastTimer = null;
  }, 2200);
}

async function handleFavoriteToggle() {
  if (isProcessing.value || !currentCard.value) return;

  isProcessing.value = true;
  const activeIndex = currentIndex.value;
  const activeCard = cards.value[activeIndex];

  if (!activeCard) {
    isProcessing.value = false;
    return;
  }

  const cardId = activeCard.id;
  const cardName = activeCard.name;

  try {
    if (activeCard.isFavorite) {
      await unfavoriteMatchCard(cardId);
      favorites.value = favorites.value.filter((id) => id !== cardId);

      if (cards.value[activeIndex]?.id === cardId) {
        cards.value[activeIndex] = {
          ...cards.value[activeIndex],
          isFavorite: false,
        };
      }

      setLastAction("unfavorite", { name: cardName });
    } else {
      const response = await favoriteMatchCard(cardId);
      const favoriteRecord = response?.data;
      const favoriteId = favoriteRecord?.roleId ?? cardId;

      if (!favorites.value.includes(favoriteId)) {
        favorites.value = [...favorites.value, favoriteId];
      }

      const updatedCard = response?.card
        ? normalizeMatchCard(response.card)
        : null;

      if (cards.value[activeIndex]?.id === cardId) {
        cards.value[activeIndex] = {
          ...cards.value[activeIndex],
          ...(updatedCard ?? {}),
          isFavorite: true,
        };
      }

      setLastAction("favorite", { name: cardName });
    }
  } catch (error) {
    console.error("[match] toggle favorite failed", error);
    setLastAction("error", {
      message: error.message ?? "收藏狀態更新失敗，請稍後再試",
    });
  } finally {
    isProcessing.value = false;
  }
}

async function handleEnterChat() {
  if (isProcessing.value || !currentCard.value) return;

  const card = currentCard.value;
  isProcessing.value = true;

  const sampleMessages = Array.isArray(card.sampleMessages)
    ? card.sampleMessages
        .map((message) => (typeof message === "string" ? message.trim() : ""))
        .filter(Boolean)
    : [];

  const metadata = {
    aiName: card.name ?? "AI 夥伴",
    aiPersona: card.persona ?? "",
    bio: card.bio ?? card.persona ?? "",
    tags: Array.isArray(card.tags) ? card.tags : [],
    image: card.image || null,
    sampleMessages,
    isFavorite: Boolean(card.isFavorite),
    card: {
      id: card.id,
      name: card.name ?? "AI 夥伴",
      persona: card.persona ?? "",
      summary: card.bio ?? card.persona ?? "",
      tags: Array.isArray(card.tags) ? card.tags : [],
      portraitImageUrl: card.image || null,
      coverImageUrl: card.image || null,
      sampleMessages,
    },
  };

  try {
    await chatStore.ensureConversation(card.id, metadata);
    chatStore.selectConversation(card.id);

    await router
      .push({ name: "chatDetail", params: { conversationId: card.id } })
      .catch(() => {});
  } catch (error) {
    console.error("[match] failed to ensure conversation", error);
    setLastAction("error", {
      message: error?.message ?? "無法開啟對話，請稍後再試",
    });
  } finally {
    isProcessing.value = false;
  }
}

function advanceIndex(step = 1) {
  const length = cards.value.length;
  if (!length) return;
  currentIndex.value = (currentIndex.value + step + length) % length;
}

function advanceCard(step) {
  if (isProcessing.value || !currentCard.value) return;
  isProcessing.value = true;
  advanceIndex(step);
  setLastAction(step > 0 ? "advance-next" : "advance-prev");
  setTimeout(() => {
    isProcessing.value = false;
  }, 160);
}

async function resetDeck() {
  if (isProcessing.value || isLoadingDeck.value) return;
  await loadDeck({ resetIndex: true });
}

function handleKeydown(event) {
  if (isProcessing.value) return;
  if (event.key === "ArrowLeft") {
    advanceCard(-1);
  } else if (event.key === "ArrowRight") {
    advanceCard(1);
  }
}

function startDrag(event) {
  if (!event.isPrimary || isProcessing.value || !currentCard.value) return;
  isDragging.value = true;
  startPointer.x = event.clientX;
  startPointer.y = event.clientY;
  dragX.value = 0;
  dragY.value = 0;
  event.currentTarget?.setPointerCapture?.(event.pointerId);
}

function onDrag(event) {
  if (!isDragging.value || !event.isPrimary) return;
  dragX.value = event.clientX - startPointer.x;
  dragY.value = event.clientY - startPointer.y;
}

function endDrag(event) {
  if (!isDragging.value || !event.isPrimary) return;
  event.currentTarget?.releasePointerCapture?.(event.pointerId);
  isDragging.value = false;

  const dx = dragX.value;
  const absDx = Math.abs(dx);

  if (absDx > swipeThreshold) {
    const step = dx > 0 ? 1 : -1;
    const slideDistance = (window.innerWidth || 360) * 0.8;
    dragX.value = step > 0 ? slideDistance : -slideDistance;

    setTimeout(() => {
      dragX.value = 0;
      dragY.value = 0;
    }, 200);

    advanceCard(step);
  } else {
    dragX.value = 0;
    dragY.value = 0;
  }
}

function onPointerLeave(event) {
  if (!isDragging.value) return;
  endDrag(event);
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
  loadDeck();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<style scoped>
.match-screen {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 calc(0.6rem + env(safe-area-inset-left, 0px))
    calc(1rem + env(safe-area-inset-bottom, 0px))
    calc(0.6rem + env(safe-area-inset-right, 0px));
}

.match-screen__card-area {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  position: relative;
  padding: 0;
}

.match-card {
  display: flex;
  justify-content: center;
  width: 100%;
}

.match-card__surface {
  position: relative;
  width: min(420px, 100vw);
  height: 83vh;
  overflow: hidden;
  box-shadow: 0 35px 60px rgba(5, 6, 8, 0.6);
  touch-action: none;
}

.match-card__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.match-card__shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(5, 6, 8, 0) 45%,
    rgba(5, 6, 8, 0.55) 78%,
    rgba(5, 6, 8, 0.82) 100%
  );
}

.match-card__swipe-hints {
  position: absolute;
  top: clamp(0.85rem, 3.5vw, 1.6rem);
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0 clamp(1rem, 4vw, 1.8rem);
  pointer-events: none;
  font-size: 0.85rem;
  color: rgba(241, 245, 249, 0.92);
  text-shadow: 0 6px 18px rgba(5, 6, 8, 0.6);
  z-index: 3;
}

.match-card__hint {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.42rem 0.75rem;
  border-radius: 999px;
  background: rgba(15, 17, 27, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.32);
  box-shadow: 0 12px 24px rgba(5, 6, 8, 0.38);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.match-card__hint--left {
  transform: rotate(-5deg);
  animation: match-card-hint-wiggle 2.8s ease-in-out infinite;
}

.match-card__hint--right {
  transform: rotate(5deg);
  animation: match-card-hint-wiggle 2.8s ease-in-out infinite;
  animation-delay: 1.4s;
}

.match-card__hint--center {
  background: rgba(241, 245, 249, 0.12);
  border: 1px dashed rgba(148, 163, 184, 0.4);
  padding: 0.4rem 1rem;
  border-radius: 12px;
  font-weight: 500;
  letter-spacing: 0.08em;
  animation: match-card-hint-pulse 3.2s ease-in-out infinite;
}

.match-card__hint-icon {
  font-size: 1.1rem;
}

.match-card__hint-label {
  white-space: nowrap;
}

@keyframes match-card-hint-wiggle {
  0%,
  100% {
    transform: translateY(0) rotate(-5deg);
  }

  50% {
    transform: translateY(-4px) rotate(-3deg);
  }
}

@keyframes match-card-hint-pulse {
  0%,
  100% {
    opacity: 0.92;
  }

  50% {
    opacity: 0.62;
  }
}

@media (max-width: 420px) {
  .match-card__swipe-hints {
    font-size: 0.78rem;
    gap: 0.5rem;
    padding: 0 0.95rem;
  }

  .match-card__hint {
    padding: 0.38rem 0.65rem;
  }
}
.match-card__details {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: clamp(1.6rem, 4vw, 2.4rem) clamp(1.2rem, 4vw, 2.4rem)
    calc(clamp(1.4rem, 4vw, 2.2rem) + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(
    140deg,
    rgba(255, 255, 255, 0.2) 40%,
    rgba(255, 255, 255, 0.25) 45%,
    rgba(255, 255, 255, 0) 65%
  );
}

.match-card__copy {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: #fff;
}

.match-card__name {
  margin: 0;
  font-size: clamp(1.7rem, 5.5vw, 2.3rem);
  font-weight: 700;
}

.match-card__bio {
  margin: 0;
  line-height: 1.5;
}

.match-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.match-card__tag {
  padding: 0.35rem 0.95rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  background: rgba(59, 130, 246, 0.52);
  border: 1px solid rgba(59, 130, 246, 0.58);
}

.match-card__tag:nth-child(2n) {
  background: rgba(236, 72, 153, 0.52);
  border-color: rgba(236, 72, 153, 0.58);
}

.match-card__tag:nth-child(3n) {
  background: rgba(52, 211, 153, 0.52);
  border-color: rgba(52, 211, 153, 0.58);
}

.match-card__buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.ghost,
.cta {
  border-radius: 999px;
  padding: 0.85rem 1.25rem;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.ghost {
  background: rgba(255, 255, 255, 0.9);
  color: #f472b6;
  border: 1px solid rgba(244, 114, 182, 0.35);
}

.cta {
  background: linear-gradient(135deg, #ff7ac3, #ff4588);
  color: #fff;
}

.ghost:hover:not(:disabled),
.cta:hover:not(:disabled) {
  transform: translateY(-1px);
}

.ghost:disabled,
.cta:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.loading-state {
  width: min(360px, 92vw);
  padding: 3rem 2rem;
  border-radius: 28px;
  border: 1px solid rgba(248, 250, 252, 0.06);
  background: rgba(15, 17, 27, 0.85);
  box-shadow: 0 25px 50px rgba(5, 6, 8, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-placeholder {
  width: min(360px, 92vw);
  min-height: 320px;
  border-radius: 28px;
  opacity: 0;
  pointer-events: none;
}

.empty-state {
  width: min(360px, 92vw);
  padding: 3rem 2rem;
  text-align: center;
  background: rgba(15, 17, 27, 0.85);
  border-radius: 28px;
  border: 1px solid rgba(248, 250, 252, 0.06);
  box-shadow: 0 25px 50px rgba(5, 6, 8, 0.55);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state h3 {
  margin: 0;
  font-size: 1.5rem;
}

.empty-state p {
  margin: 0;
  color: rgba(226, 232, 240, 0.8);
}

.card-enter-active,
.card-leave-active {
  transition: all 0.28s ease;
}

.card-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}

.card-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.98);
}

@media (max-width: 520px) {
  .match-screen {
    padding: 0;
  }

  .match-card__surface {
    height: 91vh;
    height: min(91vh, 91dvh);
  }
}
</style>
