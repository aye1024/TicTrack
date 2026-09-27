import { Platform } from 'react-native';
import {
  ASR_PROVIDER,
  hasDeepgram,
  hasElevenLabs,
  hasGroq,
  hasXfyun,
} from '../config';
import { DeepgramSession } from './deepgram';
import {
  ElevenLabsSession,
  transcribeRecording as elevenLabsTranscribe,
} from './elevenlabs';
import { transcribeRecording as groqTranscribe } from './groq';
import { RtasrSession } from './xfyun';
import type { AsrMode, StreamingHandlers, StreamingSession } from './types';

export type ProviderId = 'elevenlabs' | 'deepgram' | 'groq' | 'xfyun';

export type Provider = {
  id: ProviderId;
  /** For the services list on the profile screen. */
  label: string;
  /** Which paths this provider can serve. ElevenLabs is the only one with both. */
  modes: AsrMode[];
};

const PROVIDERS: Record<ProviderId, Provider> = {
  elevenlabs: { id: 'elevenlabs', label: 'ElevenLabs Scribe', modes: ['streaming', 'batch'] },
  deepgram: { id: 'deepgram', label: 'Deepgram Nova', modes: ['streaming'] },
  groq: { id: 'groq', label: 'Groq Whisper', modes: ['batch'] },
  xfyun: { id: 'xfyun', label: 'iFlytek RTASR', modes: ['streaming'] },
};

const CONFIGURED: Record<ProviderId, () => boolean> = {
  elevenlabs: hasElevenLabs,
  deepgram: hasDeepgram,
  groq: hasGroq,
  xfyun: hasXfyun,
};

/**
 * ElevenLabs first on both paths: it is the most accurate of these on English
 * and the only one that can stream *and* transcribe a file, so the phone and
 * the browser behave the same. Deepgram is the streaming fallback, iFlytek
 * behind it, and Groq the batch fallback because its free tier never expires.
 */
const PREFERENCE: ProviderId[] = ['elevenlabs', 'deepgram', 'xfyun', 'groq'];

/** The mode a provider gets used in, given whether a microphone stream exists. */
function modeFor(provider: Provider, canStream: boolean): AsrMode | null {
  if (canStream && provider.modes.includes('streaming')) return 'streaming';
  if (provider.modes.includes('batch')) return 'batch';
  return null;
}

export type Resolved = { provider: Provider; mode: AsrMode };

/**
 * Picks the provider and the path to use. `canStream` is false in the browser
 * build, where `useAudioStream` returns a null stream, so only batch-capable
 * providers can run there.
 *
 * `EXPO_PUBLIC_ASR_PROVIDER` forces one provider, which is how you check
 * another path without moving keys around. A forced provider with no key, or
 * one that cannot run on this platform, is ignored rather than breaking the
 * microphone button.
 */
export function resolveProvider(canStream: boolean): Resolved | null {
  const forced = ASR_PROVIDER as ProviderId;
  if (forced && PROVIDERS[forced] && CONFIGURED[forced]?.()) {
    const mode = modeFor(PROVIDERS[forced], canStream);
    if (mode) return { provider: PROVIDERS[forced], mode };
  }
  for (const id of PREFERENCE) {
    if (!CONFIGURED[id]()) continue;
    const mode = modeFor(PROVIDERS[id], canStream);
    if (mode) return { provider: PROVIDERS[id], mode };
  }
  return null;
}

/**
 * Name of the provider that will answer, for the services list on the profile
 * screen. Null means dictation is unavailable here — either no key is set, or
 * the only keys set are streaming-only and this is the browser build.
 *
 * `useDictation` decides from the actual stream; this uses the platform as a
 * stand-in, since `useAudioStream` is a stub on web and nowhere else.
 */
export function activeProviderLabel(): string | null {
  return resolveProvider(Platform.OS !== 'web')?.provider.label ?? null;
}

export function createStreamingSession(
  id: ProviderId,
  handlers: StreamingHandlers,
): StreamingSession {
  if (id === 'elevenlabs') return new ElevenLabsSession(handlers);
  if (id === 'deepgram') return new DeepgramSession(handlers);
  return new RtasrSession(handlers);
}

/** Uploads a finished recording through whichever batch provider was chosen. */
export function transcribeRecording(
  id: ProviderId,
  recording: { uri: string },
): Promise<string> {
  return id === 'elevenlabs' ? elevenLabsTranscribe(recording) : groqTranscribe(recording);
}
