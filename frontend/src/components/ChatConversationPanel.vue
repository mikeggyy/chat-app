<template>
  <div class="chat-panel" :style="panelStyle">
    <div class="chat-panel__overlay" />

    <div class="chat-panel__container">
      <header class="chat-panel__header">
        <button
          v-if="showBackButton"
          class="icon-button"
          type="button"
          aria-label="返回上一頁"
          @click="emit('back')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 6 9 12l6 6" />
          </svg>
        </button>

        <div class="chat-panel__title">
          <h2 class="chat-panel__name">{{ cardInfo.name }}</h2>
        </div>

        <button
          class="icon-button"
          type="button"
          aria-label="清除聊天紀錄"
          @click="handleClear"
          :disabled="clearing || loading"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M8 6v-1.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
            <path d="M19 6v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="m10 11 .01 6" />
            <path d="M14 11v6" />
          </svg>
        </button>
      </header>

      <div
        v-if="cardInfo.summary"
        class="chat-panel__summary"
        role="note"
        aria-label="角色簡介"
      >
        <span class="chat-panel__summary-label">角色簡介</span>
        <p class="chat-panel__summary-text">{{ cardInfo.summary }}</p>
      </div>

      <div class="chat-panel__messages" ref="messageList">
        <TransitionGroup
          name="message"
          tag="div"
          class="chat-panel__message-list"
        >
          <article
            v-for="message in messages"
            :key="message.id"
            :class="[
              'message',
              message.sender === 'user' ? 'message--user' : 'message--ai',
            ]"
          >
            <p class="message__text">
              <template
                v-for="(segment, segmentIndex) in buildRichSegments(message.text)"
                :key="`message-${message.id}-${segmentIndex}`"
              >
                <span
                  :class="[
                    'message__segment',
                    segment.type === 'scene' ? 'message__scene' : '',
                    segment.type === 'tone' ? 'message__tone' : '',
                    segment.type === 'action' ? 'message__action' : ''
                  ]"
                >
                  {{ segment.display }}
                </span>
              </template>
            </p>
          </article>
        </TransitionGroup>

        <p v-if="!loading && !messages.length" class="chat-panel__empty">
          還沒有訊息，打聲招呼吧！
        </p>

        <div v-if="loading" class="chat-panel__loading">
          <span class="spinner" aria-hidden="true" />
          <span>載入對話中...</span>
        </div>
      </div>

      <div v-if="suggestions.length" class="chat-panel__suggestions" ref="suggestionContainer">
        <button
          v-for="(suggestion, index) in suggestions"
          :key="`suggestion-${index}`"
          type="button"
          class="suggestion-chip"
          @click="applySuggestion(suggestion)"
        >
          <template
            v-for="(segment, segmentIndex) in buildRichSegments(suggestion)"
            :key="`suggestion-${index}-${segmentIndex}`"
          >
            <span
              :class="[
                'suggestion-chip__segment',
                segment.type === 'scene' ? 'suggestion-chip__scene' : '',
                segment.type === 'tone' ? 'suggestion-chip__tone' : '',
                segment.type === 'action' ? 'suggestion-chip__action' : ''
              ]"
            >
              {{ segment.display }}
            </span>
          </template>
        </button>
      </div>

      <p v-if="error" class="chat-panel__error">{{ error }}</p>

      <form class="chat-panel__composer" @submit.prevent="handleSend">
        <div class="chat-panel__input-wrapper">
          <button
            ref="suggestionButton"
            class="chat-panel__suggestion-button"
            type="button"
            aria-label="產生建議回覆"
            @click="generateSuggestions"
            :disabled="generatingSuggestions || sending || loading"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 3v3" />
              <path d="m16.2 7.8 2.1-2.1" />
              <path d="M21 12h-3" />
              <path d="m16.2 16.2 2.1 2.1" />
              <path d="M12 18v3" />
              <path d="m7.8 16.2-2.1 2.1" />
              <path d="M6 12H3" />
              <path d="m7.8 7.8-2.1-2.1" />
              <circle cx="12" cy="12" r="3.5" />
            </svg>
          </button>

          <textarea
            v-model="draft"
            class="chat-panel__input"
            :placeholder="inputPlaceholder"
            :disabled="sending || loading"
            @keydown="handleComposerKeydown"
          />

          <button
            class="chat-panel__send-button"
            type="submit"
            :disabled="!canSend"
            aria-label="送出訊息"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M21 11.5a8.5 8.5 0 1 0-4.6 7.5l3.6 2.3-.7-4.3a8.47 8.47 0 0 0 1.7-5.5Z"
              />
              <path d="m9 11.5 6 0" />
              <path d="m9 14.5 4 0" />
            </svg>
          </button>
        </div>

        <button
          class="icon-button chat-panel__voice-button"
          type="button"
          :class="{ 'icon-button--active': isListening }"
          @click="toggleVoice"
          :disabled="!voiceSupported || sending"
          aria-label="語音輸入"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
            <path d="M19 11a7 7 0 0 1-14 0" />
            <path d="M12 19v3" />
          </svg>
        </button>
      </form>
      <p v-if="!voiceSupported" class="chat-panel__hint">
        裝置不支援語音輸入，請改用文字輸入。
      </p>
    </div>
    <ConfirmDialog
      v-model="showClearConfirm"
      title="清除聊天紀錄"
      :message="clearConfirmMessage"
      confirm-label="清除"
      cancel-label="取消"
      @confirm="confirmClear"
      @cancel="cancelClear"
    />
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { apiRequest } from "../services/apiClient";
import ConfirmDialog from "../components/ConfirmDialog.vue";

