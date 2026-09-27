import { DEEPGRAM_API_KEY, DEEPGRAM_MODEL } from '../config';
import type { StreamingHandlers, StreamingSession, TranscriptState } from './types';

/**
 * Client for Deepgram's live speech-to-text WebSocket (`/v1/listen`).
 *
 * Deepgram normally authenticates with an `Authorization` header, which a
 * WebSocket cannot carry. The documented client-side path is to pass the key as
 * the second WebSocket subprotocol — `Sec-WebSocket-Protocol: token, <key>` —
 * which React Native's WebSocket supports the same way a browser does.
 *
 * Note this puts the key in the app bundle. That is the accepted trade-off for
 * a demo build; a shipping app would mint a short-lived token on our own server
 * and hand that to the phone instead.
 */

const ENDPOINT = 'wss://api.deepgram.com/v1/listen';

/** ~100 ms of 16 kHz mono 16-bit audio, to avoid a socket write per callback. */
const FRAME_BYTES = 3200;

function buildUrl(): string {
  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    language: 'en',
    // Matches what `toMono16k` produces, and what the mic is asked for.
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    // Revisable guesses while the user is still mid-sentence.
    interim_results: 'true',
    // Punctuation and spoken-number formatting, so the text needs less fixing.
    punctuate: 'true',
    smart_format: 'true',
    // Close a segment after 300 ms of silence. The default of 10 ms chops
    // ordinary pauses into separate segments.
    endpointing: '300',
  });
  return `${ENDPOINT}?${params.toString()}`;
}

export class DeepgramSession implements StreamingSession {
  private ws: WebSocket | null = null;
  private open = false;
  private closed = false;
  /** Audio captured before the socket finished opening. */
  private pending: ArrayBuffer[] = [];
  private carry = new Uint8Array(0);
  private state: TranscriptState = { final: '', partial: '' };

  constructor(private readonly handlers: StreamingHandlers = {}) {}

  get transcript(): string {
    return (this.state.final + this.state.partial).trim();
  }

  connect(): void {
    if (this.ws) return;
    // The key travels as a subprotocol, not a header. Both entries are required
    // and the order matters: the literal "token", then the key.
    const ws = new WebSocket(buildUrl(), ['token', DEEPGRAM_API_KEY]);
    ws.binaryType = 'arraybuffer';
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
      if (msg.type === 'Error') {
        this.fail(new Error(msg.description || msg.message || 'Deepgram error'));
        return;
      }
      if (msg.type !== 'Results') return;

      const text: string = msg.channel?.alternatives?.[0]?.transcript ?? '';
      if (msg.is_final) {
        // Deepgram sends each settled segment without surrounding whitespace.
        if (text) {
          const joiner = this.state.final && !this.state.final.endsWith(' ') ? ' ' : '';
          this.state = { final: this.state.final + joiner + text, partial: '' };
        } else {
          this.state = { ...this.state, partial: '' };
        }
      } else {
        // An empty interim result is silence, not a retraction of the guess.
        if (!text) return;
        const joiner = this.state.final && !this.state.final.endsWith(' ') ? ' ' : '';
        this.state = { ...this.state, partial: joiner + text };
      }
      this.handlers.onTranscript?.(this.state);
    };

    ws.onerror = () =>
      this.fail(new Error('Could not reach the speech service. Check your connection.'));

    ws.onclose = () => {
      this.ws = null;
      this.open = false;
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
      // slice() copies, which matters: the underlying buffer gets reused.
      this.push(merged.slice(offset, offset + FRAME_BYTES).buffer);
      offset += FRAME_BYTES;
    }
    this.carry = merged.slice(offset);
  }

  private push(frame: ArrayBuffer): void {
    if (this.open && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(frame);
    } else if (this.pending.length < 160) {
      // ~16 s of audio; past that the connection is not coming back.
      this.pending.push(frame);
    }
  }

  private flushPending(): void {
    const queued = this.pending;
    this.pending = [];
    for (const frame of queued) {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(frame);
    }
  }

  /**
   * `Finalize` makes the server transcribe the audio it is still holding;
   * `CloseStream` tells it no more is coming, after which it sends the last
   * results and closes. Waiting for that close is what makes the final words
   * show up instead of being dropped.
   */
  async finish(timeoutMs = 4000): Promise<string> {
    if (this.open && this.ws?.readyState === WebSocket.OPEN) {
      if (this.carry.length > 0) {
        this.ws.send(this.carry.slice().buffer);
        this.carry = new Uint8Array(0);
      }
      this.ws.send(JSON.stringify({ type: 'Finalize' }));
      this.ws.send(JSON.stringify({ type: 'CloseStream' }));
    }
    await new Promise<void>((resolve) => {
      const ws = this.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return resolve();
      const timer = setTimeout(resolve, timeoutMs);
      const prevClose = ws.onclose;
      ws.onclose = (event) => {
        clearTimeout(timer);
        prevClose?.call(ws, event as never);
        resolve();
      };
    });
    this.close();
    return this.transcript;
  }

  close(): void {
    this.closed = true;
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
    this.handlers.onError?.(error);
    try {
      this.ws?.close();
    } catch {
      /* already gone */
    }
    this.ws = null;
  }
}
