<template>
  <div v-if="open" class="avatar-cropper" role="dialog" aria-modal="true">
    <div class="avatar-cropper__backdrop" aria-hidden="true"></div>
    <div class="avatar-cropper__panel">
      <header class="avatar-cropper__header">
        <h3 class="avatar-cropper__title">調整頭像</h3>
        <button
          type="button"
          class="avatar-cropper__close"
          aria-label="關閉"
          @click="handleClose"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <section class="avatar-cropper__body">
        <div
          class="avatar-cropper__canvas"
          :class="{ 'avatar-cropper__canvas--loading': !isReady }"
        >
          <img ref="imageElement" :src="imageUrl" alt="頭像裁切預覽" />
        </div>
        <p class="avatar-cropper__hint">
          拖曳圖片調整位置，使用滑鼠滾輪或手勢縮放。
        </p>
      </section>
      <footer class="avatar-cropper__footer">
        <span v-if="error" class="avatar-cropper__error">{{ error }}</span>
        <div class="avatar-cropper__actions">
          <button
            type="button"
            class="avatar-cropper__button avatar-cropper__button--ghost"
            :disabled="submitting"
            @click="handleClose"
          >
            取消
          </button>
          <button
            type="button"
            class="avatar-cropper__button avatar-cropper__button--primary"
            :disabled="!isReady || submitting"
            @click="emitConfirm"
          >
            {{ submitting ? "儲存中..." : "套用" }}
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  imageUrl: {
    type: String,
    default: "",
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["close", "confirm"]);

const imageElement = ref(null);
const cropper = ref(null);
const isReady = ref(false);
let previousBodyOverflow = null;

function lockBodyScroll() {
  if (typeof document === "undefined") {
    return;
  }
  const body = document.body;
  if (!body) {
    return;
  }
  if (previousBodyOverflow === null) {
    previousBodyOverflow = body.style.overflow || "";
  }
  body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  if (typeof document === "undefined") {
    return;
  }
  const body = document.body;
  if (!body) {
    return;
  }
  if (previousBodyOverflow !== null) {
    body.style.overflow = previousBodyOverflow;
    previousBodyOverflow = null;
    return;
  }
  if (body.style.overflow === "hidden") {
    body.style.removeProperty("overflow");
  }
}

function destroyCropper() {
  if (cropper.value) {
    cropper.value.destroy();
    cropper.value = null;
  }
  isReady.value = false;
}

async function createCropper() {
  destroyCropper();
  if (!props.open || !props.imageUrl) {
    return;
  }
  await nextTick();
  if (!imageElement.value) {
    return;
  }
  cropper.value = new Cropper(imageElement.value, {
    aspectRatio: 1,
    viewMode: 2,
    dragMode: "none",
    responsive: true,
    autoCropArea: 0.75,
    background: false,
    checkOrientation: false,
    modal: true,
    guides: false,
    highlight: false,
    zoomOnTouch: true,
    zoomOnWheel: true,
    movable: false,
    zoomable: true,
    scalable: false,
    cropBoxMovable: true,
    cropBoxResizable: false,
    toggleDragModeOnDblclick: false,
    center: false,
    ready() {
      const instance = cropper.value;
      if (instance) {
        instance.reset();
        const container = instance.getContainerData();
        const size = Math.min(container.width, container.height) * 0.75;
        instance.setCropBoxData({
          left: (container.width - size) / 2,
          top: (container.height - size) / 2,
          width: size,
          height: size,
        });
        const canvasData = instance.getCanvasData();
        const desiredLeft = (container.width - canvasData.width) / 2;
        instance.setCanvasData({
          ...canvasData,
          left: desiredLeft,
          top: 0,
        });
      }
      isReady.value = true;
    },
  });
}

watch(
  () => [props.open, props.imageUrl],
  async ([open]) => {
    if (open) {
      lockBodyScroll();
    } else {
      unlockBodyScroll();
    }
    if (open && props.imageUrl) {
      await createCropper();
    } else {
      destroyCropper();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  destroyCropper();
  unlockBodyScroll();
});

function handleClose() {
  if (props.submitting) {
    return;
  }
  emit("close");
}

function emitConfirm() {
  if (!cropper.value || !isReady.value) {
    return;
  }
  const canvas = cropper.value.getCroppedCanvas({
    width: 512,
    height: 512,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
    fillColor: "#ffffff",
  });
  if (!canvas) {
    return;
  }
  canvas.toBlob(
    (blob) => {
      if (!blob) {
        return;
      }
      const output = blob.type ? blob : new Blob([blob], { type: "image/png" });
      emit("confirm", output);
    },
    "image/png",
    0.92
  );
}
</script>

<style scoped>
.avatar-cropper {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  padding: 0;
}

.avatar-cropper__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(3, 6, 20, 0.78);
  backdrop-filter: blur(6px);
}

.avatar-cropper__panel {
  position: relative;
  width: 100%;
  max-width: none;
  background: linear-gradient(
    180deg,
    rgba(16, 23, 48, 0.96),
    rgba(9, 13, 28, 0.96)
  );
  border-radius: 0;
  padding: clamp(1rem, 2vw, 2.5rem);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: none;
  border: none;
  overflow: auto;
}

.avatar-cropper__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.avatar-cropper__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.avatar-cropper__close {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.avatar-cropper__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.avatar-cropper__canvas {
  position: relative;
  width: clamp(240px, min(calc(100vh - 12rem), calc(100vw - 4rem)), 720px);
  max-width: 100%;
  aspect-ratio: 1;
  border-radius: 1.25rem;
  overflow: hidden;
  background: rgba(9, 13, 28, 0.8);
  flex: none;
}

.avatar-cropper__canvas img {
  display: block;
  max-width: 100%;
}

.avatar-cropper__canvas--loading::after {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.04),
    rgba(255, 255, 255, 0.04) 12px,
    rgba(255, 255, 255, 0.08) 12px,
    rgba(255, 255, 255, 0.08) 24px
  );
  animation: shimmer 1.2s linear infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-20%);
  }
  100% {
    transform: translateX(20%);
  }
}

.avatar-cropper__hint {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
}

.avatar-cropper__footer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-end;
}

.avatar-cropper__error {
  color: #fca5a5;
  font-size: 0.85rem;
}

.avatar-cropper__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.avatar-cropper__button {
  border: none;
  border-radius: 999px;
  padding: 0.6rem 1.4rem;
  font-weight: 600;
  cursor: pointer;
}

.avatar-cropper__button--ghost {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.78);
}

.avatar-cropper__button--primary {
  background: linear-gradient(135deg, #ff7cd6, #ff3fa7);
  color: #fff;
  box-shadow: 0 8px 20px rgba(255, 63, 167, 0.25);
}

.avatar-cropper__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

:deep(.cropper-container) {
  position: absolute;
  inset: 0;
}

:deep(.cropper-drag-box) {
  background: rgba(12, 16, 27, 0.55);
}

:deep(.cropper-crop-box),
:deep(.cropper-view-box) {
  border-radius: 0.35rem;
}

:deep(.cropper-view-box) {
  outline: none;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.75);
}

:deep(.cropper-face) {
  background-color: rgba(9, 13, 28, 0.32);
  cursor: move;
}

@media (max-width: 520px) {
  .avatar-cropper__panel {
    padding: 1.25rem;
  }

  .avatar-cropper__button {
    width: 100%;
  }
}
</style>
