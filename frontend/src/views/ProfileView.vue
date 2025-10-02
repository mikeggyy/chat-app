<template>
  <section class="profile-view">
    <div class="profile-hero">
      <div class="hero-top">
        <button type="button" class="vip-button" @click="goToVip">
          開通VIP
        </button>
        <div class="hero-actions">
          <button
            type="button"
            class="icon-button"
            aria-label="加入 Discord"
            @click="openDiscord"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M20.317 4.368a19.59 19.59 0 0 0-4.885-1.515c-.21.372-.45.882-.616 1.276a18.27 18.27 0 0 0-5.63 0 12.31 12.31 0 0 0-.624-1.276 19.63 19.63 0 0 0-4.89 1.52c-3.094 4.515-3.93 8.93-3.51 13.285a19.822 19.822 0 0 0 5.987 3.036c.484-.664.917-1.37 1.295-2.112a12.52 12.52 0 0 1-2.037-.98c.172-.124.34-.253.502-.386 3.914 1.826 8.145 1.826 12.02 0 .164.133.332.262.502.386-.65.392-1.34.724-2.054.99.378.74.81 1.447 1.292 2.112a19.78 19.78 0 0 0 5.997-3.04c.492-5.197-.84-9.565-3.47-13.286Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            type="button"
            class="icon-button"
            aria-label="編輯個人資料"
            @click="openEdit"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="m4 17.25 4.586-.66 9.6-9.6a1.5 1.5 0 0 0 0-2.12l-.956-.956a1.5 1.5 0 0 0-2.12 0l-9.6 9.6L4 17.25Z"
                fill="currentColor"
              />
              <path
                d="M19.5 21.75H4.5a.75.75 0 0 1 0-1.5h15a.75.75 0 0 1 0 1.5Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            type="button"
            class="icon-button"
            aria-label="設定"
            @click="openSettings"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <path
                d="m20.25 12 .933-1.613a.75.75 0 0 0-.273-1.029l-1.7-.981.033-1.966a.75.75 0 0 0-.645-.753l-1.962-.25-.787-1.797a.75.75 0 0 0-.961-.4L12 3.75l-1.888-.702a.75.75 0 0 0-.961.4l-.787 1.797-1.962.25a.75.75 0 0 0-.645.753l.033 1.966-1.7.98a.75.75 0 0 0-.273 1.03L3.75 12l-.933 1.613a.75.75 0 0 0 .273 1.029l1.7.981-.033 1.966a.75.75 0 0 0 .645.753l1.962.25.787 1.797a.75.75 0 0 0 .961.4L12 20.25l1.888.703a.75.75 0 0 0 .961-.4l.787-1.797 1.962-.25a.75.75 0 0 0 .645-.753l-.033-1.966 1.7-.98a.75.75 0 0 0 .273-1.03Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
          </button>
        </div>
      </div>
      <div class="hero-body">
        <div class="avatar-wrapper">
          <img :src="profile.avatar" alt="" />
          <button
            type="button"
            class="avatar-edit-button"
            aria-label="更換頭像"
            @click="toggleAvatarPicker"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="m4 17.25 4.586-.66 9.6-9.6a1.5 1.5 0 0 0 0-2.12l-.956-.956a1.5 1.5 0 0 0-2.12 0l-9.6 9.6L4 17.25Z"
                fill="currentColor"
              />
              <path
                d="M19.5 21.75H4.5a.75.75 0 0 1 0-1.5h15a.75.75 0 0 1 0 1.5Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <transition name="fade">
          <section
            v-if="showAvatarPicker"
            class="avatar-picker"
            aria-label="更換頭像"
          >
            <header class="avatar-picker__header">
              <h3>更換頭像</h3>
              <button
                type="button"
                class="avatar-picker__close"
                aria-label="關閉"
                @click="closeAvatarPicker"
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>
            <section class="avatar-section">
              <header class="avatar-section__header">
                <span>預設頭像</span>
                <span class="avatar-section__hint">點擊即可切換</span>
              </header>
              <div class="avatar-preview">
                <img :src="profile.avatar" alt="頭像預覽" />
              </div>
              <div class="avatar-options">
                <button
                  v-for="option in avatarOptions"
                  :key="option.id"
                  type="button"
                  :class="[
                    'avatar-option',
                    { selected: isPresetSelected(option) },
                  ]"
                  :aria-pressed="isPresetSelected(option)"
                  @click="applyPresetAvatar(option)"
                >
                  <img :src="option.src" :alt="option.label" />
                  <span>{{ option.label }}</span>
                </button>
              </div>
              <div class="avatar-upload">
                <input
                  ref="avatarFileInput"
                  class="avatar-upload__input"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  @change="handleAvatarFileChange"
                />
                <button
                  type="button"
                  class="avatar-upload__button"
                  :disabled="isUploadingAvatar"
                  @click="triggerAvatarUpload"
                >
                  {{ isUploadingAvatar ? "上傳中..." : "上傳圖片" }}
                </button>
                <p v-if="avatarUploadError" class="avatar-upload__error">
                  {{ avatarUploadError }}
                </p>
              </div>
            </section>
          </section>
        </transition>
        <h1>{{ profile.name }}</h1>
        <p class="profile-id">ID: {{ profile.id }}</p>
        <ul class="profile-stats">
          <li v-for="stat in statsList" :key="stat.label">
            <strong>{{ stat.value }}</strong>
            <span>{{ stat.label }}</span>
          </li>
        </ul>
      </div>
    </div>
    <nav class="profile-shortcuts" aria-label="快速操作">
      <button type="button" @click="goToNotifications">
        <span class="shortcut-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 21a2.25 2.25 0 0 0 2.25-2.25h-4.5A2.25 2.25 0 0 0 12 21Z"
              fill="currentColor"
            />
            <path
              d="M18.75 15.75H5.25l1.5-2.25v-3.75A5.25 5.25 0 0 1 12 4.5a5.25 5.25 0 0 1 5.25 5.25v3.75Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="shortcut-label">通知</span>
      </button>
      <button type="button" @click="goToWallet">
        <span class="shortcut-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4.5 7.5h15a1.5 1.5 0 0 1 1.5 1.5v8.25A1.5 1.5 0 0 1 19.5 18.75h-15A1.5 1.5 0 0 1 3 17.25V9a1.5 1.5 0 0 1 1.5-1.5Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M6 7.5V6a3 3 0 0 1 3-3h9v3"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M16.5 12.75h1.5a.75.75 0 0 1 0 1.5h-1.5Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span class="shortcut-label">錢包</span>
      </button>
      <button type="button" @click="goToVip">
        <span class="shortcut-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="m5.25 6.75 2.4 8.1a.75.75 0 0 0 1.41.09L12 9.75l2.94 5.19a.75.75 0 0 0 1.41-.09l2.4-8.1"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="shortcut-label">會員</span>
      </button>
      <button type="button" @click="goToFavorites">
        <span class="shortcut-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 3.75 9.72 9.21 4.5 9.9l3.9 3.66-.99 5.34L12 16.98l4.59 1.92-.99-5.34 3.9-3.66-5.22-.69Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="shortcut-label">收藏</span>
      </button>
    </nav>
    <section class="roles-section">
      <header class="roles-header">
        <h2>我的角色</h2>
        <button type="button" class="create-button" @click="createRole">
          + 創建
        </button>
      </header>
      <ul class="roles-list">
        <li v-for="role in roles" :key="role.id">
          <button type="button" class="role-card" @click="viewRole(role)">
            <div class="role-image">
              <img :src="role.cover" :alt="role.name" />
            </div>
            <div class="role-info">
              <h3>{{ role.name }}</h3>
              <p class="role-meta">
                {{ role.likes }} 喜歡 · {{ role.favorites }} 收藏
              </p>
            </div>
            <svg class="role-chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M10.5 6.75 15.75 12 10.5 17.25"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
              />
            </svg>
          </button>
        </li>
      </ul>
    </section>
    <transition name="fade">
      <div v-if="showEditModal" class="modal-backdrop" @click.self="closeEdit">
        <section
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
        >
          <header class="modal-header">
            <h2 id="edit-profile-title">編輯個人資料</h2>
            <button
              type="button"
              class="close-button"
              aria-label="關閉"
              @click="closeEdit"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <form class="modal-form" @submit.prevent="saveProfile">
            <label>
              暱稱
              <input v-model="editForm.displayName" maxlength="20" />
            </label>
            <label>
              個人狀態
              <input v-model="editForm.tagline" maxlength="30" />
            </label>
            <label>
              AI 交談預設資料
              <textarea v-model="editForm.defaultPrompt" rows="3"></textarea>
            </label>
            <div class="modal-actions">
              <button type="button" class="modal-cancel" @click="closeEdit">
                取消
              </button>
              <button
                type="submit"
                class="modal-submit"
                :disabled="isSavingProfile"
              >
                {{ isSavingProfile ? "儲存中..." : "儲存" }}
              </button>
            </div>
            <p v-if="profileSaveError" class="modal-error">
              {{ profileSaveError }}
            </p>
          </form>
        </section>
      </div>
    </transition>
    <transition name="fade">
      <div
        v-if="showSettings"
        class="sheet-backdrop"
        @click.self="closeSettings"
      >
        <section
          class="settings-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <header class="settings-header">
            <h2 id="settings-title">設定</h2>
            <button
              type="button"
              class="close-button"
              aria-label="關閉"
              @click="closeSettings"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <ul class="settings-list">
            <li><button type="button">通知設定</button></li>
            <li><button type="button">帳號安全</button></li>
            <li><button type="button">隱私偏好</button></li>
            <li>
              <button type="button" class="logout-button" @click="logout">
                登出
              </button>
            </li>
          </ul>
        </section>
      </div>
    </transition>
    <AvatarCropperModal
      :open="showCropperModal"
      :image-url="avatarCropPreviewUrl"
      :submitting="isUploadingAvatar"
      :error="avatarUploadError"
      @close="handleCropperClose"
      @confirm="handleCropperConfirm"
    />
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import avatarCelestialBloom from "../assets/avatars/avatar-celestial-bloom.svg";
import avatarLunarTide from "../assets/avatars/avatar-lunar-tide.svg";
import avatarNeonDrift from "../assets/avatars/avatar-neon-drift.svg";
import avatarSolsticeGlow from "../assets/avatars/avatar-solstice-glow.svg";
import avatarEmberHalo from "../assets/avatars/avatar-ember-halo.svg";
import avatarMintOrbit from "../assets/avatars/avatar-mint-orbit.svg";
import roleCover from "../assets/characters/character-nova.jpg";
import AvatarCropperModal from "../components/AvatarCropperModal.vue";
import {
  fetchProfile as fetchProfileRequest,
  updateProfile as updateProfileRequest,
  uploadProfileAvatar as uploadProfileAvatarRequest,
} from "../services/profileService";