const props = defineProps({
  card: {
    type: Object,
    default: () => ({}),
  },
  conversation: {
    type: Object,
    default: () => null,
  },
  conversationId: {
    type: String,
    required: true,
  },
  showBackButton: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["back"]);

const messages = ref([]);
const loading = ref(false);
const sending = ref(false);
const clearing = ref(false);
const generatingSuggestions = ref(false);
const error = ref("");
const draft = ref("");
const suggestions = ref([]);
const lastSuggestionKey = ref(null);
const cachedSuggestions = ref([]);
const messageList = ref(null);
const showClearConfirm = ref(false);
const suggestionContainer = ref(null);
const suggestionButton = ref(null);
const isListening = ref(false);
const voiceSupported = ref(true);
let recognition = null;

const cardInfo = computed(() => ({
  id: props.card?.id ?? props.conversationId,
  name: props.card?.name ?? "AI 夥伴",
  summary:
    props.card?.summary ?? props.card?.bio ?? props.conversation?.bio ?? "",
  image: props.card?.image ?? props.conversation?.image ?? null,
}));

function normalizeSampleMessages(input) {
  if (Array.isArray(input)) {
    return input
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

const RICH_TOKEN_REGEX = /\[\[(scene|tone|action):([^\]]+)\]\]/gi;

function extractRichMetadata(raw) {
  if (typeof raw !== 'string') {
    return {
      scene: null,
      tone: null,
      action: null,
      text: raw == null ? '' : String(raw)
    };
  }

  const tokens = { scene: null, tone: null, action: null };
  let remainder = raw;
  remainder = remainder.replace(RICH_TOKEN_REGEX, (match, key, value) => {
    const normalizedKey = String(key).trim().toLowerCase();
    if (normalizedKey === 'scene' || normalizedKey === 'tone' || normalizedKey === 'action') {
      tokens[normalizedKey] = value.trim();
    }
    return '';
  });

  return {
    scene: tokens.scene,
    tone: tokens.tone,
    action: tokens.action,
    text: remainder.trim()
  };
}

function buildRichSegments(raw) {
  const metadata = extractRichMetadata(raw);
  const segments = [];

  if (metadata.scene) {
    segments.push({ type: 'scene', value: metadata.scene, display: '在' + metadata.scene });
  }

  if (metadata.tone) {
    segments.push({ type: 'tone', value: metadata.tone, display: '(' + metadata.tone + ')' });
  }

  if (metadata.text) {
    segments.push({ type: 'text', value: metadata.text, display: metadata.text });
  }

  if (metadata.action) {
    const prefix = segments.length ? '，' : '';
    segments.push({ type: 'action', value: metadata.action, display: prefix + metadata.action });
  }

  if (!segments.length) {
    const fallback = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
    segments.push({ type: 'text', value: fallback, display: fallback });
  }

  return segments;
}

function formatRichMessageForDraft(raw) {
  const metadata = extractRichMetadata(raw);
  let result = '';

  if (metadata.scene) {
    result += '在' + metadata.scene;
    if (metadata.tone) {
      result += '(' + metadata.tone + ')';
    }
  } else if (metadata.tone) {
    result += '(' + metadata.tone + ')';
  }

  if (metadata.text) {
    if (!result || metadata.text.startsWith('，')) {
      result += metadata.text;
    } else {
      result += metadata.text;
    }
  }

  if (metadata.action) {
    result += result ? '，' + metadata.action : metadata.action;
  }

  if (!result) {
    return typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
  }

  return result;
}
const sampleMessageText = computed(() => {
  const sources = [
    props.conversation?.card?.sampleMessages,
    props.conversation?.sampleMessages,
    props.card?.sampleMessages,
  ];

  for (const source of sources) {
    const [first] = normalizeSampleMessages(source);
    if (first) {
      return formatRichMessageForDraft(first);
    }
  }

  return '';
});

function createSampleMessage() {
  const text = sampleMessageText.value;
  if (!text) return null;
  return {
    id: `sample-${props.conversationId}`,
    sender: "ai",
    text,
    createdAt: Date.now(),
    isSample: true,
  };
}

function injectSampleMessage(list = []) {
  const normalized = Array.isArray(list) ? [...list] : [];
  const sample = createSampleMessage();
  const sampleIndex = normalized.findIndex((message) => message?.isSample);

  if (!sample) {
    if (sampleIndex !== -1) {
      normalized.splice(sampleIndex, 1);
    }
    return normalized;
  }

  if (!normalized.length) {
    return [sample];
  }

  if (sampleIndex !== -1) {
    const existing = normalized[sampleIndex];
    normalized.splice(sampleIndex, 1, {
      ...sample,
      createdAt: existing?.createdAt ?? sample.createdAt,
    });
    return normalized;
  }

  return normalized;
}

const panelStyle = computed(() => ({
  "--chat-panel-image": cardInfo.value.image
    ? `url(${cardInfo.value.image})`
    : "none",
}));

const latestAiMessageKey = computed(() => {
  const list = messages.value;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const entry = list[i];
    if (entry?.sender === "ai") {
      const idPart = entry.id ? String(entry.id) : `index-${i}`;
      const text = typeof entry.text === "string" ? entry.text.trim() : "";
      const hash = text ? `${text.length.toString(36)}:${text.slice(-12)}` : "empty";
      return `${props.conversationId}:${idPart}:${hash}`;
    }
  }
  return null;
});

const clearConfirmMessage = computed(() => {
  const name = cardInfo.value.name?.trim();
  return name ? `確定要清除與 ${name} 的對話嗎？` : "確定要清除這段對話嗎？";
});

const inputPlaceholder = computed(() => "輸入訊息...");
const canSend = computed(
  () => !sending.value && !loading.value && draft.value.trim().length > 0
);

const fallbackMessageId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function normalizeMessage(raw) {
  if (!raw) return null;
  return {
    id: raw.id ?? fallbackMessageId(),
    sender: raw.sender ?? (raw.role === "assistant" ? "ai" : "user"),
    text: raw.message ?? raw.text ?? "",
    createdAt: raw.createdAt ?? Date.now(),
    isSample: raw.isSample === true,
  };
}

function scrollToBottom() {
  const el = messageList.value;
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  });
}

