import { GROQ_API_KEY, GROQ_MODEL } from '../config';
import { appendAudio, uploadError } from './upload';

/**
 * Client for Groq's hosted Whisper (`/openai/v1/audio/transcriptions`).
 *
 * Groq has no streaming speech endpoint, so this takes a finished recording and
 * returns the whole transcript at once. Kept as the fallback batch provider:
 * its free tier is permanent rather than a credit that runs out, which makes it
 * the one that still works when nothing else is configured.
 */

const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * Whisper accepts a short prompt to bias spelling. Keeping it to a plain word
 * list — no instructions — steers the clinical vocabulary without the model
 * echoing the prompt back when a recording turns out to be silent.
 */
const VOCABULARY =
  'tic, tics, premonitory urge, blinking, eye rolling, throat clearing, head jerk, shoulder shrug, sniffing, grunting, competing response';

/** Uploads one finished recording and returns its transcript. */
export async function transcribeRecording({ uri }: { uri: string }): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('Speech credentials are not configured. Type your answer instead.');
  }

  const form = new FormData();
  await appendAudio(form, uri);
  form.append('model', GROQ_MODEL);
  form.append('language', 'en');
  form.append('response_format', 'json');
  // Greedy decoding. Whisper invents text when it is allowed to sample.
  form.append('temperature', '0');
  form.append('prompt', VOCABULARY);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      // Content-Type is deliberately unset: fetch has to add the multipart
      // boundary itself, and naming the header overwrites it.
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: form,
    });
  } catch {
    throw new Error('Could not reach the speech service. Check your connection.');
  }

  if (!response.ok) {
    // The body carries `{ error: { message } }`, which is the most useful thing
    // to surface, but it is not guaranteed to be JSON on a gateway error.
    const detail = await response
      .json()
      .then((body: any) => body?.error?.message as string | undefined)
      .catch(() => undefined);
    throw uploadError(response.status, detail);
  }

  const body = (await response.json()) as { text?: string };
  return (body.text ?? '').trim();
}
