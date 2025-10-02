import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { loadEnv } from './config/env.js';
import { healthCheck } from './controllers/healthController.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import router from './routes/index.js';

loadEnv();

const app = express();
const origins = (process.env.FRONTEND_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const DEV_CLIENT_PORT = process.env.DEV_CLIENT_PORT ?? '5173';
const devOriginPatterns = [
  new RegExp(`^https?://localhost(?::${DEV_CLIENT_PORT})?$`, 'i'),
  new RegExp(`^https?://127\\.0\\.0\\.1(?::${DEV_CLIENT_PORT})?$`, 'i'),
  new RegExp(`^https?://\[::1\](?::${DEV_CLIENT_PORT})?$`, 'i'),
  new RegExp(`^https?://\[[0-9a-f:]+\](?::${DEV_CLIENT_PORT})?$`, 'i'),
  new RegExp(`^https?://(?:\\d{1,3}\\.){3}\\d{1,3}(?::${DEV_CLIENT_PORT})?$`, 'i'),
];

function isAllowedDevOrigin(origin) {
  if (!origin || process.env.NODE_ENV === 'production') {
    return false;
  }

  return devOriginPatterns.some((pattern) => pattern.test(origin));
}

app.use(
  helmet({
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (!origins.length || origins.includes(origin)) {
        return callback(null, true);
      }

      if (isAllowedDevOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const uploadsRoot = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsRoot));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', healthCheck);
app.use('/api', router);
app.use(router);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;






