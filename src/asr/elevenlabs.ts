import CryptoJS from 'crypto-js';
import { ELEVENLABS_API_KEY, ELEVENLABS_MODEL, ELEVENLABS_REALTIME_MODEL } from '../config';
import { appendAudio, uploadError } from './upload';
import type { StreamingHandlers, StreamingSession, TranscriptState } from './types';

/**
 * ElevenLabs Scribe, the only provider here that covers both paths:
 * `scribe_v2_realtime` over a WebSocket while the user talks, and `scribe_v2`
 * over multipart for a finished file in the browser.
 *
 * Unlike the other streaming providers, Scribe wants each audio frame as
 * base64 inside a JSON message rather than as a raw binary frame.
 */

const REALTIME_ENDPOINT = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';
const BATCH_ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';

/** ~100 ms of 16 kHz mono 16-bit audio per message. */
const FRAME_BYTES = 3200;

/**
 * React Native has no `Buffer` and no `btoa`. `crypto-js` is already a
 * dependency (iFlytek's signature uses it) and its Base64 encoder agrees with
 * `Buffer.toString('base64')` byte for byte, including on full frames.
 */
function toBase64(bytes: Uint8Array): string {
  return CryptoJS.lib.WordArray.create(bytes as unknown as number[]).toString(
    CryptoJS.enc.Base64,
  );
}

/** Scribe takes up to 50 keyterms; these are the words the app cares about. */
const KEYTERMS = [
  'tic',
  'tics',
  'premonitory urge',
  'blinking',
  'eye rolling',
  'throat clearing',
  'head jerk',
  'shoulder shrug',
  'sniffing',
  'grunting',
  'competing response',
];

function buildRealtimeUrl(): string {
  const params = new URLSearchParams({
    model_id: ELEVENLABS_REALTIME_MODEL,
    // Matches what `toMono16k` produces and what the mic is asked for.
    audio_format: 'pcm_16000',
    language_code: 'en',
    // Let the server close a segment on silence, so committed text arrives
    // during the sentence instead of only when the user stops.
    commit_strategy: 'vad',
  });
  // `keyterms` is a repeated parameter — one `keyterms=` per term. Passing the
  // list comma-joined, or as a JSON array, makes the server drop the handshake
  // without sending an error: no `session_started`, no transcript, no
  // explanation. Both were tried against the live endpoint.
  for (const term of KEYTERMS) params.append('keyterms', term);
  return `${REALTIME_ENDPOINT}?${params.toString()}`;
}

export class ElevenLabsSession implements StreamingSession {
  private ws: WebSocket | null = null;
  private open = false;
  private closed = false;
  /** Audio captured before the socket finished opening. */
  private pending: string[] = [];
  private carry = new Uint8Array(0);
  private state: TranscriptState = { final: '', partial: '' };
  /** Resolves when the server commits the segment `finish()` asked for. */
  private awaitCommit: (() => void) | null = null;

  constructor(private readonly handlers: StreamingHandlers = {}) {}

  get transcript(): string {
    return (this.state.final + this.state.partial).trim();
  }

  connect(): void {
    if (this.ws) return;
    // React Native's WebSocket takes a third options argument and can set
    // headers; a browser cannot, which is the other reason streaming is
    // native-only here. Client-side auth on web would need a single-use token
    // minted by our own server.
    const ws = new (WebSocket as unknown as new (
      url: string,
      protocols?: string | string[],
      options?: { headers: Record<string, string> },
    ) => WebSocket)(buildRealtimeUrl(), undefined, {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    });
    this.ws = ws;

    ws.onopen = () => {
      this.open = true;
      this.flushPending();
      this.handlers.onOpen?.();
    };

    ws.onmessage = (event) => {
      let msg: any;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const kind: string = msg.message_type ?? '';

      if (kind.includes('error')) {
        this.fail(new Error(msg.message || msg.detail || 'ElevenLabs error'));
        return;
      }
      if (kind === 'committed_transcript' || kind === 'committed_transcript_with_timestamps') {
        const text: string = msg.text ?? '';
        if (text) {
          const joiner = this.state.final && !this.state.final.endsWith(' ') ? ' ' : '';
          this.state = { final: this.state.final + joiner + text, partial: '' };
        } else {
          this.state = { ...this.state, partial: '' };
        }
        this.handlers.onTranscript?.(this.state);
        // `finish()` is waiting for exactly this.
        this.awaitCommit?.();
        this.awaitCommit = null;
        return;
      }
      if (kind === 'partial_transcript') {
        const text: string = msg.text ?? '';
        // An empty partial is silence, not a retraction of the current guess.
        if (!text) return;
        const joiner = this.state.final && !this.state.final.endsWith(' ') ? ' ' : '';
        this.state = { ...this.state, partial: joiner + text };
        this.handlers.onTranscript?.(this.state);
      }
    };

    ws.onerror = () =>
      this.fail(new Error('Could not reach the speech service. Check your connection.'));

    ws.onclose = () => {
      this.ws = null;
      this.open = false;
      // A close while `finish()` waits must not hang it.
      this.awaitCommit?.();
      this.awaitCommit = null;
      if (!this.closed) {
        this.closed = true;
        this.handlers.onClose?.();
      }
    };
  }

