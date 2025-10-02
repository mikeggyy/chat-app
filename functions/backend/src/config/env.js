import dotenv from "dotenv";

let loaded = false;

export function loadEnv() {
  if (loaded) return;

  const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
  dotenv.config({ path: envFile, override: false });
  mergeFirebaseRuntimeConfig();
  loaded = true;
}

export function requiredEnv(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === null || value === "") {
    throw new Error(`Environment variable ${key} is required.`);
  }
  return value;
}

function mergeFirebaseRuntimeConfig() {
  if (process.env.__FIREBASE_RUNTIME_CONFIG_MERGED__) {
    return;
  }

  if (process.env.FIREBASE_CONFIG) {
    try {
      const config = JSON.parse(process.env.FIREBASE_CONFIG);
      if (!process.env.FIREBASE_PROJECT_ID && config.projectId) {
        process.env.FIREBASE_PROJECT_ID = config.projectId;
      }
      if (!process.env.FIREBASE_STORAGE_BUCKET && config.storageBucket) {
        process.env.FIREBASE_STORAGE_BUCKET = config.storageBucket;
      }
    } catch (error) {
      console.warn("Failed to parse FIREBASE_CONFIG runtime env", error);
    }
  }

  process.env.__FIREBASE_RUNTIME_CONFIG_MERGED__ = "true";
}
