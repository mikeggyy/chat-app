import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

const routes = [
  {
    path: '/',
    redirect: '/match',
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { layout: 'auth', title: '登入' },
  },
  {
    path: '/match',
    name: 'match',
    component: () => import('../views/MatchView.vue'),
    meta: { requiresAuth: true, title: '角色配對', disableScroll: true },
  },
  {
    path: '/chats',
    name: 'chatList',
    component: () => import('../views/ChatListView.vue'),
    meta: { requiresAuth: true, title: '聊天清單' },
  },
  {
    path: '/chats/:conversationId',
    name: 'chatDetail',
    component: () => import('../views/ChatDetailView.vue'),
    meta: { requiresAuth: true, title: '聊天室' },
    props: true,
  },
  {
    path: '/store',
    name: 'store',
    component: () => import('../views/StoreView.vue'),
    meta: { requiresAuth: true, title: '商城' },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { requiresAuth: true, title: '個人設定' },
  },
  {
    path: '/profile/notifications',
    name: 'profileNotifications',
    component: () => import('../views/ProfileNotificationsView.vue'),
    meta: { requiresAuth: true, title: '通知' },
  },
  {
    path: '/profile/favorites',
    name: 'profileFavorites',
    component: () => import('../views/ProfileFavoritesView.vue'),
    meta: { requiresAuth: true, title: '我的收藏' },
  },
  {
    path: '/ai-roles/new',
    name: 'aiRoleCreate',
    component: () => import('../views/NewAiRoleView.vue'),
    meta: { requiresAuth: true, title: '新增 AI 角色' },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  authStore.init();
  await authStore.ensureAuthReady();

  if (authStore.isAuthenticated && to.name !== 'login') {
    try {
      await authStore.syncBackendSession();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Session verification failed before navigation', error);
      await authStore.logout();
      return {
        name: 'login',
        query: to.fullPath ? { redirect: to.fullPath } : {},
      };
    }
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return {
      name: 'login',
      query: to.fullPath ? { redirect: to.fullPath } : {},
    };
  }

  if (to.name === 'login' && authStore.isAuthenticated) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : null;
    return redirect ? { path: redirect } : { name: 'match' };
  }

  return true;
});

export default router;

