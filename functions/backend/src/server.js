import app from './app.js';
import { loadEnv } from './config/env.js';

loadEnv();

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

function start() {
  app.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://${host}:${port}`);
  });
}

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Promise rejection', reason);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught exception', error);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

start();