const router = useRouter();
const authStore = useAuthStore();

const DEFAULT_PROFILE_NAME = "台北小高0556";
const DEFAULT_TAGLINE = "我的駕駛是達令";
const DEFAULT_PROMPT = "請記得我喜歡科幻與戀愛交錯的故事情節。";

const avatarOptions = [
  { id: "celestial-bloom", label: "星軌花語", src: avatarCelestialBloom },
  { id: "lunar-tide", label: "月潮光弧", src: avatarLunarTide },
  { id: "neon-drift", label: "霓彩漂移", src: avatarNeonDrift },
  { id: "solstice-glow", label: "曙光綻放", src: avatarSolsticeGlow },
  { id: "ember-halo", label: "餘燼光輪", src: avatarEmberHalo },
  { id: "mint-orbit", label: "薄荷軌道", src: avatarMintOrbit },
];
const avatarOptionMap = new Map(
  avatarOptions.map((option) => [option.id, option])
);

const profile = reactive({
  id: authStore.user?.uid ?? "00235746",
  uid: authStore.user?.uid ?? "",
  name: authStore.profile?.displayName ?? DEFAULT_PROFILE_NAME,
  avatar: avatarOptions[0].src,
  avatarPreset: avatarOptions[0].id,
  photoURL: null,
  photoStoragePath: authStore.profile?.photoStoragePath ?? null,
  tagline: authStore.profile?.tagline ?? DEFAULT_TAGLINE,
  defaultPrompt: authStore.profile?.defaultPrompt ?? DEFAULT_PROMPT,
  stats: {
    followers: 102,
    following: 304,
    likes: 602,
    interactions: 15,
  },
});