async function loadMessages() {
  loading.value = true;
  error.value = "";
  try {
    const response = await apiRequest(
      `/chats/${props.conversationId}/messages`
    );
    const fetched = response?.data?.messages ?? [];
    const normalized = fetched
      .map((item) => normalizeMessage(item))
      .filter(Boolean);
    messages.value = injectSampleMessage(normalized);
    await nextTick();
    scrollToBottom();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "無法載入對話內容";
    messages.value = injectSampleMessage(messages.value);
  } finally {
    loading.value = false;
  }
}

async function handleSend() {
  const text = draft.value.trim();
  if (!text || !canSend.value) return;

  sending.value = true;
  cachedSuggestions.value = [];
  lastSuggestionKey.value = null;
  suggestions.value = [];
  error.value = "";

  const tempMessage = normalizeMessage({
    id: `temp-${Date.now()}`,
    sender: "user",
    message: text,
    createdAt: Date.now(),
  });
  messages.value.push(tempMessage);
  draft.value = "";
  scrollToBottom();

  try {
    const response = await apiRequest(
      `/chats/${props.conversationId}/messages`,
      {
        method: "POST",
        body: { message: text },
      }
    );

    const payload = response?.data ?? {};

    if (payload.userMessage) {
      Object.assign(tempMessage, normalizeMessage(payload.userMessage));
    }

    if (payload.aiMessage) {
      const aiMessage = normalizeMessage(payload.aiMessage);
      if (aiMessage) {
        messages.value.push(aiMessage);
      }
    }

    await nextTick();
    scrollToBottom();
  } catch (err) {
    const message = err instanceof Error ? err.message : "傳送失敗，請稍後再試";
    error.value = message;
    draft.value = text;
    messages.value = messages.value.filter((msg) => msg.id !== tempMessage.id);
  } finally {
    sending.value = false;
  }
}

