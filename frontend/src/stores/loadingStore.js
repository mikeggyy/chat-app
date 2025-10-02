import { defineStore } from "pinia";

export const useLoadingStore = defineStore("loading", {
  state: () => ({
    activeRequests: 0,
  }),
  getters: {
    isLoading: (state) => state.activeRequests > 0,
  },
  actions: {
    startRequest() {
      this.activeRequests += 1;
    },
    finishRequest() {
      if (this.activeRequests > 0) {
        this.activeRequests -= 1;
      }
    },
    reset() {
      this.activeRequests = 0;
    },
  },
});
