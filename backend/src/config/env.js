import dotenv from 'dotenv';
import { createRequire } from 'node:module';

let loaded = false;

export function loadEnv() {
  if (loaded) return;

  const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.local';
  dotenv.config({ path: envFile, override: false });
  mergeFirebaseRuntimeConfig();
  loaded = true;
}

export function requiredEnv(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === null || value === '') {
    throw new Error(`Environment variable ${key} is required.`);
  }
  return value;
}

function mergeFirebaseRuntimeConfig() {
  if (process.env.__FIREBASE_RUNTIME_CONFIG_MERGED__) {
    return;
  }

  let functions;
  try {
    const require = createRequire(import.meta.url);
    functions = require('firebase-functions');
  } catch (error) {
    return;
  }

  if (typeof functions?.config !== 'function') {
    return;
  }

  const runtimeConfig = functions.config();
  if (!runtimeConfig || typeof runtimeConfig !== 'object') {
    return;
  }

  if (!process.env.OPENAI_API_KEY && runtimeConfig.openai?.api_key) {
    process.env.OPENAI_API_KEY = runtimeConfig.openai.api_key;
  }

  if (!process.env.FIREBASE_PROJECT_ID && runtimeConfig.app?.project_id) {
    process.env.FIREBASE_PROJECT_ID = runtimeConfig.app.project_id;
  }

  if (!process.env.FIREBASE_STORAGE_BUCKET && runtimeConfig.app?.storage_bucket) {
    process.env.FIREBASE_STORAGE_BUCKET = runtimeConfig.app.storage_bucket;
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 && runtimeConfig.app?.service_account_base64) {
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = runtimeConfig.app.service_account_base64;
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && runtimeConfig.app?.service_account_json) {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = runtimeConfig.app.service_account_json;
  }

  process.env.__FIREBASE_RUNTIME_CONFIG_MERGED__ = 'true';
}