function handleClear() {
  if (clearing.value || loading.value) return;
  showClearConfirm.value = true;
}

async function confirmClear() {
  if (clearing.value || loading.value) return;

  clearing.value = true;
  error.value = "";

  try {
    await apiRequest(`/chats/${props.conversationId}/messages`, {
      method: "DELETE",
    });
    messages.value = injectSampleMessage([]);
    suggestions.value = [];
    lastSuggestionKey.value = null;
    cachedSuggestions.value = [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : "清除聊天紀錄失敗";
  } finally {
    clearing.value = false;
  }
}

function cancelClear() {
  showClearConfirm.value = false;
}

function applySuggestion(suggestion) {
  const formatted = formatRichMessageForDraft(suggestion);
  const text = typeof formatted === 'string' ? formatted.trim() : '';
  if (!text || sending.value || loading.value) {
    return;
  }
  draft.value = text;
  handleSend();
}


async function generateSuggestions(options) {
  const isEvent =
    options && typeof options === "object" && typeof options.preventDefault === "function";
  if (isEvent) {
    options.preventDefault();
  }

  const force =
    typeof options === "boolean"
      ? options
      : isEvent
      ? true
      : options && typeof options === "object" && options.force === true;

  if (generatingSuggestions.value || sending.value) {
    return;
  }

  const anchor = latestAiMessageKey.value;
  if (!force && anchor && lastSuggestionKey.value === anchor) {
    if (!suggestions.value.length && cachedSuggestions.value.length) {
      suggestions.value = [...cachedSuggestions.value];
    }
    return;
  }

  generatingSuggestions.value = true;
  error.value = "";

  try {
    const response = await apiRequest(
      `/chats/${props.conversationId}/suggestions`,
      {
        method: "POST",
      }
    );
    const data = response?.data?.suggestions ?? [];
    const normalized = data
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => item.trim())
      .slice(0, 3);
    suggestions.value = normalized;
    cachedSuggestions.value = normalized;
    if (anchor) {
      lastSuggestionKey.value = anchor;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "產生建議回覆失敗";
  } finally {
    generatingSuggestions.value = false;
  }
}

function handleOutsideSuggestionClick(event) {
  if (!suggestions.value.length) {
    return;
  }

  const target = event?.target;
  if (!target) {
    return;
  }

  if (typeof Node !== "undefined" && !(target instanceof Node)) {
    return;
  }

  const container = suggestionContainer.value;
  if (container && typeof container.contains === "function" && container.contains(target)) {
    return;
  }

  const trigger = suggestionButton.value;
  if (trigger && typeof trigger.contains === "function" && trigger.contains(target)) {
    return;
  }

  suggestions.value = [];
}

function handleComposerKeydown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}

