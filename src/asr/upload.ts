import { Platform } from 'react-native';

/**
 * Putting a finished recording into a `FormData`, for the providers that
 * transcribe a file rather than a stream.
 *
 * The two platforms need different handling, and both batch providers need the
 * same thing, so it lives here rather than in either client.
 */

/** Both Groq and ElevenLabs cap uploads well above this; a minute of AAC is ~500 KB. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Speech APIs pick their demuxer from the filename extension, so the name has
 * to match the actual bytes. On device that is always AAC in an MPEG-4
 * container. In the browser it is whatever `MediaRecorder` settled on — Chrome
 * and Firefox give WebM/Opus, Safari gives MP4 — so the extension is derived
 * from the blob's own type rather than assumed.
 */
const WEB_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
};

function webFileName(blobType: string): string {
  // Types arrive as `audio/webm;codecs=opus`.
  const base = blobType.split(';')[0].trim().toLowerCase();
  return `speech.${WEB_EXTENSIONS[base] ?? 'webm'}`;
}

/**
 * In the browser the recorder hands back a `blob:` URL, which `FormData` cannot
 * take by reference — the bytes have to be read back out first. On device,
 * React Native uploads a `file://` path directly, without loading it into JS.
 */
export async function appendAudio(form: FormData, uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = await fetch(uri).then((res) => res.blob());
    if (blob.size === 0) {
      throw new Error('That recording came back empty. Try again, or type instead.');
    }
    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new Error('That recording is too long to transcribe. Try a shorter one.');
    }
    form.append('file', blob, webFileName(blob.type));
    return;
  }
  // React Native's FormData takes this shape and streams the file itself.
  form.append('file', { uri, name: 'speech.m4a', type: 'audio/m4a' } as unknown as Blob);
}

/** Shared error mapping for the batch endpoints, which fail the same ways. */
export function uploadError(status: number, detail?: string): Error {
  if (status === 429) {
    return new Error('The speech service is busy right now. Try again, or type instead.');
  }
  if (status === 401 || status === 403) {
    return new Error('The speech key was rejected. Type your answer for now.');
  }
  return new Error(detail || `Speech service error ${status}.`);
}
