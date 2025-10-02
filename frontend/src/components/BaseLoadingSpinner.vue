<template>
  <div class="spinner" role="status" aria-live="polite">
    <span class="spinner__ring" aria-hidden="true" />
    <span v-if="showLabel" class="spinner__label">{{ label }}</span>
    <span class="spinner__sr">{{ label }}</span>
  </div>
</template>

<script setup>
const props = defineProps({
  label: {
    type: String,
    default: "載入中",
  },
  showLabel: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped>
.spinner {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
}

.spinner__ring {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: #60a5fa;
  animation: spinner-rotate 0.75s linear infinite;
}

.spinner__label {
  font-size: 0.9rem;
  color: rgba(226, 232, 240, 0.85);
  text-align: center;
}

.spinner__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@keyframes spinner-rotate {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
