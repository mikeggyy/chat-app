import multer from 'multer';

export function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Not found' });
}

export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error(err);

  const isMulterError = err instanceof multer.MulterError;
  const status = err.status ?? (isMulterError ? 400 : 500);
  const message = err.message ?? (isMulterError ? '上傳頭像失敗' : 'Unexpected error');

  res.status(status).json({
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}
