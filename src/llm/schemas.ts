import { z } from 'zod';

export const REGIONS = [
  'head', 'eyes', 'face', 'mouth', 'neck', 'shoulders',
  'arms', 'hands', 'torso', 'legs', 'voice',
] as const;

export const ExtractedTics = z.object({
  tics: z.array(
    z.object({
      name: z
        .string()
        .describe(
          'Two or three words with no first person, such as "Shouting", "Blinking eyes", or "Biting lips". Use "Clearing throat" only for throat clearing.',
        ),
      kind: z.enum(['motor', 'vocal']),
      region: z.enum(REGIONS),
      description: z
        .string()
        .describe('One plain sentence describing the movement or sound.'),
    }),
  ),
});
export type ExtractedTics = z.infer<typeof ExtractedTics>;

export const BlockerMatches = z.object({
  matches: z.array(
    z.object({
      /** 1-based position in the list the prompt sent — the reliable join key. */
      ticIndex: z.number().optional(),
      ticName: z.string(),
      blockerIds: z
        .array(z.string())
        .describe('Two or three blocker ids from the library, best first.'),
      reason: z.string().describe('One sentence on why the first one fits this tic.'),
    }),
  ),
});
export type BlockerMatches = z.infer<typeof BlockerMatches>;

export const DailyInsight = z.object({
  greeting: z.string().describe('One warm sentence, at most 15 words.'),
  summary: z.string().describe('At most two short sentences, under 35 words total.'),
  advice: z.string().describe('One concrete, doable suggestion for today.'),
});
export type DailyInsight = z.infer<typeof DailyInsight>;

/**
 * A list of sentences, accepting either a JSON array or one paragraph.
 *
 * Asking for "four or five sentences" gets an array from the model most of the
 * time and a single paragraph the rest of the time. A paragraph where the schema
 * wants a list fails `parse`, and the caller's catch then throws away a report
 * that was perfectly good and falls back to the local rules. Splitting on
 * sentence boundaries recovers it instead.
 *
 * The split avoids a lookbehind assertion: Hermes has been unreliable with them.
 */
const sentenceList = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const parts = value.match(/[^.!?]+[.!?]+/g);
  const sentences = (parts ?? [value]).map((part) => part.trim()).filter(Boolean);
  return sentences.length > 0 ? sentences : [value.trim()];
}, z.array(z.string()));

export const ProgressReport = z.object({
  headline: z
    .string()
    .describe('One sentence giving the direction of travel and the tic it applies to.'),
  trend: z.enum(['improving', 'steady', 'worsening', 'not_enough_data']),
  observations: sentenceList.describe(
    'Array of four or five strings, each one sentence carrying a real number.',
  ),
  triggers: sentenceList.describe(
    'Array of strings: factors seen on worse days, with how much worse and over how many days.',
  ),
  nextSteps: sentenceList.describe(
    'Array of two or three strings, each a specific action for the coming week.',
  ),
});
export type ProgressReport = z.infer<typeof ProgressReport>;
