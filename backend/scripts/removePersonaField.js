import process from "node:process";
import path from "node:path";
import fs from "node:fs";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue, FieldPath } from "firebase-admin/firestore";

function resolveServiceAccount() {
  const explicitPath =
    process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!explicitPath) {
    return null;
  }

  const absolutePath = path.isAbsolute(explicitPath)
    ? explicitPath
    : path.resolve(process.cwd(), explicitPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Service account file not found at ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(content);
}

function initializeFirestore() {
  const serviceAccount = resolveServiceAccount();
  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    initializeApp({
      credential: applicationDefault(),
    });
  }

  return getFirestore();
}

async function removePersonaField() {
  const db = initializeFirestore();
  const usersCollection = db.collection("users");
  const batchSize = Number.parseInt(process.env.BATCH_SIZE ?? "300", 10);
  let processed = 0;
  let updated = 0;

  let lastDoc = null;
  while (true) {
    let query = usersCollection.orderBy(FieldPath.documentId()).limit(batchSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    let batchUpdates = 0;
    snapshot.docs.forEach((doc) => {
      processed += 1;
      const data = doc.data();
      if (data && Object.prototype.hasOwnProperty.call(data, "persona")) {
        batch.update(doc.ref, { persona: FieldValue.delete() });
        batchUpdates += 1;
      }
    });

    if (batchUpdates > 0) {
      await batch.commit();
      updated += batchUpdates;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  console.log(JSON.stringify({ processed, updated }, null, 2));
}

removePersonaField().catch((error) => {
  console.error("Failed to remove persona field", error);
  process.exitCode = 1;
});
