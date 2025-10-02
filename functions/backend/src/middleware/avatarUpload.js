import multer from 'multer';

function imageFileFilter(_req, file, cb) {
  if (!file?.mimetype) {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'avatar'));
    return;
  }

  if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'avatar'));
}

export const AVATAR_UPLOAD_LIMIT = 10 * 1024 * 1024; // 10MB

const storage = multer.memoryStorage();

export const avatarUpload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: AVATAR_UPLOAD_LIMIT,
    files: 1,
  },
});