function handleRecognitionResult(event) {
  let transcript = "";
  for (let i = 0; i < event.results.length; i += 1) {
    transcript += event.results[i][0].transcript;
  }
  draft.value = transcript.trim();
}

function setupSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceSupported.value = false;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "zh-TW";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("result", handleRecognitionResult);
  recognition.addEventListener("end", () => {
    isListening.value = false;
  });
  recognition.addEventListener("error", () => {
    isListening.value = false;
  });

  voiceSupported.value = true;
}

function toggleVoice() {
  if (!voiceSupported.value || !recognition) return;

  if (isListening.value) {
    recognition.stop();
    return;
  }

  try {
    recognition.start();
    isListening.value = true;
  } catch (err) {
    isListening.value = false;
    error.value = err instanceof Error ? err.message : "語音輸入無法啟動";
  }
}

function destroySpeechRecognition() {
  if (!recognition) return;
  recognition.removeEventListener("result", handleRecognitionResult);
  recognition.stop();
  recognition = null;
}

watch(sampleMessageText, () => {
  if (!messages.value.length) {
    messages.value = injectSampleMessage([]);
    return;
  }
  const index = messages.value.findIndex((message) => message?.isSample);
  if (index === -1) {
    return;
  }
  const sample = createSampleMessage();
  if (sample) {
    const createdAt = messages.value[index]?.createdAt ?? Date.now();
    messages.value.splice(index, 1, { ...sample, createdAt });
  } else {
    messages.value.splice(index, 1);
  }
});

watch(
  () => props.conversationId,
  async () => {
    lastSuggestionKey.value = null;
    cachedSuggestions.value = [];
    suggestions.value = [];
    await loadMessages();
  },
  { immediate: true }
);

onMounted(() => {
  setupSpeechRecognition();
  if (typeof window !== "undefined") {
    window.addEventListener('click', handleOutsideSuggestionClick);
  }
});

onBeforeUnmount(() => {
  destroySpeechRecognition();
  if (typeof window !== "undefined") {
    window.removeEventListener('click', handleOutsideSuggestionClick);
  }
});
</script>

<style scoped>
.chat-panel {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: stretch;
  padding: clamp(0.5rem, 2.5vw, 1.5rem);
  color: #f8fafc;
  background: linear-gradient(
      180deg,
      rgba(12, 15, 24, 0.85) 0%,
      transparent 20%
    ),
    var(--chat-panel-image) center / cover no-repeat;
}

.chat-panel__overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.chat-panel__container {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: min(460px, 100%);
  border-radius: 26px;
  padding: clamp(1.4rem, 2.8vw, 2rem);
  gap: 1.1rem;
}

.chat-panel__header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.chat-panel__title {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.chat-panel__name {
  margin: 0;
  font-size: clamp(1.3rem, 4vw, 1.6rem);
  font-weight: 700;
}

.chat-panel__summary {
  margin: 0 0 1rem;
  padding: 0.85rem 1rem;
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.25);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chat-panel__summary-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.7);
}

.chat-panel__summary-text {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.65;
  color: rgba(226, 232, 240, 0.92);
}

.icon-button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.55);
  color: inherit;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border 0.2s ease;
}

.icon-button svg {
  width: 20px;
  height: 20px;
}

.icon-button:hover:not(:disabled) {
  transform: translateY(-1px);
  background: rgba(59, 130, 246, 0.35);
  border-color: rgba(59, 130, 246, 0.5);
}

.icon-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.icon-button--active {
  background: rgba(244, 114, 182, 0.4);
  border-color: rgba(244, 114, 182, 0.65);
}

.chat-panel__messages {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  padding-right: 0.2rem;
}

.chat-panel__message-list {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
}

.message-enter-active,
.message-leave-active {
  transition: all 0.2s ease;
}

