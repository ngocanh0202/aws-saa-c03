import type { FirebaseApp } from 'firebase/app';
import { GoogleAIBackend, Schema, getAI, getGenerativeModel, type Part } from 'firebase/ai';
import type { AiClient, AiTool } from './types';
import { prepareHistory } from './prompt';
import { AiBusyError, parseRetryDelay } from './retry';
import { toolLoop } from './tool-loop';

function declare(tool: AiTool) {
  const entries = Object.entries(tool.params);
  // Tool không có tham số (open_guide) thì không gửi parameters.
  if (entries.length === 0) return { name: tool.name, description: tool.description };
  const properties = Object.fromEntries(entries.map(([k, description]) => [k, Schema.string({ description })]));
  return { name: tool.name, description: tool.description, parameters: Schema.object({ properties }) };
}

/** Lỗi hết lượt (429) / quá tải (503) của SDK → AiBusyError (kèm thời gian chờ Gemini báo, nếu có). */
function toBusyError(e: unknown): AiBusyError | undefined {
  const data = (e as { customErrorData?: { status?: unknown; errorDetails?: unknown } } | null)?.customErrorData;
  if (data?.status !== 429 && data?.status !== 503) return undefined;
  return new AiBusyError(data.status, parseRetryDelay(data.errorDetails));
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
              const { stream, response } = await session.sendMessageStream(request).catch((e: unknown) => {
                throw toBusyError(e) ?? e;
              });
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
