<template>
  <div class="app-wrapper" :class="{ 'auth-layout': isAuthLayout }">
    <RouterView v-if="isAuthLayout" />
    <div v-else class="mobile-shell">
      <div class="mobile-shell__layout">
        <AppTopBar :title="pageTitle" @logout="handleLogout" />
        <main ref="shellContent" class="mobile-shell__content" :class="contentClasses">
          <RouterView />
        </main>
        <AppBottomNav class="mobile-shell__bottom-nav" />
      </div>
    </div>
    <GlobalLoadingOverlay />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import AppTopBar from "./components/AppTopBar.vue";
import AppBottomNav from "./components/AppBottomNav.vue";
import GlobalLoadingOverlay from "./components/GlobalLoadingOverlay.vue";
import { useAuthStore } from "./stores/authStore";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const shellContent = ref(null);

onMounted(async () => {
  authStore.init();
  await nextTick();
  resetShellScroll();
});

onBeforeUnmount(() => {
  authStore.teardown();
});

const isAuthLayout = computed(() => route.meta.layout === "auth");
const pageTitle = computed(() => route.meta.title ?? "Love Story");
const contentClasses = computed(() => ({
  "mobile-shell__content--no-scroll": Boolean(route.meta.disableScroll),
}));

function resetShellScroll({ behavior = "auto" } = {}) {
  const el = shellContent.value;
  if (!el) return;
  if (typeof el.scrollTo === "function") {
    el.scrollTo({ top: 0, left: 0, behavior });
  } else {
    el.scrollTop = 0;
  }
}

watch(
  () => route.fullPath,
  async () => {
    await nextTick();
    resetShellScroll();
  },
  { flush: "post" }
);

async function handleLogout() {
  await authStore.logout();
  await authStore.ensureAuthReady();
  if (!authStore.isAuthenticated) {
    router.push({ name: "login" }).catch(() => {});
  }
}
</script>

<style scoped>
.app-wrapper {
  min-height: 100vh;
  background: #050608;
  color: #e2e8f0;
}

.auth-layout {
  min-height: 100vh;
}

.mobile-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(
      circle at top,
      rgba(255, 122, 195, 0.12),
      transparent 55%
    ),
    radial-gradient(circle at bottom, rgba(99, 102, 241, 0.12), transparent 60%),
    #050608;
}

.mobile-shell__layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.mobile-shell__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
  overflow-y: auto;
}

.mobile-shell__content--no-scroll {
  overflow: hidden;
}

.mobile-shell__bottom-nav {
  margin-top: auto;
}

@media (min-width: 768px) {
  .mobile-shell__layout {
    max-width: 420px;
    margin: 0 auto;
    border-left: 1px solid rgba(148, 163, 184, 0.12);
    border-right: 1px solid rgba(148, 163, 184, 0.12);
    box-shadow: 0 25px 60px rgba(5, 6, 8, 0.55);
  }
}
</style>




