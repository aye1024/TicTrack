/**
 * `AudioStream` asks the OS for 16 kHz but the hardware is allowed to hand back
 * a different rate — Android devices commonly force 48 kHz. Both streaming
 * providers are told the audio is 16 kHz mono, so anything else has to be
 * converted before it is sent. Deepgram transcribes the wrong rate as
 * gibberish; iFlytek returns an empty transcript. Neither reports an error.
 */
export function toMono16k(
  buffer: ArrayBuffer,
  sampleRate: number,
  channels: number,
): ArrayBuffer {
  let samples = new Int16Array(buffer);

  if (channels > 1) {
    const frames = Math.floor(samples.length / channels);
    const mono = new Int16Array(frames);
    for (let i = 0; i < frames; i += 1) {
      let sum = 0;
      for (let c = 0; c < channels; c += 1) sum += samples[i * channels + c];
      mono[i] = (sum / channels) | 0;
    }
    samples = mono;
  }

  if (sampleRate === 16000) return samples.buffer as ArrayBuffer;

  // Linear interpolation is enough for speech at these rates.
  const ratio = sampleRate / 16000;
  const outLength = Math.floor(samples.length / ratio);
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const position = i * ratio;
    const index = Math.floor(position);
    const frac = position - index;
    const a = samples[index] ?? 0;
    const b = samples[index + 1] ?? a;
    out[i] = (a + (b - a) * frac) | 0;
  }
  return out.buffer;
}
