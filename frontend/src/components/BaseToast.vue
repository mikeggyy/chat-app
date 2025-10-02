<template>
  <Transition name="base-toast">
    <div
      v-if="visible && message"
      class="base-toast"
      :class="[`base-toast--${type}`]"
      role="status"
      aria-live="polite"
    >
      <span class="base-toast__message">{{ message }}</span>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  message: {
    type: String,
    default: "",
  },
  visible: {
    type: Boolean,
    default: false,
  },
  type: {
    type: String,
    default: "info",
    validator: (value) =>
      ["info", "success", "error", "warning"].includes(value),
  },
});
</script>

<style scoped>
.base-toast {
  position: fixed;
  left: 50%;
  bottom: 5.6rem;
  transform: translate(-50%, 0);
  min-width: 200px;
  max-width: min(88vw, 320px);
  padding: 0.75rem 1.25rem;
  border-radius: 16px;
  color: #f8fafc;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-shadow: 0 18px 45px rgba(2, 6, 23, 0.45);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(148, 163, 184, 0.16);
  z-index: 2200;
}

.base-toast__message {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-toast--info {
  background: linear-gradient(
    135deg,
    rgba(14, 165, 233, 0.9),
    rgba(37, 99, 235, 0.92)
  );
}

.base-toast--success {
  background: linear-gradient(
    135deg,
    rgba(236, 72, 153, 0.92),
    rgba(192, 38, 211, 0.92)
  );
}

.base-toast--error {
  background: linear-gradient(
    135deg,
    rgba(248, 113, 113, 0.95),
    rgba(220, 38, 38, 0.95)
  );
}

.base-toast--warning {
  background: linear-gradient(
    135deg,
    rgba(250, 204, 21, 0.92),
    rgba(217, 119, 6, 0.92)
  );
}

.base-toast-enter-active,
.base-toast-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.base-toast-enter-from,
.base-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 24px);
}
</style>
