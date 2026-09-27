import { fetch } from 'expo/fetch';
import { GLM_API_KEY, GLM_BASE_URL, GLM_MODEL } from '../config';

/**
 * Streaming client for Zhipu's GLM chat completions endpoint.
 *
 * React Native's global `fetch` is XHR-backed and has no readable body, so we
 * use `expo/fetch`, which does — that is what lets the summary and the report
 * render token by token instead of appearing all at once.
 */

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type StreamOptions = {
  messages: ChatMessage[];
  /** Called with each new fragment of visible text. */
  onDelta?: (chunk: string, full: string) => void;
  /** Ask GLM to emit a single JSON object. */
  json?: boolean;
  /**
   * GLM-5 reasons before answering by default, which costs several seconds.
   * Turn it off for the short structured calls and leave it on for the
   * narrative report, where the extra reasoning is worth the wait.
   */
  think?: boolean;
  /** Called with the model's reasoning stream, when thinking is on. */
  onReasoning?: (chunk: string) => void;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export class GlmError extends Error {}

export async function streamChat({
  messages,
  onDelta,
  json = false,
  think = false,
  onReasoning,
  temperature = 0.6,
  maxTokens = 1600,
  signal,
}: StreamOptions): Promise<string> {
  if (!GLM_API_KEY) throw new GlmError('No GLM API key configured.');

  const response = await fetch(`${GLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GLM_API_KEY}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: GLM_MODEL,
      messages,
      stream: true,
      temperature,
      max_tokens: maxTokens,
      thinking: { type: think ? 'enabled' : 'disabled' },
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new GlmError(`GLM request failed (${response.status}). ${detail.slice(0, 200)}`);
  }
  if (!response.body) throw new GlmError('GLM returned an empty stream.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let finishReason: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line; keep any partial tail.
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      for (const line of event.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let parsed: any;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }
        const choice = parsed?.choices?.[0];
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        const delta = choice?.delta;
        if (delta?.reasoning_content) onReasoning?.(delta.reasoning_content);
        if (delta?.content) {
          full += delta.content;
          onDelta?.(delta.content, full);
        }
      }
    }
  }

  // Hitting the cap mid-object yields unparseable JSON. Surface it so the
  // caller falls back cleanly rather than failing later on a confusing
  // parse error.
  if (finishReason === 'length') {
    throw new GlmError('GLM hit the token cap before finishing its response.');
  }

  return full;
}

/** Strips ```json fences and grabs the outermost object GLM produced. */
export function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new GlmError('GLM did not return JSON.');
  }
  return JSON.parse(text.slice(start, end + 1));
}

/** Streams a JSON response and validates it with the supplied zod schema. */
export async function streamJson<T>(
  schema: { parse: (input: unknown) => T },
  options: Omit<StreamOptions, 'json'>,
): Promise<T> {
  const raw = await streamChat({
    ...options,
    json: true,
    temperature: options.temperature ?? 0.2,
  });
  return schema.parse(extractJson(raw));
}