const MAX_AVATAR_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
];

const showEditModal = ref(false);
const showSettings = ref(false);
const showAvatarPicker = ref(false);
const showCropperModal = ref(false);
const avatarFileInput = ref(null);
const avatarCropPreviewUrl = ref("");
const pendingAvatarFile = ref(null);
const isUploadingAvatar = ref(false);
const isSavingProfile = ref(false);
const isLoadingProfile = ref(false);
const avatarUploadError = ref("");
const profileSaveError = ref("");
const roles = ref([
  {
    id: "role-1",
    name: "我的駕駛是達令",
    likes: 3,
    favorites: 20,
    cover: roleCover,
  },
]);
const editForm = reactive({
  displayName: profile.name,
  tagline: profile.tagline,
  defaultPrompt: profile.defaultPrompt,
});
const statsList = computed(() => [
  { label: "粉絲", value: profile.stats.followers },
  { label: "關注", value: profile.stats.following },
  { label: "喜歡", value: profile.stats.likes },
  { label: "互動", value: profile.stats.interactions },
]);

function resolveAvatarAsset(avatarPayload = {}) {
  const { photoURL, avatarPreset } = avatarPayload;
  if (typeof photoURL === "string" && photoURL) {
    return photoURL;
  }
  if (typeof avatarPreset === "string" && avatarPreset) {
    const preset = avatarOptionMap.get(avatarPreset);
    if (preset?.src) {
      return preset.src;
    }
  }
  return avatarOptions[0].src;
}

