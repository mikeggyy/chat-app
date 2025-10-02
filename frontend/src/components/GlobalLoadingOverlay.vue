<template>
  <Transition name="loading-fade">
    <div
      v-if="isLoading"
      class="overlay"
      aria-live="assertive"
    >
      <div class="overlay__backdrop" />
      <div class="overlay__content">
        <BaseLoadingSpinner :show-label="true" :label="label" />
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from "vue";
import BaseLoadingSpinner from "./BaseLoadingSpinner.vue";
import { useLoadingStore } from "../stores/loadingStore";

const props = defineProps({
  label: {
    type: String,
    default: "資料載入中⋯",
  },
});

const loadingStore = useLoadingStore();
const isLoading = computed(() => loadingStore.isLoading);
const label = computed(() => props.label);
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
}

.overlay__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(5, 6, 8, 0.68);
  backdrop-filter: blur(2px);
}

.overlay__content {
  position: relative;
  padding: 2rem 2.5rem;
  border-radius: 18px;
  background: rgba(15, 17, 27, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 20px 40px rgba(2, 3, 5, 0.45);
}

.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.2s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}
</style>
