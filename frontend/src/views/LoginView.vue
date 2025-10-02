<template>
  <section class="login-screen">
    <div class="login-screen__backdrop" role="presentation" />
    <div class="login-card">
      <div class="brand">
        <img class="brand__logo" :src="logo" alt="Love Story" />
        <h1>Love Story</h1>
        <p>與 AI 暢聊</p>
      </div>

      <button class="primary" :disabled="isBusy" @click="startPhoneLogin">
        {{ isBusy ? '處理中…' : '手機號或郵箱登入' }}
      </button>

      <p class="divider">或使用以下平台登入</p>

      <div class="social-buttons">
        <button :disabled="isBusy" @click="signIn('google')">
          <img alt="Google" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" />
          <span>Google</span>
        </button>
        <button :disabled="isBusy" @click="signIn('facebook')">
          <img alt="Facebook" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/facebook.svg" />
          <span>Facebook</span>
        </button>
      </div>

      <p v-if="authStore.error" class="error">{{ authStore.error?.message ?? '登入失敗，請稍後再試。' }}</p>

      <p class="legal">
        登入即表示你已閱讀並同意<br />
        <a href="#" rel="noopener noreferrer">用戶條款</a>
        &amp;
        <a href="#" rel="noopener noreferrer">隱私政策</a>
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import logoUrl from '../assets/logo_color.png';
import { useAuthStore } from '../stores/authStore';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const logo = logoUrl;
const isSubmitting = ref(false);

const isBusy = computed(() => authStore.loading || isSubmitting.value);

function resolveRedirectTarget() {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.trim()) {
    return redirect;
  }
  return '/match';
}

function maybeRedirectAuthenticated() {
  if (!authStore.isAuthenticated || authStore.loading) {
    return;
  }

  const target = resolveRedirectTarget();
  if (router.currentRoute.value.fullPath === target) {
    return;
  }

  router.replace(target).catch(() => {
    /* ignore navigation duplication */
  });
}

async function signIn(provider) {
  if (isBusy.value) return;
  isSubmitting.value = true;
  try {
    await authStore.loginWithProvider(provider);
    await authStore.ensureAuthReady();
    maybeRedirectAuthenticated();
  } finally {
    isSubmitting.value = false;
  }
}

function startPhoneLogin() {
  if (isBusy.value) return;
  // TODO: implement phone/email flow modal
  console.info('phone/email login flow placeholder');
}

onMounted(async () => {
  authStore.init();
  await authStore.ensureAuthReady();
  maybeRedirectAuthenticated();
});

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      maybeRedirectAuthenticated();
    }
  }
);
</script>

<style scoped>
.login-screen {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #050608;
  color: #f8fafc;
  overflow: hidden;
}

.login-screen__backdrop {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(5, 6, 8, 0.4) 0%, rgba(5, 6, 8, 0.92) 100%),
    url('https://images.unsplash.com/photo-1504593811423-6dd665756598?q=80&w=1000&auto=format&fit=crop') center/cover no-repeat;
  filter: saturate(110%);
  z-index: 0;
}

.login-card {
  position: relative;
  z-index: 1;
  width: min(90vw, 360px);
  padding: 2.5rem 2rem;
  border-radius: 1.75rem;
  background: rgba(15, 17, 27, 0.78);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  text-align: center;
  backdrop-filter: blur(12px);
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.brand__logo {
  width: 100px;
  height: 100px;
  object-fit: contain;
  filter: drop-shadow(0 12px 25px rgba(255, 70, 150, 0.35));
}

.brand h1 {
  margin: 0;
  font-size: 2.25rem;
  font-weight: 600;
}

.brand p {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.85);
}

.primary {
  border: none;
  border-radius: 999px;
  padding: 0.9rem 1.25rem;
  background: linear-gradient(135deg, #ff7ac3, #ff4588);
  color: #fff;
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.05);
}

.primary:disabled,
.social-buttons button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.divider {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.75);
}

.social-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.social-buttons button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 999px;
  padding: 0.7rem 0;
  background: rgba(9, 12, 18, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.social-buttons button:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.45);
}

.social-buttons img {
  width: 20px;
  height: 20px;
}

.error {
  margin: 0;
  color: #fda4af;
  font-size: 0.9rem;
}

.legal {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(248, 250, 252, 0.7);
  line-height: 1.6;
}

.legal a {
  color: inherit;
}

@media (max-width: 480px) {
  .login-card {
    padding: 2rem 1.5rem;
    width: min(92vw, 340px);
  }

  .brand h1 {
    font-size: 2rem;
  }

  .brand__logo {
    width: 88px;
    height: 88px;
  }
}
</style>
