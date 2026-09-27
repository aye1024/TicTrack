import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

/**
 * Speech recognition keys. Three providers are wired up and the app uses
 * whichever one has credentials — see `src/asr/provider.ts` for the order.
 *
 * Keys come from `.env` (`EXPO_PUBLIC_*`). Nothing secret belongs in `app.json`.
 * With every key unset, `hasASR()` is false, the microphone button is hidden,
 * and every prompt falls back to typing, which it always accepted.
 */

/**
 * ElevenLabs Scribe. The only provider here that covers both paths —
 * `scribe_v2_realtime` streams over a WebSocket, `scribe_v2` transcribes a
 * finished file — so the phone and the browser behave the same. Paid, not a
 * free tier.
 */
export const ELEVENLABS_API_KEY =
  process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? extra.elevenLabsApiKey ?? '';
export const ELEVENLABS_MODEL =
  process.env.EXPO_PUBLIC_ELEVENLABS_MODEL ?? extra.elevenLabsModel ?? 'scribe_v2';
export const ELEVENLABS_REALTIME_MODEL =
  process.env.EXPO_PUBLIC_ELEVENLABS_REALTIME_MODEL ??
  extra.elevenLabsRealtimeModel ??
  'scribe_v2_realtime';

/**
 * Deepgram live speech-to-text. Streams over a WebSocket, so the transcript
 * updates while the user is still talking. New accounts get $200 of credit
 * without a card, which is tens of thousands of minutes at the streaming rate.
 */
export const DEEPGRAM_API_KEY =
  process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY ?? extra.deepgramApiKey ?? '';
export const DEEPGRAM_MODEL =
  process.env.EXPO_PUBLIC_DEEPGRAM_MODEL ?? extra.deepgramModel ?? 'nova-3';

/**
 * Groq's hosted Whisper. No streaming endpoint — it transcribes a finished
 * recording — but the free tier is permanent rather than a credit that runs
 * out, and it is the only provider that works in the browser build.
 */
export const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? extra.groqApiKey ?? '';
export const GROQ_MODEL =
  process.env.EXPO_PUBLIC_GROQ_MODEL ?? extra.groqModel ?? 'whisper-large-v3-turbo';

/**
 * iFlytek (讯飞) Real-Time ASR, the original provider. RTASR authenticates with
 * APPID + APIKey alone — no API secret is involved. Kept as a fallback; it is
 * weaker than Whisper on English, which is what this app is used in.
 */
export const XFYUN_APP_ID =
  process.env.EXPO_PUBLIC_XFYUN_APP_ID ?? extra.xfyunAppId ?? '';
export const XFYUN_API_KEY =
  process.env.EXPO_PUBLIC_XFYUN_API_KEY ?? extra.xfyunApiKey ?? '';

/** Forces one provider — 'deepgram', 'groq', or 'xfyun'. Empty means pick automatically. */
export const ASR_PROVIDER = process.env.EXPO_PUBLIC_ASR_PROVIDER ?? extra.asrProvider ?? '';

/** Zhipu BigModel (GLM) — OpenAI-compatible chat completions with SSE streaming. */
export const GLM_API_KEY =
  process.env.EXPO_PUBLIC_GLM_API_KEY ?? extra.glmApiKey ?? '';
export const GLM_MODEL = process.env.EXPO_PUBLIC_GLM_MODEL ?? extra.glmModel ?? 'glm-5.2';
export const GLM_BASE_URL =
  process.env.EXPO_PUBLIC_GLM_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4';

/** Empty means the client uses the Expo packager host on port 3000. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? '';

export const hasElevenLabs = () => Boolean(ELEVENLABS_API_KEY);
export const hasDeepgram = () => Boolean(DEEPGRAM_API_KEY);
export const hasGroq = () => Boolean(GROQ_API_KEY);
export const hasXfyun = () => Boolean(XFYUN_APP_ID && XFYUN_API_KEY);

export const hasASR = () => hasElevenLabs() || hasDeepgram() || hasGroq() || hasXfyun();
export const hasLLM = () => Boolean(GLM_API_KEY);
