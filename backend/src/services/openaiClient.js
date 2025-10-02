import OpenAI from "openai";
import { loadEnv } from "../config/env.js";

loadEnv();

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";
const MAX_OUTPUT_TOKENS = 600;

let openaiClient = null;
let loggedMissingKey = false;

export const openAiModel = DEFAULT_MODEL;

function resolveApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key && !loggedMissingKey) {
    console.warn("OPENAI_API_KEY 未設定，相關功能會回傳 500 錯誤");
    loggedMissingKey = true;
  }
  return key;
}

function ensureOpenAI() {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to call OpenAI services");
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export function getOpenAI() {
  return ensureOpenAI();
}

export const openai = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = ensureOpenAI();
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);

function isChatCompletionsModel(model) {
  if (!model) return false;
  return model.startsWith("gpt-3.5");
}

function normalizeResponseText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text;
}

function wrapTextResponse(text) {
  const normalized = normalizeResponseText(text);
  return {
    output: [
      {
        content: [
          {
            type: "output_text",
            text: normalized,
          },
        ],
      },
    ],
  };
}

export async function streamChatCompletion(messages, options = {}) {
  const client = ensureOpenAI();
  const model = options.model ?? openAiModel;
  const temperature = options.temperature ?? 0.8;
  const maxOutputTokens = options.maxOutputTokens ?? MAX_OUTPUT_TOKENS;
  const stream = options.stream ?? false;

  if (isChatCompletionsModel(model)) {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxOutputTokens,
      stream,
    });

    const choice = Array.isArray(response.choices) ? response.choices[0] : null;
    const text = choice?.message?.content ?? "";
    return wrapTextResponse(text);
  }

  const response = await client.responses.create({
    model,
    input: messages,
    temperature,
    max_output_tokens: maxOutputTokens,
    stream,
    metadata: options.metadata,
  });

  return response;
}
