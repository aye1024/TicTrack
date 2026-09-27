import CryptoJS from 'crypto-js';
import { XFYUN_APP_ID, XFYUN_API_KEY } from '../config';
import type { StreamingHandlers, StreamingSession, TranscriptState } from './types';

/**
 * Client for iFlytek's Real-Time ASR (实时语音转写 / RTASR) WebSocket service.
 *
 * RTASR is the one iFlytek speech endpoint that authenticates with APPID +
 * APIKey alone — no API secret — which is exactly the credential pair we have.
 *
 *   signa = base64( HMAC-SHA1( MD5(appid + ts), apiKey ) )
 *
 * Audio must be 16 kHz, 16-bit, mono, little-endian PCM, sent as raw binary
 * frames. `expo-audio`'s AudioStream gives us exactly that from the microphone,
 * so nothing is transcoded anywhere in the pipeline.
 */

const ENDPOINT = 'wss://rtasr.xfyun.cn/v1/ws';

/** RTASR expects ~40 ms of audio per frame: 16000 Hz * 2 bytes * 0.04 s. */
export const FRAME_BYTES = 1280;

export type { TranscriptState } from './types';

function buildUrl(): string {
  const ts = Math.floor(Date.now() / 1000).toString();
  const baseString = XFYUN_APP_ID + ts;
  const md5 = CryptoJS.MD5(baseString).toString(CryptoJS.enc.Hex);
  const signa = CryptoJS.HmacSHA1(md5, XFYUN_API_KEY).toString(CryptoJS.enc.Base64);
  return `${ENDPOINT}?appid=${XFYUN_APP_ID}&ts=${ts}&signa=${encodeURIComponent(signa)}`;
}

/**
 * RTASR returns a nested word-lattice per utterance. `st.type` is "0" for a
 * settled segment and "1" for a revisable one; `rt[].ws[].cw[].w` holds the
 * words. Pull the text out and report which bucket it belongs in.
 */
function parseSegment(payload: string): { text: string; isFinal: boolean } | null {
  let parsed: any;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  const st = parsed?.cn?.st;
  if (!st) return null;
  let text = '';
  for (const rt of st.rt ?? []) {
    for (const ws of rt.ws ?? []) {
      for (const cw of ws.cw ?? []) {
        text += cw.w ?? '';
      }
    }
  }
  return { text, isFinal: st.type === '0' };
}

export class RtasrSession implements StreamingSession {
  private ws: WebSocket | null = null;
  private handshook = false;
  private closed = false;
  /** Audio captured before the server finished its handshake. */
  private pending: ArrayBuffer[] = [];
  private state: TranscriptState = { final: '', partial: '' };

  constructor(private readonly handlers: StreamingHandlers = {}) {}

  get transcript(): string {
    return (this.state.final + this.state.partial).trim();
  }

  connect(): void {
    if (this.ws) return;
    const ws = new WebSocket(buildUrl());
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => this.handlers.onOpen?.();

    ws.onmessage = (event) => {
      let msg: any;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      // code "0" is success for both the handshake and every result frame.
      if (msg.code !== '0' && msg.code !== 0) {
        this.fail(new Error(msg.desc || `iFlytek error ${msg.code}`));
        return;
      }
      if (msg.action === 'started') {
        this.handshook = true;
        this.flushPending();
        return;
      }
      if (msg.action === 'result' && typeof msg.data === 'string') {
        const seg = parseSegment(msg.data);
        if (!seg) return;
        if (seg.isFinal) {
          this.state = { final: this.state.final + seg.text, partial: '' };
        } else {
          this.state = { ...this.state, partial: seg.text };
        }
        this.handlers.onTranscript?.(this.state);
      }
    };

    ws.onerror = () =>
      this.fail(new Error('Could not reach the speech service. Check your connection.'));

    ws.onclose = () => {
      this.ws = null;
      this.handshook = false;
      if (!this.closed) {
        this.closed = true;
        this.handlers.onClose?.();
      }
    };
  }

  /**
   * Feed one microphone buffer. Buffers arrive at whatever size the OS chooses,
   * so re-slice to the 1280-byte frames RTASR expects and keep the remainder.
   */
  private carry = new Uint8Array(0);

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
    if (this.handshook && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(frame);
    } else if (this.pending.length < 400) {
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

  /** Tell the server we are done and let it flush the final segment. */
  async finish(timeoutMs = 4000): Promise<string> {
    if (this.carry.length > 0 && this.handshook && this.ws?.readyState === WebSocket.OPEN) {
      const padded = new Uint8Array(FRAME_BYTES);
      padded.set(this.carry, 0);
      this.ws.send(padded.buffer);
      this.carry = new Uint8Array(0);
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send('{"end": true}');
    }
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      const timer = setTimeout(done, timeoutMs);
      const ws = this.ws;
      if (!ws) {
        clearTimeout(timer);
        return done();
      }
      const prevClose = ws.onclose;
      ws.onclose = (event) => {
        clearTimeout(timer);
        prevClose?.call(ws, event as never);
        done();
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
