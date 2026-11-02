import type { FirebaseApp } from 'firebase/app';
import { GoogleAIBackend, getAI, getGenerativeModel } from 'firebase/ai';
import type { AiClient } from './types';
import { prepareHistory } from './prompt';

/** Duy nhất file này import firebase/ai. */
export function createGeminiClient(app: FirebaseApp, model: string): AiClient {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const generative = getGenerativeModel(ai, { model });
  return {
    startChat(systemPrompt, history) {
      const session = generative.startChat({
        systemInstruction: systemPrompt,
        history: prepareHistory(history).map((m) => ({ role: m.role, parts: [{ type: 'text', text: m.text }] })),
      });
      return {
        async *send(text) {
          const { stream } = await session.sendMessageStream(text);
          for await (const chunk of stream) yield chunk.text();
        },
      };
    },
  };
}
