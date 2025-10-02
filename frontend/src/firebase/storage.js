import { getStorage } from "firebase/storage";
import { firebaseApp } from "./app";

const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;

export const storage = bucket
  ? getStorage(firebaseApp, `gs://${bucket}`)
  : getStorage(firebaseApp);

export function getStorageBucket() {
  return bucket ?? null;
}