  /**
   * Buffers arrive at whatever size the OS chooses, so re-slice to even frames
   * and keep the remainder for the next call.
   */
  send(chunk: ArrayBuffer): void {
    if (this.closed) return;
    const incoming = new Uint8Array(chunk);
    const merged = new Uint8Array(this.carry.length + incoming.length);
    merged.set(this.carry, 0);
    merged.set(incoming, this.carry.length);

    let offset = 0;
    while (merged.length - offset >= FRAME_BYTES) {
      this.push(this.frame(merged.slice(offset, offset + FRAME_BYTES), false));
      offset += FRAME_BYTES;
    }
    this.carry = merged.slice(offset);
  }

  private frame(bytes: Uint8Array, commit: boolean): string {
    return JSON.stringify({
      message_type: 'input_audio_chunk',
      audio_base_64: toBase64(bytes),
      ...(commit ? { commit: true } : {}),
    });
  }

  private push(message: string): void {
    if (this.open && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else if (this.pending.length < 160) {
      // ~16 s of audio; past that the connection is not coming back.
      this.pending.push(message);
    }
  }

  private flushPending(): void {
    const queued = this.pending;
    this.pending = [];
    for (const message of queued) {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(message);
    }
  }

  /**
   * Sends whatever audio is left with `commit: true`, which makes the server
   * transcribe the open segment, and returns as soon as that committed text
   * arrives — about 150 ms in practice. The socket is then closed from this
   * side, because the server holds it open for another ~17 s on its own.
   */
  async finish(timeoutMs = 3000): Promise<string> {
    if (this.open && this.ws?.readyState === WebSocket.OPEN) {
      const tail = this.carry;
      this.carry = new Uint8Array(0);
      const settled = new Promise<void>((resolve) => {
        this.awaitCommit = resolve;
        setTimeout(resolve, timeoutMs);
      });
      this.ws.send(this.frame(tail, true));
      await settled;
    }
    this.close();
    return this.transcript;
  }

  close(): void {
    this.closed = true;
    this.awaitCommit?.();
    this.awaitCommit = null;
    try {
      this.ws?.close();
    } catch {
      /* already gone */
    }
    this.ws = null;
  }

  private fail(error: Error): void {
    if (this.closed) return;
    this.closed = true;
    this.awaitCommit?.();
    this.awaitCommit = null;
    this.handlers.onError?.(error);
    try {
      this.ws?.close();
    } catch {
      /* already gone */
    }
    this.ws = null;
  }
}

/** Uploads one finished recording to Scribe and returns its transcript. */
export async function transcribeRecording({ uri }: { uri: string }): Promise<string> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('Speech credentials are not configured. Type your answer instead.');
  }

  const form = new FormData();
  await appendAudio(form, uri);
  form.append('model_id', ELEVENLABS_MODEL);
  form.append('language_code', 'eng');

  let response: Response;
  try {
    response = await fetch(BATCH_ENDPOINT, {
      method: 'POST',
      // Content-Type is deliberately unset: fetch has to add the multipart
      // boundary itself, and naming the header overwrites it.
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      body: form,
    });
  } catch {
    throw new Error('Could not reach the speech service. Check your connection.');
  }

  if (!response.ok) {
    // Errors arrive as `{ detail: { message } }`, but a gateway failure is not
    // guaranteed to be JSON at all.
    const detail = await response
      .json()
      .then((body: any) =>
        typeof body?.detail === 'string' ? body.detail : (body?.detail?.message as string | undefined),
      )
      .catch(() => undefined);
    throw uploadError(response.status, detail);
  }

  const body = (await response.json()) as { text?: string };
  return (body.text ?? '').trim();
}