function applyProfileData(incoming) {
  if (!incoming || typeof incoming !== "object") {
    return;
  }
  profile.uid = incoming.uid ?? profile.uid ?? "";
  profile.id = profile.uid || incoming.uid || profile.id || "—";
  profile.photoURL =
    typeof incoming.photoURL === "string" && incoming.photoURL
      ? incoming.photoURL
      : null;
  profile.photoStoragePath =
    typeof incoming.photoStoragePath === "string" && incoming.photoStoragePath
      ? incoming.photoStoragePath
      : null;
  const hasCustomAvatar = Boolean(profile.photoURL);
  if (hasCustomAvatar) {
    profile.avatarPreset = null;
  } else {
    const presetId =
      typeof incoming.avatarPreset === "string" &&
      avatarOptionMap.has(incoming.avatarPreset)
        ? incoming.avatarPreset
        : null;
    profile.avatarPreset = presetId ?? avatarOptions[0].id;
  }
  profile.avatar = resolveAvatarAsset({
    photoURL: profile.photoURL,
    avatarPreset: profile.avatarPreset,
  });
  const nextName =
    typeof incoming.displayName === "string" && incoming.displayName.trim()
      ? incoming.displayName.trim()
      : profile.name || DEFAULT_PROFILE_NAME;
  profile.name = nextName || DEFAULT_PROFILE_NAME;
  profile.tagline =
    typeof incoming.tagline === "string" ? incoming.tagline : "";
  profile.defaultPrompt =
    typeof incoming.defaultPrompt === "string" ? incoming.defaultPrompt : "";
  const stats = incoming.stats;
  if (stats && typeof stats === "object") {
    const normalize = (value, fallback) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    profile.stats.followers = normalize(
      stats.followers,
      profile.stats.followers
    );
    profile.stats.following = normalize(
      stats.following,
      profile.stats.following
    );
    profile.stats.likes = normalize(stats.likes, profile.stats.likes);
    profile.stats.interactions = normalize(
      stats.interactions,
      profile.stats.interactions
    );
  }
  if (!showEditModal.value) {
    editForm.displayName = profile.name;
    editForm.tagline = profile.tagline ?? "";
    editForm.defaultPrompt = profile.defaultPrompt ?? "";
  }
}

