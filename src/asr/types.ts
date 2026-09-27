/**
 * The two shapes a speech provider can take.
 *
 * A *streaming* provider holds a socket open and revises the transcript while
 * the user is still talking. A *batch* provider only sees a finished recording,
 * so its text arrives in one piece after the microphone stops.
 *
 * `useDictation` supports both, because the free tiers are split across them:
 * Deepgram streams, Groq's Whisper does not.
 */
export type AsrMode = 'streaming' | 'batch';

export type TranscriptState = {
  /** Text the server has committed to and will not revise. */
  final: string;
  /** Current in-flight guess, replaced on every update. */
  partial: string;
};

export type StreamingHandlers = {
  onTranscript?: (state: TranscriptState) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

/**
 * What `useDictation` needs from a streaming recognizer. Both `RtasrSession`
 * (iFlytek) and `DeepgramSession` implement it, so switching providers does not
 * touch the hook or any screen.
 *
 * Every implementation takes 16 kHz, 16-bit, mono, little-endian PCM — the
 * format `expo-audio`'s AudioStream produces after `toMono16k`.
 */
export interface StreamingSession {
  /** Accumulated text so far, committed plus in-flight. */
  readonly transcript: string;
  /** Open the socket. Audio sent before the handshake completes is buffered. */
  connect(): void;
  /** Feed one microphone buffer of 16 kHz mono PCM. */
  send(chunk: ArrayBuffer): void;
  /** Signal end of audio, wait for the last segment, and return the transcript. */
  finish(timeoutMs?: number): Promise<string>;
  /** Drop the connection without waiting for anything. */
  close(): void;
}
