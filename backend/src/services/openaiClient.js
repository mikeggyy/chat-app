import OpenAI from 'openai';
import { loadEnv, requiredEnv } from '../config/env.js';

loadEnv();

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1';
const MAX_OUTPUT_TOKENS = 600;

export const openAiModel = DEFAULT_MODEL;

export const openai = new OpenAI({
  apiKey: requiredEnv('OPENAI_API_KEY'),
});

function isChatCompletionsModel(model) {
  if (!model) return false;
  return model.startsWith('gpt-3.5');
}

function normalizeResponseText(text) {
  if (typeof text !== 'string') {
    return '';
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
            type: 'output_text',
            text: normalized,
          },
        ],
      },
    ],
  };
}

export async function streamChatCompletion(messages, options = {}) {
  const model = options.model ?? openAiModel;
  const temperature = options.temperature ?? 0.8;
  const maxOutputTokens = options.maxOutputTokens ?? MAX_OUTPUT_TOKENS;
  const stream = options.stream ?? false;

  if (isChatCompletionsModel(model)) {
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxOutputTokens,
      stream,
    });

    const choice = Array.isArray(response.choices) ? response.choices[0] : null;
    const text = choice?.message?.content ?? '';
    return wrapTextResponse(text);
  }

  const response = await openai.responses.create({
    model,
    input: messages,
    temperature,
    max_output_tokens: maxOutputTokens,
    stream,
    metadata: options.metadata,
  });

  return response;
}