async function loadProfile() {
  if (!authStore.user) {
    return;
  }
  try {
    isLoadingProfile.value = true;
    const response = await fetchProfileRequest();
    if (response) {
      applyProfileData(response);
      authStore.profile = response;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to load profile", error);
  } finally {
    isLoadingProfile.value = false;
  }
}
watch(
  () => authStore.profile,
  (value) => {
    if (value) {
      applyProfileData(value);
    }
  },
  { immediate: true }
);
watch(
  () => authStore.user,
  (user) => {
    if (!user) {
      return;
    }
    profile.uid = user.uid ?? profile.uid ?? "";
    profile.id = profile.uid || profile.id || "—";
    if (!profile.name || profile.name === DEFAULT_PROFILE_NAME) {
      profile.name = user.displayName ?? profile.name ?? DEFAULT_PROFILE_NAME;
    }
    if (!profile.photoURL && user.photoURL) {
      profile.photoURL = user.photoURL;
      profile.avatarPreset = null;
      profile.avatar = user.photoURL;
    }
  },
  { immediate: true }
);

function isPresetSelected(option) {
  if (!option || typeof option !== "object") {
    return false;
  }
  if (profile.photoURL) {
    return false;
  }
  return profile.avatarPreset === option.id;
}

function openAvatarPicker() {
  avatarUploadError.value = "";
  showAvatarPicker.value = true;
}
function closeAvatarPicker() {
  showAvatarPicker.value = false;
  showCropperModal.value = false;
  avatarUploadError.value = "";
  cleanupPendingAvatar();
  if (avatarFileInput.value) {
    avatarFileInput.value.value = "";
  }
}
function toggleAvatarPicker() {
  if (showAvatarPicker.value) {
    closeAvatarPicker();
  } else {
    openAvatarPicker();
  }
}

async function applyPresetAvatar(option) {
  if (!option || isUploadingAvatar.value) {
    return;
  }
  avatarUploadError.value = "";
  isUploadingAvatar.value = true;
  try {
    const profileResponse = await updateProfileRequest({
      avatarPreset: option.id,
      photoURL: null,
      photoStoragePath: null,
    });
    if (!profileResponse) {
      throw new Error("頭像更新失敗，請稍後再試");
    }
    applyProfileData(profileResponse);
    authStore.profile = profileResponse;
    closeAvatarPicker();
  } catch (error) {
    avatarUploadError.value = error?.message ?? "頭像更新失敗，請稍後再試";
  } finally {
    isUploadingAvatar.value = false;
  }
}

function triggerAvatarUpload() {
  avatarUploadError.value = "";
  if (isUploadingAvatar.value || showCropperModal.value) {
    return;
  }
  const input = avatarFileInput.value;
  if (input && typeof input.click === "function") {
    input.click();
  }
}
async function handleAvatarFileChange(event) {
  if (isUploadingAvatar.value) {
    return;
  }
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }
  const fileType = (file.type ?? "").toLowerCase();
  if (!ACCEPTED_AVATAR_TYPES.includes(fileType)) {
    avatarUploadError.value = "僅支援 JPG、PNG、WebP 或 GIF 圖片";
    if (input) {
      input.value = "";
    }
    return;
  }
  if (file.size > MAX_AVATAR_FILE_SIZE) {
    avatarUploadError.value = "檔案大小不可超過 10 MB";
    if (input) {
      input.value = "";
    }
    return;
  }
  avatarUploadError.value = "";
  cleanupPendingAvatar();
  pendingAvatarFile.value = file;
  if (typeof window !== "undefined" && typeof URL !== "undefined") {
    avatarCropPreviewUrl.value = URL.createObjectURL(file);
  } else {
    avatarCropPreviewUrl.value = "";
  }
  showCropperModal.value = true;
  const fileInput = avatarFileInput.value;
  if (fileInput) {
    fileInput.value = "";
  }
  if (input) {
    input.value = "";
  }
}


