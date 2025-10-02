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
const origins = (process.env.FRONTEND_ORIGIN ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: origins.length ? origins : true,
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
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

