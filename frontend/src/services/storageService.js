import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  ref as storageRef,
  uploadBytesResumable,
} from "firebase/storage";
import { storage } from "../firebase/storage";

const DEFAULT_FOLDER = "user-uploads";

const FILENAME_SAFE_REGEX = /[^a-zA-Z0-9-_]/g;

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeSegment(segment) {
  if (!segment) return null;
  return segment
    .toString()
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(FILENAME_SAFE_REGEX, "")
    .toLowerCase() || null;
}

function ensureImageFile(file) {
  if (!file) {
    throw new Error("�Х���ܭn�W�Ǫ��Ϥ�");
  }

  const isFileLike = typeof File !== "undefined" && file instanceof File;
  const isBlobLike = typeof Blob !== "undefined" && file instanceof Blob;

  if (!isFileLike && !isBlobLike) {
    throw new Error("�Ȥ䴩�s���������ɮש� Blob ����");
  }

  const contentType = file.type ?? "";
  if (contentType && !contentType.startsWith("image/")) {
    throw new Error("�Ȥ䴩�W�ǹϤ��榡");
  }
}

function inferExtension(file, fallback = "jpg") {
  if (!file) return fallback;
  const name = typeof file.name === "string" ? file.name : "";
  const extFromName = name.includes(".") ? name.split(".").pop() : "";

  if (extFromName) {
    return extFromName.trim().toLowerCase().replace(FILENAME_SAFE_REGEX, "") || fallback;
  }

  const contentType = file.type ?? "";
  if (contentType.startsWith("image/")) {
    return contentType.substring(6).replace(FILENAME_SAFE_REGEX, "") || fallback;
  }

  return fallback;
}

export function createStoragePath({
  folder = DEFAULT_FOLDER,
  userId,
  conversationId,
  prefix,
  file,
  extension,
} = {}) {
  const segments = [normalizeSegment(folder) ?? DEFAULT_FOLDER];

  const safeUser = normalizeSegment(userId);
  if (safeUser) {
    segments.push(`users/${safeUser}`);
  }

  const safeConversation = normalizeSegment(conversationId);
  if (safeConversation) {
    segments.push(`conversations/${safeConversation}`);
  }

  const now = new Date();
  segments.push(
    `${now.getUTCFullYear()}`,
    `${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
    `${String(now.getUTCDate()).padStart(2, "0")}`
  );

  const baseName = normalizeSegment(prefix) ?? normalizeSegment(file?.name?.split(".").shift()) ?? `img-${randomId()}`;
  const safeExtension = normalizeSegment(extension ?? inferExtension(file)) ?? "jpg";
  segments.push(`${baseName}-${Date.now()}-${randomId()}.${safeExtension}`);

  return segments.join("/");
}

function getRefFromPathOrUrl(pathOrUrl) {
  if (!pathOrUrl) {
    throw new Error("�ݭn���� Storage ���|�ΤU�����}");
  }

  if (pathOrUrl.startsWith("gs://")) {
    const bucket = storage.app?.options?.storageBucket;
    if (bucket && pathOrUrl.startsWith(`gs://${bucket}/`)) {
      const fullPath = pathOrUrl.slice(bucket.length + 5);
      return storageRef(storage, fullPath);
    }
    return storageRef(storage, pathOrUrl);
  }

  if (pathOrUrl.startsWith("http")) {
    try {
      const url = new URL(pathOrUrl);
      const fullPath = decodeURIComponent(url.pathname.split("/o/").pop() ?? "").split("?").shift();
      if (!fullPath) {
        throw new Error("�L�k�q�U�����}�ѪR Storage ���|");
      }
      return storageRef(storage, fullPath);
    } catch (error) {
      throw new Error("�U�����}�榡�����T�A�L�k�ѪR�����ɮ�");
    }
  }

  return storageRef(storage, pathOrUrl);
}

export async function uploadImage(file, {
  folder,
  userId,
  conversationId,
  prefix,
  path,
  metadata = {},
  onProgress,
  signal,
} = {}) {
  ensureImageFile(file);

  const resolvedPath = path ?? createStoragePath({
    folder,
    userId,
    conversationId,
    prefix,
    file,
  });

  const storageReference = storageRef(storage, resolvedPath);
  const uploadMetadata = {
    contentType: file.type ?? metadata.contentType ?? "image/jpeg",
    cacheControl: metadata.cacheControl ?? "public, max-age=31536000",
    ...metadata,
  };

  const uploadTask = uploadBytesResumable(storageReference, file, uploadMetadata);

  return new Promise((resolve, reject) => {
    const abortHandler = () => {
      uploadTask.cancel();
      reject(new DOMException("Upload aborted", "AbortError"));
    };

    if (signal) {
      if (signal.aborted) {
        abortHandler();
        return;
      }
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (typeof onProgress === "function" && snapshot.totalBytes) {
          onProgress(snapshot.bytesTransferred / snapshot.totalBytes, snapshot);
        }
      },
      (error) => {
        if (signal) {
          signal.removeEventListener("abort", abortHandler);
        }
        reject(error instanceof Error ? error : new Error("�Ϥ��W�ǥ���"));
      },
      async () => {
        if (signal) {
          signal.removeEventListener("abort", abortHandler);
        }
        try {
          const [downloadURL, meta] = await Promise.all([
            getDownloadURL(uploadTask.snapshot.ref),
            getMetadata(uploadTask.snapshot.ref),
          ]);
          resolve({
            downloadURL,
            fullPath: uploadTask.snapshot.ref.fullPath,
            metadata: meta,
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error("���o�Ϥ���T����"));
        }
      }
    );
  });
}

export async function deleteFromStorage(pathOrUrl) {
  const reference = getRefFromPathOrUrl(pathOrUrl);
  await deleteObject(reference);
}

export async function getImageDownloadURL(pathOrUrl) {
  const reference = getRefFromPathOrUrl(pathOrUrl);
  return getDownloadURL(reference);
}