function cleanupPendingAvatar() {
  if (typeof window !== "undefined" && typeof URL !== "undefined" && avatarCropPreviewUrl.value) {
    try {
      URL.revokeObjectURL(avatarCropPreviewUrl.value);
    } catch (_error) {}
  }
  avatarCropPreviewUrl.value = "";
  pendingAvatarFile.value = null;
}

function handleCropperClose() {
  showCropperModal.value = false;
  cleanupPendingAvatar();
  avatarUploadError.value = "";
}

async function handleCropperConfirm(blob) {
  if (!blob || !(blob instanceof Blob) || isUploadingAvatar.value) {
    return;
  }
  avatarUploadError.value = "";
  isUploadingAvatar.value = true;
  try {
    const sourceFile = pendingAvatarFile.value;
    const mimeType = blob.type || sourceFile?.type || "image/png";
    const extension = mimeType.startsWith("image/") ? mimeType.split("/")[1] ?? "png" : "png";
    const fileName = `avatar-${Date.now()}.${extension}`;
    const uploadFile = blob instanceof File ? blob : new File([blob], fileName, { type: mimeType });
    const uploadResult = await uploadProfileAvatarRequest(uploadFile);
    const profileResponse = uploadResult?.profile ?? null;
    const downloadURL = uploadResult?.downloadURL ?? profileResponse?.photoURL ?? null;
    const storagePath = uploadResult?.storagePath ?? profileResponse?.photoStoragePath ?? null;
    if (!profileResponse || !downloadURL || !storagePath) {
      throw new Error("頭像更新失敗，請稍後再試");
    }
    applyProfileData(profileResponse);
    authStore.profile = profileResponse;
    showCropperModal.value = false;
    cleanupPendingAvatar();
    closeAvatarPicker();
  } catch (error) {
    avatarUploadError.value = error?.message ?? "頭像更新失敗，請稍後再試";
  } finally {
    isUploadingAvatar.value = false;
    const input = avatarFileInput.value;
    if (input) {
      input.value = "";
    }
  }
}

function goToNotifications() {
  router.push({ name: "profileNotifications" }).catch(() => {});
}
function goToWallet() {
  router.push({ name: "store", query: { mode: "coins" } }).catch(() => {});
}
function goToVip() {
  router.push({ name: "store", query: { mode: "vip" } }).catch(() => {});
}
function goToFavorites() {
  router.push({ name: "profileFavorites" }).catch(() => {});
}

function createRole() {
  router.push({ name: "aiRoleCreate" }).catch(() => {});
}
function viewRole(role) {
  console.info("open role detail", role.id);
}

function openDiscord() {
  if (typeof window !== "undefined") {
    window.open("https://discord.gg/lovestory", "_blank", "noopener");
  }
}

function openEdit() {
  profileSaveError.value = "";
  editForm.displayName = profile.name ?? "";
  editForm.tagline = profile.tagline ?? "";
  editForm.defaultPrompt = profile.defaultPrompt ?? "";
  showEditModal.value = true;
}
function closeEdit() {
  profileSaveError.value = "";
  showEditModal.value = false;
}
async function saveProfile() {
  if (isSavingProfile.value) {
    return;
  }
  profileSaveError.value = "";
  const payload = {
    displayName: editForm.displayName.trim(),
    tagline: editForm.tagline.trim(),
    defaultPrompt: editForm.defaultPrompt.trim(),
  };
  isSavingProfile.value = true;
  try {
    const updatedProfile = await updateProfileRequest(payload);
    if (!updatedProfile) {
      throw new Error("未提供可更新的欄位");
    }
    applyProfileData(updatedProfile);
    authStore.profile = updatedProfile;
    showEditModal.value = false;
  } catch (error) {
    profileSaveError.value = error?.message ?? "儲存個人資料失敗，請稍後再試";
  } finally {
    isSavingProfile.value = false;
  }
}

