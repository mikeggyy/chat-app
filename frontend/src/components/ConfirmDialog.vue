<template>
  <Teleport to="body">
    <Transition name="confirm-dialog-fade">
      <div
        v-if="modelValue"
        class="confirm-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <div class="confirm-dialog__backdrop" @click="handleBackdrop" />
        <div class="confirm-dialog__panel" role="document">
          <h2 v-if="title" :id="titleId" class="confirm-dialog__title">
            {{ title }}
          </h2>
          <p class="confirm-dialog__message">
            {{ message }}
          </p>
          <div class="confirm-dialog__actions">
            <button
              type="button"
              class="confirm-dialog__button confirm-dialog__button--cancel"
              @click="handleCancel"
            >
              {{ cancelLabel }}
            </button>
            <button
              type="button"
              class="confirm-dialog__button confirm-dialog__button--confirm"
              @click="handleConfirm"
            >
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from "vue";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: "提醒" },
  message: { type: String, required: true },
  confirmLabel: { type: String, default: "確認" },
  cancelLabel: { type: String, default: "取消" },
  closeOnBackdrop: { type: Boolean, default: true },
});

const emit = defineEmits(["update:modelValue", "confirm", "cancel"]);

const uniqueId = Math.random().toString(36).slice(2, 9);
const titleId = computed(() =>
  props.title ? `confirm-dialog-title-${uniqueId}` : undefined
);


function closeDialog() {
  emit("update:modelValue", false);
}

function handleCancel() {
  closeDialog();
  emit("cancel");
}

function handleConfirm() {
  closeDialog();
  emit("confirm");
}

function handleBackdrop() {
  if (!props.closeOnBackdrop) return;
  handleCancel();
}

function handleKeydown(event) {
  if (!props.modelValue) return;
  if (event.key === "Escape") {
    handleCancel();
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});

</script>

<style scoped>
.confirm-dialog {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
}

.confirm-dialog__panel {
  position: relative;
  max-width: 320px;
  width: calc(100% - 2.5rem);
  background: rgba(15, 23, 42, 0.98);
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.35);
  color: #e2e8f0;
}

.confirm-dialog__title {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.confirm-dialog__message {
  margin: 0 0 1.5rem;
  font-size: 0.95rem;
  line-height: 1.5;
}

.confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.confirm-dialog__button {
  border: none;
  border-radius: 999px;
  padding: 0.5rem 1.25rem;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}

.confirm-dialog__button--cancel {
  background: rgba(148, 163, 184, 0.15);
  color: rgba(226, 232, 240, 0.85);
}

.confirm-dialog__button--cancel:hover {
  background: rgba(148, 163, 184, 0.25);
}

.confirm-dialog__button--confirm {
  background: linear-gradient(135deg, rgba(248, 113, 113, 0.95), rgba(220, 38, 38, 0.95));
  color: #fff;
}

.confirm-dialog__button--confirm:hover {
  background: linear-gradient(135deg, rgba(248, 113, 113, 1), rgba(220, 38, 38, 1));
}

.confirm-dialog-fade-enter-active,
.confirm-dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.confirm-dialog-fade-enter-from,
.confirm-dialog-fade-leave-to {
  opacity: 0;
}
</style>

