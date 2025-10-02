import { processAvatarUpload } from '../services/avatarService.js';
import {
  getUserProfile as getUserProfileByUid,
  updateUserProfile as persistUserProfile,
} from '../services/userService.js';

export async function getProfile(req, res, next) {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const profile = await getUserProfileByUid(uid);
    return res.json({ data: profile });
  } catch (error) {
    return next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const updates = req.body ?? {};
    const profile = await persistUserProfile(uid, updates);

    if (!profile) {
      return res.status(400).json({ message: '未提供可更新的欄位' });
    }

    return res.json({ data: profile });
  } catch (error) {
    return next(error);
  }
}

export async function uploadAvatar(req, res, next) {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ message: '請提供頭像檔案' });
    }

    const uploadResult = await processAvatarUpload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      userId: uid,
    });

    const profile = await persistUserProfile(uid, {
      photoURL: uploadResult.downloadURL,
      photoStoragePath: uploadResult.storagePath,
      avatarPreset: null,
    });

    return res.status(201).json({
      data: {
        downloadURL: uploadResult.downloadURL,
        storagePath: uploadResult.storagePath,
        contentType: uploadResult.contentType,
        size: uploadResult.size,
        originalSize: file.size,
        profile,
      },
    });
  } catch (error) {
    return next(error);
  }
}