function openSettings() {
  showSettings.value = true;
}
function closeSettings() {
  showSettings.value = false;
}

async function logout() {
  try {
    await authStore.logout();
    await authStore.ensureAuthReady();
  } finally {
    showSettings.value = false;
    router.push({ name: "login" }).catch(() => {});
  }
}

onBeforeUnmount(() => {
  cleanupPendingAvatar();
});

onMounted(async () => {
  await authStore.ensureAuthReady();
  await loadProfile();
});
</script>
<style scoped>
.profile-view {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding: 1.5rem 1.5rem 3rem;
}
.profile-hero {
  background: linear-gradient(180deg, #ff77d5 0%, #8b46f8 100%);
  border-radius: 1.5rem;
  padding: 1.25rem 1.5rem 1.75rem;
  color: #fff;
  box-shadow: 0 20px 40px rgba(138, 59, 199, 0.35);
}
.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.vip-button {
  border: none;
  padding: 0.45rem 1.3rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  color: #ff3b9b;
  font-weight: 700;
  font-size: 0.85rem;
}
.hero-actions {
  display: flex;
  gap: 0.55rem;
}
.icon-button {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  display: grid;
  place-items: center;
}
.icon-button svg {
  width: 20px;
  height: 20px;
}
.hero-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
  margin-top: 1.4rem;
}
.avatar-wrapper {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  padding: 4px;
  background: rgba(255, 255, 255, 0.35);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.avatar-edit-button {
  position: absolute;
  bottom: -6px;
  right: -6px;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff7cd6, #ff3fa7);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 26px rgba(255, 120, 210, 0.35);
  cursor: pointer;
}
.avatar-edit-button svg {
  width: 18px;
  height: 18px;
}
.avatar-picker {
  width: 100%;
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 1.25rem;
  background: rgba(18, 21, 33, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.avatar-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.avatar-picker__header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}
.avatar-picker__close {
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
}
.avatar-upload {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border-radius: 1rem;
  background: rgba(12, 16, 27, 0.85);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.avatar-upload__input {
  display: none;
}
.avatar-upload__button {
  align-self: center;
  border: none;
  border-radius: 999px;
  padding: 0.55rem 1.2rem;
  background: linear-gradient(135deg, #ff7cd6, #ff3fa7);
  color: #fff;
  font-weight: 700;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}
.avatar-upload__button[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.avatar-upload__error {
  margin: 0;
  font-size: 0.75rem;
  color: #fca5a5;
}
.avatar-upload__hint {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}
.avatar-wrapper img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.hero-body h1 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
}
.profile-id {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.85;
}
.profile-stats {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  width: 100%;
  margin-top: 1.2rem;
}
.profile-stats li {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  background: rgba(255, 255, 255, 0.16);
  padding: 0.7rem 0.6rem;
  border-radius: 1rem;
}
.profile-stats strong {
  font-size: 1rem;
  font-weight: 700;
}
.profile-stats span {
  font-size: 0.75rem;
  opacity: 0.85;
}
.profile-shortcuts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  background: rgba(14, 15, 22, 0.9);
  border-radius: 1.5rem;
  padding: 0.9rem 0.6rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.profile-shortcuts button {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
}
.shortcut-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  display: grid;
  place-items: center;
}
.shortcut-icon svg {
  width: 20px;
  height: 20px;
}
.shortcut-label {
  font-weight: 600;
}
.roles-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: rgba(18, 20, 29, 0.95);
  border-radius: 1.5rem;
  padding: 1.25rem 1.35rem 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.roles-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.roles-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}
.create-button {
  border: none;
  border-radius: 999px;
  padding: 0.45rem 1rem;
  background: linear-gradient(135deg, #ff82d9, #ff459e);
  color: #fff;
  font-weight: 600;
  font-size: 0.85rem;
}
.roles-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.role-card {
  width: 100%;
  display: grid;
  grid-template-columns: 72px 1fr auto;
  align-items: center;
  gap: 0.9rem;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  padding: 0.9rem 1rem;
  border-radius: 1.2rem;
  text-align: left;
  color: #fdf6ff;
}
.role-image {
  width: 72px;
  height: 72px;
  border-radius: 1rem;
  overflow: hidden;
}
.role-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.role-info h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}
.role-meta {
  margin: 0.3rem 0 0;
  font-size: 0.85rem;
  opacity: 0.75;
}
.role-chevron {
  width: 22px;
  height: 22px;
  color: rgba(255, 255, 255, 0.6);
}
.modal-backdrop,
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(5, 7, 12, 0.78);
  display: grid;
  place-items: center;
  padding: 1.25rem;
  z-index: 20;
}
.modal-card,
.settings-sheet {
  width: 100%;
  max-width: 420px;
  background: rgba(18, 20, 29, 0.98);
  border-radius: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 25px 60px rgba(10, 10, 18, 0.55);
}
.modal-card {
  padding: 1.5rem;
}
.modal-header,
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}
.modal-header h2,
.settings-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}
.close-button {
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 1.2rem;
}
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.modal-form label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.9rem;
}
.modal-form input,
.modal-form textarea {
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(9, 11, 16, 0.9);
  padding: 0.75rem 1rem;
  color: #f7f8ff;
}
.modal-form textarea {
  resize: none;
}
.avatar-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.avatar-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
}
.avatar-section__hint {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}
.avatar-preview {
  display: flex;
  justify-content: center;
}
.avatar-preview img {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  box-shadow: 0 12px 24px rgba(255, 120, 210, 0.35);
  object-fit: cover;
}
.avatar-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
  gap: 0.75rem;
}
.avatar-option {
  border: 1px solid transparent;
  border-radius: 1rem;
  padding: 0.5rem;
  background: rgba(9, 11, 16, 0.85);
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease,
    border-color 0.18s ease;
}
.avatar-option img {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-option:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(255, 120, 210, 0.2);
}
.avatar-option.selected {
  .avatar-upload {
    margin-top: 0.75rem;
    padding: 0.75rem;
    border-radius: 1rem;
    background: rgba(12, 16, 27, 0.85);
    border: 1px dashed rgba(255, 255, 255, 0.15);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .avatar-upload__input {
    display: none;
  }
  .avatar-upload__button {
    align-self: flex-start;
    border: none;
    border-radius: 999px;
    padding: 0.55rem 1.2rem;
    background: linear-gradient(135deg, #ff7cd6, #ff3fa7);
    color: #fff;
    font-weight: 700;
    font-size: 0.85rem;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
  }
  .avatar-upload__button[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .avatar-upload__error {
    margin: 0;
    font-size: 0.75rem;
    color: #fca5a5;
  }
  .avatar-upload__hint {
    margin: 0;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }
  border-color: rgba(255, 120, 210, 0.75);
  box-shadow: 0 12px 28px rgba(255, 120, 210, 0.35);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
.modal-error {
  margin-top: 0.5rem;
  color: #fca5a5;
  font-size: 0.8rem;
}
.modal-cancel {
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.75);
  padding: 0.6rem 1.2rem;
  border-radius: 999px;
}
.modal-submit {
  border: none;
  border-radius: 999px;
  padding: 0.6rem 1.5rem;
  background: linear-gradient(135deg, #ff7cd6, #ff3fa7);
  color: #fff;
  font-weight: 700;
}
.settings-sheet {
  padding: 1.5rem;
}
.settings-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.settings-list button {
  width: 100%;
  border: none;
  border-radius: 1rem;
  padding: 0.85rem 1rem;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  text-align: left;
  font-weight: 600;
}
.logout-button {
  background: rgba(247, 86, 120, 0.2);
  color: #ff8ba7;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@media (max-width: 420px) {
  .profile-view {
    padding: 1.25rem 1rem 2.75rem;
  }
  .profile-shortcuts {
    padding: 0.75rem 0.4rem;
  }
  .roles-section {
    padding: 1.1rem;
  }
}
</style>



