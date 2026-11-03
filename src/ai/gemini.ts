import type { FirebaseApp } from 'firebase/app';
import { GoogleAIBackend, Schema, getAI, getGenerativeModel, type Part } from 'firebase/ai';
import type { AiClient, AiTool } from './types';
import { prepareHistory } from './prompt';
import { toolLoop } from './tool-loop';

function declare(tool: AiTool) {
  const properties = Object.fromEntries(Object.entries(tool.params).map(([k, description]) => [k, Schema.string({ description })]));
  return { name: tool.name, description: tool.description, parameters: Schema.object({ properties }) };
}

/** Duy nhất file này import firebase/ai. */
export function createGeminiClient(app: FirebaseApp, model: string): AiClient {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const generative = getGenerativeModel(ai, { model });
  return {
    startChat(systemPrompt, history, options = {}) {
      const tools = options.tools?.length ? [{ functionDeclarations: options.tools.map(declare) }] : undefined;
      const session = generative.startChat({
        systemInstruction: systemPrompt,
        history: prepareHistory(history).map((m) => ({ role: m.role, parts: [{ type: 'text', text: m.text }] })),
        tools,
      });
      return {
        send(text) {
          return toolLoop(
            async (turn) => {
              const request: string | Part[] =
                typeof turn === 'string' ? turn : turn.map((r) => ({ type: 'functionResponse', functionResponse: r }));
              const { stream, response } = await session.sendMessageStream(request);
              return {
                chunks: (async function* () {
                  for await (const chunk of stream) yield chunk.text();
                })(),
                calls: async () =>
                  ((await response).functionCalls() ?? []).map((c) => ({ name: c.name, args: (c.args ?? {}) as Record<string, unknown> })),
              };
            },
            text,
            options,
          );
        },
      };
    },
  };
}
