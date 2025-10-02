import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {setGlobalOptions} from "firebase-functions/v2/options";
import {onRequest} from "firebase-functions/v2/https";

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendAppPromise = loadBackendApp();

/**
 * 載入複製到 Functions 套件內的 Express 應用。
 * @returns {Promise<import("express").Express>} 已載入的 Express 應用。
 */
async function loadBackendApp() {
  const candidates = [
    path.join(__dirname, "..", "backend", "src", "app.js"),
    path.join(__dirname, "backend", "src", "app.js"),
  ];

  for (const candidate of candidates) {
    try {
      const moduleUrl = pathToFileURL(candidate).href;
      const module = await import(moduleUrl);
      return module.default ?? module.app ?? module;
    } catch (error) {
      if (error.code === "ERR_MODULE_NOT_FOUND" ||
          error.code === "MODULE_NOT_FOUND") {
        continue;
      }
      throw error;
    }
  }

  throw new Error("找不到 backend/src/app.js，請先同步後端程式碼。");
}

export const api = onRequest(async (request, response) => {
  const app = await backendAppPromise;
  return app(request, response);
});


