import { apiRequest } from './apiClient';

function pruneUndefined(payload = {}) {
  return Object.entries(payload).reduce((accumulator, [key, value]) => {
    if (value !== undefined) {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});
}

export async function fetchProfile() {
  const response = await apiRequest('/profile');
  return response?.data ?? null;
}

export async function updateProfile(updates = {}) {
  const body = pruneUndefined(updates);
  if (!Object.keys(body).length) {
    throw new Error('請提供要更新的欄位');
  }

  const response = await apiRequest('/profile', {
    method: 'PUT',
    body,
  });

  return response?.data ?? null;
}

export async function uploadProfileAvatar(file) {
  if (!(file instanceof File)) {
    throw new Error('無效的頭像檔案');
  }

  const formData = new FormData();
  formData.append('avatar', file);

  const response = await apiRequest('/profile/avatar', {
    method: 'POST',
    body: formData,
  });

  return response?.data ?? null;
}
