import { defineStore } from 'pinia';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, loginWithSocialProvider, loginWithPhoneNumber } from '../firebase/auth';
import { apiRequest } from '../services/apiClient';

function buildSessionRequestBody() {
  if (typeof window === 'undefined') {
    return {};
  }

  const payload = {};
  const device = {};
  const { navigator } = window;

  if (navigator) {
    if (navigator.userAgentData?.platform) {
      device.platform = navigator.userAgentData.platform;
    } else if (typeof navigator.platform === 'string' && navigator.platform) {
      device.platform = navigator.platform;
    }

    if (typeof navigator.appVersion === 'string' && navigator.appVersion) {
      device.appVersion = navigator.appVersion.slice(0, 120);
    }

    if (navigator.userAgentData?.brands?.length) {
      const brand = navigator.userAgentData.brands[0];
      if (brand?.brand) {
        device.model = brand.brand.slice(0, 120);
      }
    }
  }

  if (Object.keys(device).length) {
    payload.device = device;
  }

  const preferredLanguage =
    (navigator && typeof navigator.language === 'string' && navigator.language) ||
    undefined;

  if (preferredLanguage) {
    payload.locale = preferredLanguage;
    payload.profile = { preferredLanguage };
  }

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      payload.timezone = timezone;
    }
  } catch (err) {
    // ignore Intl failures (older environments)
  }

  return payload;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    profile: null,
    session: null,
    loading: true,
    sessionLoading: false,
    error: null,
    unsubscribe: null,
    initPromise: null,
    sessionPromise: null,
    lastSessionSync: 0,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user),
  },
  actions: {
    init() {
      if (this.initPromise) {
        return this.initPromise;
      }

      this.loading = true;
      this.initPromise = new Promise((resolve) => {
        this.unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          this.user = firebaseUser;
          this.loading = false;

          try {
            if (firebaseUser) {
              await this.syncBackendSession(true);
            } else {
              this.resetSessionState();
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to sync backend session', err);
          } finally {
            resolve(firebaseUser);
          }
        });
      });

      return this.initPromise;
    },
    resetSessionState() {
      this.profile = null;
      this.session = null;
      this.sessionPromise = null;
      this.sessionLoading = false;
      this.lastSessionSync = 0;
      this.error = null;
    },
    async ensureAuthReady() {
      if (!this.initPromise) {
        this.init();
      }

      try {
        await this.initPromise;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to resolve auth state', err);
      }
    },
    async syncBackendSession(force = false) {
      if (!this.user) {
        this.resetSessionState();
        return null;
      }

      const recentlySynced = Date.now() - this.lastSessionSync < 30_000;
      if (!force && recentlySynced && this.session) {
        return { profile: this.profile, session: this.session };
      }

      if (this.sessionPromise && !force) {
        return this.sessionPromise;
      }

      if (force && this.sessionPromise) {
        try {
          await this.sessionPromise;
        } catch (err) {
          // ignore error, a new sync attempt will follow
        }
        this.sessionPromise = null;
      }

      const requestBody = buildSessionRequestBody();
      const requestOptions = { method: 'POST' };
      if (Object.keys(requestBody).length) {
        requestOptions.body = requestBody;
      }

      this.sessionLoading = true;
      const pending = apiRequest('/auth/session', requestOptions)
        .then((response) => {
          const { profile, session } = response?.data ?? {};
          this.profile = profile ?? null;
          this.session = session ?? null;
          this.lastSessionSync = Date.now();
          this.error = null;
          return response?.data ?? null;
        })
        .catch((err) => {
          this.error = err;
          throw err;
        })
        .finally(() => {
          this.sessionLoading = false;
          this.sessionPromise = null;
        });

      this.sessionPromise = pending;
      return pending;
    },
    async loginWithProvider(provider) {
      this.error = null;
      try {
        await loginWithSocialProvider(provider);
      } catch (err) {
        this.error = err;
        throw err;
      }
    },
    async loginWithPhone(phoneNumber, recaptchaVerifier) {
      this.error = null;
      try {
        await loginWithPhoneNumber(phoneNumber, recaptchaVerifier);
      } catch (err) {
        this.error = err;
        throw err;
      }
    },
    async logout() {
      await signOut(auth);
      this.resetSessionState();
    },
    teardown() {
      if (this.unsubscribe) {
        this.unsubscribe();
      }
      this.unsubscribe = null;
      this.initPromise = null;
      this.resetSessionState();
      this.user = null;
      this.loading = true;
      this.error = null;
    },
  },
});



