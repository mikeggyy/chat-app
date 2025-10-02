<template>
  <section class="chat-detail">
    <ChatConversationPanel
      v-if="card"
      :card="card"
      :conversation="conversation"
      :conversation-id="conversationId"
      @back="handleBack"
    />
    <div v-else class="chat-detail__empty">
      <p>正在載入對話...</p>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ChatConversationPanel from '../components/ChatConversationPanel.vue';
import { getAiRoleById, mapAiRoleToCard } from '../data/aiRoles';
import { useChatStore } from '../stores/chatStore';

const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();

function normalizeSampleMessages(input) {
  if (Array.isArray(input)) {
    return input
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}


const conversationId = computed(() => String(route.params.conversationId ?? ''));

onMounted(async () => {
  if (!chatStore.conversations.length && !chatStore.loading) {
    await chatStore.fetchConversations();
  }
});

watch(
  () => conversationId.value,
  (id) => {
    if (id) {
      chatStore.selectConversation(id);
    }
  },
  { immediate: true }
);

const conversation = computed(() =>
  chatStore.conversations.find((conv) => conv.id === conversationId.value) || null
);

const card = computed(() => {
  if (!conversationId.value) return null;

  const conversationCard = conversation.value?.card;
  if (conversationCard) {
    return {
      ...conversationCard,
      summary: conversationCard.summary ?? conversationCard.bio ?? '',
      sampleMessages: normalizeSampleMessages(conversationCard.sampleMessages),
    };
  }

  const role = getAiRoleById(conversationId.value);
  if (role) {
    const mapped = mapAiRoleToCard(role);
    return {
      ...mapped,
      summary: mapped.summary ?? mapped.bio ?? '',
      sampleMessages: normalizeSampleMessages(mapped.sampleMessages),
    };
  }

  if (conversation.value) {
    return {
      id: conversation.value.id,
      name: conversation.value.aiName ?? 'AI 夥伴',
      persona: conversation.value.aiPersona ?? '',
      bio: conversation.value.aiPersona ?? '',
      tags: conversation.value.tags ?? [],
      image: conversation.value.image ?? null,
      summary: conversation.value.bio ?? '',
      sampleMessages: normalizeSampleMessages(conversation.value.sampleMessages),
    };
  }

  return null;
});
function handleBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: 'chatList' }).catch(() => {});
  }
}
</script>

<style scoped>
.chat-detail {
  position: relative;
  flex: 1;
  min-height: 0;
}

.chat-detail__empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: rgba(148, 163, 184, 0.75);
  font-size: 1rem;
}
</style>

