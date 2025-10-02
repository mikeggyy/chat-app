import admin from 'firebase-admin';
import { loadEnv } from '../config/env.js';

loadEnv();

function parseServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (json) {
    return JSON.parse(json);
  }

  if (base64) {
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(decoded);
  }

  return null;
}

function resolveStorageBucket() {
  const bucketFromEnv =
    process.env.FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET_NAME;

  if (bucketFromEnv) {
    return bucketFromEnv.replace(/^gs:\/\//, '');
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (projectId) {
    return `${projectId}.appspot.com`;
  }

  return null;
}

if (!admin.apps.length) {
  const serviceAccount = parseServiceAccount();

  const credential = serviceAccount
    ? admin.credential.cert(serviceAccount)
    : admin.credential.applicationDefault();

  const options = {
    credential,
  };

  if (process.env.FIREBASE_PROJECT_ID) {
    options.projectId = process.env.FIREBASE_PROJECT_ID;
  }

  const storageBucket = resolveStorageBucket();
  if (storageBucket) {
    options.storageBucket = storageBucket;
  }

  admin.initializeApp(options);
}

export const firebaseAdmin = admin;
export const auth = admin.auth();
export const firestore = admin.firestore();
export const messaging = admin.messaging();
export const storage = admin.storage();