.message-enter-from,
.message-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.message {
  max-width: 80%;
  width: fit-content;
  min-width: 0;
  padding: 0.9rem 1.1rem;
  border-radius: 1.25rem;
  position: relative;
  display: inline-flex;
  flex-direction: column;
  gap: 0.35rem;
  line-height: 1.5;
  font-size: 0.98rem;
}

.message__text {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: break-word;
}

.message--ai {
  align-self: flex-start;
  background: rgba(185, 82, 123, 0.9);
}

.message--user {
  align-self: flex-end;
  margin-left: auto;
  background: rgba(54, 45, 54, 0.9);
}

.chat-panel__empty {
  margin: 0 auto;
  color: rgba(148, 163, 184, 0.65);
}

.chat-panel__loading {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  justify-content: center;
  color: rgba(148, 163, 184, 0.85);
}

.spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(148, 163, 184, 0.25);
  border-top-color: rgba(148, 163, 184, 0.9);
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.chat-panel__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.suggestion-chip {
  border: none;
  border-radius: 999px;
  padding: 0.6rem 0.95rem;
  font-size: 0.85rem;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.45);
  color: inherit;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.suggestion-chip:hover {
  transform: translateY(-1px);
  background: rgba(59, 130, 246, 0.3);
}

.chat-panel__error {
  margin: 0;
  color: #fda4af;
  font-size: 0.85rem;
}

.chat-panel__composer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  margin-bottom: 5rem;
}

.chat-panel__input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.75rem;
  border-radius: 0.75rem;
  background: rgba(65, 62, 76, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(10px);
}

.chat-panel__input {
  flex: 1;
  height: 6vw;
  max-height: 23px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  resize: none;
  line-height: 1.45;
  padding: 0.25rem 0;
}

.chat-panel__input::placeholder {
  color: rgba(226, 232, 240, 0.7);
  letter-spacing: 0.01em;
}

.chat-panel__input:focus {
  outline: none;
}

.chat-panel__suggestion-button,
.chat-panel__send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.chat-panel__suggestion-button svg,
.chat-panel__send-button svg {
  width: 20px;
  height: 20px;
}

.chat-panel__suggestion-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.chat-panel__suggestion-button:not(:disabled):hover,
.chat-panel__send-button:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
}

.chat-panel__send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-panel__voice-button {
  background: rgba(65, 62, 76, 0.65);
  border-color: transparent;
  color: rgba(226, 232, 240, 0.9);
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.chat-panel__voice-button:not(:disabled):hover,
.chat-panel__voice-button.icon-button--active {
  background: rgba(244, 114, 182, 0.35);
  border-color: rgba(244, 114, 182, 0.45);
  transform: translateY(-1px);
}

.chat-panel__hint {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(148, 163, 184, 0.6);
}

@media (max-width: 640px) {
  .chat-panel {
    padding: 0;
  }

  .chat-panel__container {
    border-radius: 0;
    padding: 1rem;
  }

  .chat-panel__composer {
    gap: 0.5rem;
    padding: 0.6rem 0;
    margin-bottom: 3.5rem;
  }

  .chat-panel__input-wrapper {
    padding: 0.35rem 0.6rem;
  }
}

.message__segment {
  display: inline-flex;
  align-items: center;
  margin-right: 0.25rem;
}

.message__scene {
  font-weight: 600;
  margin-right: 0.2rem;
}

.message__tone {
  font-size: 0.78rem;
  color: rgba(226, 232, 240, 0.75);
  margin-right: 0.25rem;
}

.message__action {
  font-size: 0.78rem;
  color: rgba(226, 232, 240, 0.7);
}

.suggestion-chip__segment {
  display: inline-flex;
  align-items: center;
  font-size: 0.8rem;
  margin-right: 0.2rem;
}

.suggestion-chip__scene {
  font-weight: 600;
}

.suggestion-chip__tone {
  font-size: 0.74rem;
  color: rgba(59, 130, 246, 0.85);
}

.suggestion-chip__action {
  font-size: 0.74rem;
  color: rgba(96, 165, 250, 0.85);
}

</style>


