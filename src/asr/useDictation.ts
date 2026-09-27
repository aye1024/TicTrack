import { useCallback, useRef, useState } from 'react';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioStream,
  type RecordingOptions,
} from 'expo-audio';
import { toMono16k } from './resample';
import {
  createStreamingSession,
  resolveProvider,
  transcribeRecording,
  type Resolved,
} from './provider';
import type { AsrMode, StreamingSession } from './types';

export type DictationStatus = 'idle' | 'starting' | 'listening' | 'finishing';

/**
 * Speech in, text out, over whichever provider has credentials.
 *
 * There are two paths, because the providers are not the same shape:
 *
 * - **streaming** (Deepgram, iFlytek): `useAudioStream` hands over raw int16
 *   buffers as they are captured, which go straight to a socket, so the
 *   transcript updates while the user is still talking.
 * - **batch** (Groq Whisper): the microphone records to a file, and the file is
 *   uploaded once the user stops. No live text, but it is the only path that
 *   works in the browser, where `useAudioStream` is a stub.
 *
 * Callers do not need to know which one ran. `live` is simply always empty on
 * the batch path, and the final text comes back from `stop()` either way.
 */

/**
 * Whisper downsamples to 16 kHz mono internally, so recording at that rate
 * keeps the upload small without costing accuracy. The browser gets whatever
 * `MediaRecorder` supports — `groq.ts` names the file from the blob's own type
 * rather than assuming.
 */
const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 32000,
  },
};

export function useDictation() {
  const [status, setStatus] = useState<DictationStatus>('idle');
  const [live, setLive] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<StreamingSession | null>(null);
  /**
   * The provider and path the in-flight session actually started on. `stop()`
   * cannot read these off the current render: a stream that appears or
   * disappears mid-session would change the choice, and then stop would take
   * the wrong branch and throw away what was recorded.
   */
  const active = useRef<Resolved | null>(null);

  const { stream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: 'int16',
    onBuffer: (buffer) =>
      sessionRef.current?.send(
        toMono16k(buffer.data, buffer.sampleRate, buffer.channels),
      ),
  });
  const recorder = useAudioRecorder(RECORDING_OPTIONS);

  /**
   * `useAudioStream` returns a null stream on web rather than capturing
   * anything, so streaming providers are native-only and the choice has to be
   * made with that in mind.
   */
  const resolved = resolveProvider(stream != null);
  const mode: AsrMode = resolved?.mode ?? 'batch';
  const available = resolved != null;

  /** Turns the mic off and puts the audio session back the way it was. */
  const releaseAudio = useCallback(async () => {
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  }, []);

  const start = useCallback(async () => {
    if (!resolved) {
      setError(
        stream == null
          ? 'Voice input needs the phone app. Type your answer here instead.'
          : 'Speech credentials are not configured. Type your answer instead.',
      );
      return;
    }
    setError(null);
    setLive('');
    setStatus('starting');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setStatus('idle');
        setError('Microphone access is off. Enable it in Settings, or type instead.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      active.current = resolved;
      if (resolved.mode === 'streaming') {
        const session = createStreamingSession(resolved.provider.id, {
          onTranscript: (state) => setLive((state.final + state.partial).trim()),
          onError: (err) => {
            setError(err.message);
            setStatus('idle');
            sessionRef.current = null;
          },
        });
        sessionRef.current = session;
        session.connect();
        await stream!.start();
      } else {
        // Re-prepare every time: a recorder that has already been stopped will
        // not start again on its previous file.
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
      setStatus('listening');
    } catch (err) {
      setStatus('idle');
      await releaseAudio();
      setError(err instanceof Error ? err.message : 'Could not start recording.');
    }
  }, [recorder, releaseAudio, resolved, stream]);

  /** Stops the mic, waits for the transcript, and returns it. */
  const stop = useCallback(async (): Promise<string> => {
    if (status === 'idle') return '';
    setStatus('finishing');
    let text = '';

    if (active.current?.mode === 'streaming') {
      try {
        stream?.stop();
      } catch {
        /* already stopped */
      }
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) {
        try {
          text = await session.finish();
        } catch {
          // Whatever arrived before the socket gave up is still worth keeping.
          text = session.transcript;
        }
      }
    } else {
      const id = active.current?.provider.id;
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (uri && id) text = await transcribeRecording(id, { uri });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not transcribe that recording.');
      }
    }

    active.current = null;
    await releaseAudio();
    setStatus('idle');
    setLive('');
    return text.trim();
  }, [recorder, releaseAudio, status, stream]);

  const cancel = useCallback(async () => {
    if (active.current?.mode !== 'batch') {
      try {
        stream?.stop();
      } catch {
        /* already stopped */
      }
      sessionRef.current?.close();
      sessionRef.current = null;
    } else {
      // The file is simply never uploaded.
      await recorder.stop().catch(() => {});
    }
    active.current = null;
    await releaseAudio();
    setStatus('idle');
    setLive('');
  }, [recorder, releaseAudio, stream]);

  return {
    status,
    live,
    error,
    available,
    mode,
    /** Which service is answering, for the services list on the profile screen. */
    providerLabel: resolved?.provider.label ?? null,
    isListening: status === 'listening' || status === 'starting',
    start,
    stop,
    cancel,
    clearError: () => setError(null),
  };
}
