import { BLOCKERS } from '../data/blockers';
import type { AppData, Tic } from '../types';
import type { BlockerMatches, DailyInsight, ExtractedTics, ProgressReport } from './schemas';
import { REGIONS } from './schemas';
import { averageSeverity, factorCorrelation, severityTrend } from '../logic/analysis';

/**
 * Rule-based stand-ins used whenever no Anthropic key is configured. They are
 * deliberately conservative — the app must stay fully usable without a key.
 */

/** Body-part words. These decide the region when they conflict with a verb. */
const PART_HINTS: Record<string, string[]> = {
  eyes: ['eye', 'eyelid'],
  face: ['face', 'nose', 'cheek', 'eyebrow', 'brow', 'forehead'],
  mouth: ['mouth', 'lip', 'jaw', 'tongue'],
  head: ['head'],
  neck: ['neck'],
  shoulders: ['shoulder'],
  arms: ['arm', 'elbow'],
  hands: ['hand', 'finger', 'wrist'],
  torso: ['torso', 'stomach', 'belly', 'abdomen', 'chest'],
  legs: ['leg', 'knee', 'foot', 'feet', 'ankle', 'thigh', 'hamstring', 'buttock', 'toe'],
  voice: ['throat', 'voice'],
};

/** Verbs, used only when the text never names a body part. "Jerk" is not a neck. */
const ACTION_HINTS: Record<string, string[]> = {
  eyes: ['blink', 'squint', 'wink', 'gaze', 'look'],
  face: ['grimace', 'scrunch'],
  mouth: ['bite', 'chew', 'clench', 'wiggle'],
  head: ['nod', 'toss', 'shake', 'bang'],
  neck: [],
  shoulders: ['shrug'],
  arms: ['fling', 'flap', 'swing'],
  hands: ['tap', 'snap', 'pick', 'rub'],
  torso: ['bend', 'arch', 'gyrate', 'rotate'],
  legs: ['kick', 'bounce', 'stomp'],
  voice: [
    'cough', 'grunt', 'sniff', 'hum', 'squeak', 'shout', 'yell', 'scream', 'bark', 'yelp',
    'chirp', 'puff', 'oink',
  ],
};

const REGION_HINTS: Record<string, string[]> = Object.fromEntries(
  REGIONS.map((region) => [region, [...(PART_HINTS[region] ?? []), ...(ACTION_HINTS[region] ?? [])]]),
);

const VOCAL_HINTS = REGION_HINTS.voice;

function splitClauses(text: string): string[] {
  return text
    .split(/[.,;\n]|\band\b|\balso\b|\bthen\b/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 6);
}

function mentions(text: string, hint: string): boolean {
  const stem = hint.endsWith('s') ? hint : `${hint}s?`;
  return new RegExp(`\\b${stem}\\b`, 'i').test(text);
}

/** The body part named in the text, if any. A verb like "jerk" does not count. */
export function regionMentioned(text: string): (typeof REGIONS)[number] | null {
  let best: (typeof REGIONS)[number] | null = null;
  let bestScore = 0;
  for (const region of REGIONS) {
    const score = (PART_HINTS[region] ?? []).filter((hint) => mentions(text, hint)).length;
    if (score > bestScore) {
      best = region;
      bestScore = score;
    }
  }
  return best;
}

function regionFor(clause: string): string {
  const named = regionMentioned(clause);
  if (named) return named;
  let best = 'head';
  let bestScore = 0;
  for (const region of REGIONS) {
    const score = (ACTION_HINTS[region] ?? []).filter((hint) => mentions(clause, hint)).length;
    if (score > bestScore) {
      best = region;
      bestScore = score;
    }
  }
  return best;
}

const STOP = new Set([
  'i', "i'm", 'im', 'my', 'me', 'myself', 'really', 'very', 'hard', 'a', 'an', 'the', 'lot',
  'uncontrollably', 'sometimes', 'often', 'just', 'over', 'and', 'when', 'especially', 'am',
  'is', 'are', 'it', 'its', 'to', 'of', 'on', 'in', 'so', 'that', 'this', 'too', 'quite',
  'always', 'again', 'do', 'does', 'did',
]);

/** Any form of the verb maps to the present-tense word used in "I <verb> my …". */
const BASE: Record<string, string> = {
  blink: 'blink', blinks: 'blink', blinking: 'blink',
  jerk: 'jerk', jerks: 'jerk', jerking: 'jerk',
  clear: 'clear', clears: 'clear', clearing: 'clear',
  swing: 'swing', swings: 'swing', swinging: 'swing',
  shrug: 'shrug', shrugs: 'shrug', shrugging: 'shrug',
  sniff: 'sniff', sniffs: 'sniff', sniffing: 'sniff',
  cough: 'cough', coughs: 'cough', coughing: 'cough',
  hum: 'hum', hums: 'hum', humming: 'hum',
  nod: 'nod', nods: 'nod', nodding: 'nod',
  snap: 'snap', snaps: 'snap', snapping: 'snap',
  twitch: 'twitch', twitches: 'twitch', twitching: 'twitch',
  kick: 'kick', kicks: 'kick', kicking: 'kick',
  stomp: 'stomp', stomps: 'stomp', stomping: 'stomp',
  roll: 'roll', rolls: 'roll', rolling: 'roll',
  clench: 'clench', clenches: 'clench', clenching: 'clench',
  bite: 'bite', bites: 'bite', biting: 'bite',
  grunt: 'grunt', grunts: 'grunt', grunting: 'grunt',
  squeak: 'squeak', squeaks: 'squeak', squeaking: 'squeak',
  shout: 'shout', shouts: 'shout', shouting: 'shout',
  yell: 'yell', yells: 'yell', yelling: 'yell',
  scream: 'shout', screams: 'shout', screaming: 'shout',
  raise: 'raise', raises: 'raise', raising: 'raise',
  flap: 'flap', flaps: 'flap', flapping: 'flap',
  tap: 'tap', taps: 'tap', tapping: 'tap',
  toss: 'toss', tossing: 'toss',
  twist: 'twist', twists: 'twist', twisting: 'twist',
  turn: 'turn', turns: 'turn', turning: 'turn',
  scrunch: 'scrunch', scrunching: 'scrunch',
  squint: 'squint', squinting: 'squint',
  wink: 'wink', winking: 'wink',
  grimace: 'grimace', grimacing: 'grimace',
  contract: 'contract', contracts: 'contract', contracting: 'contract',
  tighten: 'contract', tightens: 'contract', tightening: 'contract',
  shake: 'shake', shakes: 'shake', shaking: 'shake',
  wiggle: 'wiggle', wiggles: 'wiggle', wiggling: 'wiggle',
  tense: 'tense', tenses: 'tense', tensing: 'tense',
  gyrate: 'gyrate', gyrates: 'gyrate', gyrating: 'gyrate',
  rotate: 'rotate', rotates: 'rotate', rotating: 'rotate',
  bang: 'bang', bangs: 'bang', banging: 'bang',
  puff: 'puff', puffs: 'puff', puffing: 'puff',
  chirp: 'chirp', chirps: 'chirp', chirping: 'chirp',
  bark: 'bark', barks: 'bark', barking: 'bark',
  oink: 'oink', oinks: 'oink', oinking: 'oink',
  open: 'open', opens: 'open', opening: 'open',
  look: 'look', looks: 'look', looking: 'look',
  squeeze: 'squeeze', squeezes: 'squeeze', squeezing: 'squeeze',
};

const BODY_NOUNS = new Set([
  'throat', 'knee', 'knees', 'arm', 'arms', 'eye', 'eyes', 'head', 'neck', 'shoulder',
  'shoulders', 'hand', 'hands', 'leg', 'legs', 'face', 'mouth', 'jaw', 'lip', 'lips',
  'finger', 'fingers', 'foot', 'feet', 'stomach', 'belly', 'nose', 'cheek', 'wrist',
  'ankle', 'toe', 'toes', 'eyebrow', 'eyebrows', 'brow', 'brows', 'thigh', 'thighs',
  'hamstring', 'buttock', 'buttocks',
]);

const REGION_NOUN: Record<string, string> = {
  eyes: 'eyes',
  face: 'face',
  mouth: 'lips',
  head: 'head',
  neck: 'neck',
  shoulders: 'shoulders',
  arms: 'arms',
  hands: 'hands',
  torso: 'stomach',
  legs: 'legs',
  voice: 'throat',
};

const REGION_VERB: Record<string, string> = {
  eyes: 'blink',
  face: 'scrunch',
  mouth: 'bite',
  head: 'jerk',
  neck: 'jerk',
  shoulders: 'shrug',
  arms: 'swing',
  hands: 'tap',
  torso: 'contract',
  legs: 'jerk',
  voice: 'clear',
};

const GERUND: Record<string, string> = {
  blink: 'Blinking',
  jerk: 'Jerking',
  clear: 'Clearing',
  swing: 'Swinging',
  shrug: 'Shrugging',
  sniff: 'Sniffing',
  cough: 'Coughing',
  hum: 'Humming',
  nod: 'Nodding',
  snap: 'Snapping',
  twitch: 'Twitching',
  kick: 'Kicking',
  stomp: 'Stomping',
  roll: 'Rolling',
  clench: 'Clenching',
  bite: 'Biting',
  grunt: 'Grunting',
  squeak: 'Squeaking',
  shout: 'Shouting',
  yell: 'Yelling',
  raise: 'Raising',
  flap: 'Flapping',
  tap: 'Tapping',
  toss: 'Tossing',
  twist: 'Twisting',
  turn: 'Turning',
  scrunch: 'Scrunching',
  squint: 'Squinting',
  wink: 'Winking',
  grimace: 'Grimacing',
  contract: 'Contracting',
  shake: 'Shaking',
  wiggle: 'Wiggling',
  tense: 'Tensing',
  gyrate: 'Gyrating',
  rotate: 'Rotating',
  bang: 'Banging',
  puff: 'Puffing',
  chirp: 'Chirping',
  bark: 'Barking',
  oink: 'Oinking',
  open: 'Opening',
  look: 'Looking',
  squeeze: 'Squeezing',
};

type TicPattern = {
  name: string;
  region: (typeof REGIONS)[number];
  kind: 'motor' | 'vocal';
  hints: string[];
};

/**
 * Names drawn from common motor and vocal tics (including Dr. Shawn Ewbank's
 * list). Longer hints win. "Clearing throat" is dropped when any other
 * pattern also matches, so a wrong generic label cannot hide shouting.
 */
const TIC_PATTERNS: TicPattern[] = [
  { name: 'Blinking eyes', region: 'eyes', kind: 'motor', hints: ['eye blink', 'eyeblink', 'blinking', 'blink'] },
  { name: 'Moving eyes', region: 'eyes', kind: 'motor', hints: ['moving eyes', 'move my eyes', 'looking left', 'looking right', 'looking up', 'looking down', 'rolling eyes', 'eye roll', 'eyes to the'] },
  { name: 'Squinting eyes', region: 'eyes', kind: 'motor', hints: ['squinting', 'squint'] },
  { name: 'Opening eyes', region: 'eyes', kind: 'motor', hints: ['opening eyes wide', 'open my eyes', 'eyes wide', 'eye wide', 'opening eye', 'open wide'] },
  { name: 'Widening eyes', region: 'eyes', kind: 'motor', hints: ['eye gesture', 'surprised eyes', 'confused eyes', 'emotional eye'] },
  { name: 'Raising eyebrows', region: 'face', kind: 'motor', hints: ['eyebrow', 'eyebrows', 'brow'] },
  { name: 'Grimacing face', region: 'face', kind: 'motor', hints: ['grimacing', 'grimace', 'making a face'] },
  { name: 'Wiggling lips', region: 'mouth', kind: 'motor', hints: ['wiggling lips', 'wiggle lips', 'wiggle my lips', 'wiggling my lips'] },
  { name: 'Shaking head', region: 'head', kind: 'motor', hints: ['shaking head', 'shaking my head', 'shake my head', 'head shaking', 'head shake'] },
  { name: 'Shrugging shoulders', region: 'shoulders', kind: 'motor', hints: ['shrugging', 'shrug'] },
  { name: 'Flapping hands', region: 'hands', kind: 'motor', hints: ['flapping hands', 'flapping my hands', 'flap my hands', 'hand flapping', 'hand flap'] },
  { name: 'Wiggling toes', region: 'legs', kind: 'motor', hints: ['wiggling toes', 'wiggle toes', 'wiggle my toes', 'toe wiggling', 'toe wiggle'] },
  { name: 'Tensing stomach', region: 'torso', kind: 'motor', hints: ['tensing stomach', 'tensing my stomach', 'tense my stomach', 'stomach tensing'] },
  { name: 'Contracting stomach', region: 'torso', kind: 'motor', hints: ['contracting stomach', 'tighten my stomach', 'tightening stomach', 'tightening my stomach'] },
  { name: 'Tensing thighs', region: 'legs', kind: 'motor', hints: ['tensing thigh', 'tensing my thigh', 'thighs', 'thigh'] },
  { name: 'Tensing hamstring', region: 'legs', kind: 'motor', hints: ['hamstring'] },
  { name: 'Tensing neck', region: 'neck', kind: 'motor', hints: ['tensing neck', 'tensing my neck', 'tense my neck', 'neck tensing'] },
  { name: 'Tensing buttocks', region: 'legs', kind: 'motor', hints: ['buttock', 'buttocks', 'glutes', 'glute'] },
  { name: 'Bending body', region: 'torso', kind: 'motor', hints: ['bending'] },
  { name: 'Gyrating body', region: 'torso', kind: 'motor', hints: ['gyrating', 'gyrate'] },
  { name: 'Rotating body', region: 'torso', kind: 'motor', hints: ['rotating', 'rotate'] },
  { name: 'Sitting down', region: 'legs', kind: 'motor', hints: ['sitting down', 'sit down'] },
  { name: 'Standing up', region: 'legs', kind: 'motor', hints: ['standing up', 'stand up'] },
  { name: 'Running', region: 'legs', kind: 'motor', hints: ['running', 'start running', 'running tic'] },
  { name: 'Twisting posture', region: 'torso', kind: 'motor', hints: ['dystonic', 'dystonia', 'twisting posture', 'held posture'] },
  { name: 'Copying gestures', region: 'torso', kind: 'motor', hints: ['echopraxia', 'copying gestures', 'copying movements', 'copies gestures'] },
  { name: 'Inappropriate gestures', region: 'hands', kind: 'motor', hints: ['copropraxia', 'middle finger', 'inappropriate gesture'] },
  { name: 'Banging head', region: 'head', kind: 'motor', hints: ['head banging', 'banging my head', 'bang my head', 'head bang'] },
  { name: 'Pressing eyes', region: 'eyes', kind: 'motor', hints: ['against the eye', 'against my eye', 'pressing my eye', 'pressing on my eye'] },
  { name: 'Puffing air', region: 'voice', kind: 'vocal', hints: ['puff of air', 'puffs of air', 'puffing air', 'puffing'] },
  { name: 'Grunting', region: 'voice', kind: 'vocal', hints: ['grunting', 'grunt'] },
  { name: 'Squeaking', region: 'voice', kind: 'vocal', hints: ['squeaking', 'squeak'] },
  { name: 'Coughing', region: 'voice', kind: 'vocal', hints: ['coughing', 'cough'] },
  { name: 'Sniffing', region: 'voice', kind: 'vocal', hints: ['sniffing', 'sniff'] },
  { name: 'Humming', region: 'voice', kind: 'vocal', hints: ['humming', 'hum'] },
  { name: 'Chirping', region: 'voice', kind: 'vocal', hints: ['chirping', 'chirp', 'bird sound'] },
  { name: 'Barking', region: 'voice', kind: 'vocal', hints: ['barking', 'dog bark', 'bark'] },
  { name: 'Oinking', region: 'voice', kind: 'vocal', hints: ['oinking', 'oink', 'pig grunt', 'pig sound'] },
  { name: 'Shouting', region: 'voice', kind: 'vocal', hints: ['shouting', 'shout', 'yelling', 'yell', 'screaming', 'scream'] },
  { name: 'Saying syllables', region: 'voice', kind: 'vocal', hints: ['syllable', 'syllables'] },
  { name: 'Saying words', region: 'voice', kind: 'vocal', hints: ['saying words', 'say words', 'random words'] },
  { name: 'Saying phrases', region: 'voice', kind: 'vocal', hints: ['saying phrases', 'say phrases', 'whole phrases'] },
  { name: 'Repeating others', region: 'voice', kind: 'vocal', hints: ['echolalia', 'repeating someone', 'repeating others', 'repeating what they'] },
  { name: 'Repeating myself', region: 'voice', kind: 'vocal', hints: ['palilalia', 'repeating myself', 'repeating my own'] },
  { name: 'Inappropriate words', region: 'voice', kind: 'vocal', hints: ['coprolalia', 'swear word', 'swearing', 'cursing', 'inappropriate word'] },
  { name: 'Blocking speech', region: 'voice', kind: 'vocal', hints: ['blocking speech', 'speech block', 'get the sound out', 'cannot get the sound', 'cant get the sound'] },
  { name: 'Clearing throat', region: 'voice', kind: 'vocal', hints: ['clearing throat', 'clear throat', 'clears throat', 'throat clearing'] },
];

/** Names the model should copy when a description fits. Throat clearing is last on purpose. */
export const SUGGESTED_TIC_NAMES = [...new Set(TIC_PATTERNS.map((pattern) => pattern.name))];

function mentionsPhrase(text: string, hint: string): boolean {
  const parts = hint
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .map((word) => `${word}(?:s|es|ing|ed)?`);
  const pattern = parts.join('\\b(?:\\W+\\w+){0,4}\\W+\\b');
  return new RegExp(`\\b${pattern}\\b`, 'i').test(text);
}

function bestPattern(text: string): TicPattern | null {
  const hits = TIC_PATTERNS.flatMap((pattern) => {
    const hint = pattern.hints
      .filter((candidate) => mentionsPhrase(text, candidate))
      .sort((a, b) => b.length - a.length)[0];
    return hint ? [{ pattern, length: hint.length }] : [];
  });
  const specific = hits.filter((hit) => hit.pattern.name !== 'Clearing throat');
  const pool = specific.length ? specific : hits;
  pool.sort((a, b) => b.length - a.length);
  return pool[0]?.pattern ?? null;
}

const SOLO_VOCAL = new Set([
  'shout', 'grunt', 'squeak', 'cough', 'sniff', 'hum', 'bark', 'chirp', 'oink', 'puff', 'yell', 'scream',
]);

/**
 * A short label with no first person: "Swinging arms", "Biting lips", "Shouting".
 * A listed tic wins over a generic one, so shouting is not renamed to throat clearing.
 */
export function toTicName(raw: string, region?: string): string {
  const listed = bestPattern(raw);
  if (listed) return listed.name;

  const trimmed = raw.trim().replace(/\s+/g, ' ');
  const words = trimmed
    .toLowerCase()
    .replace(/[^a-z'\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !STOP.has(word));

  const verbs: string[] = [];
  let noun = '';
  for (const word of words) {
    const verb = BASE[word];
    if (verb && !verbs.includes(verb)) verbs.push(verb);
    else if (!noun && BODY_NOUNS.has(word)) {
      noun =
        word === 'lip' ? 'lips'
        : word === 'eye' ? 'eyes'
        : word === 'belly' ? 'stomach'
        : word === 'eyebrow' || word === 'brow' ? 'eyebrows'
        : word === 'thigh' ? 'thighs'
        : word === 'toe' ? 'toes'
        : word === 'buttock' ? 'buttocks'
        : word;
    }
  }
  const specific = verbs.filter((verb) => verb !== 'clear');
  let verb = (specific.length ? specific : verbs)[0] ?? '';
  if (verb && SOLO_VOCAL.has(verb) && (!noun || noun === 'throat')) return GERUND[verb] ?? 'Shouting';
  if (!noun && region && REGION_NOUN[region]) noun = REGION_NOUN[region];
  if (!verb && region && REGION_VERB[region]) verb = REGION_VERB[region];
  if (!verb) verb = 'jerk';
  if (!noun) noun = 'body';

  return `${GERUND[verb] ?? 'Jerking'} ${noun}`;
}

/** Name plus body region for a free-text description. Vocal descriptions stay on voice. */
export function labelTic(
  text: string,
  options?: { region?: string; kind?: 'motor' | 'vocal' },
): { name: string; region: (typeof REGIONS)[number] } {
  const listed = bestPattern(text);
  const region: (typeof REGIONS)[number] =
    options?.kind === 'vocal' || listed?.kind === 'vocal'
      ? 'voice'
      : listed?.region ?? regionMentioned(text) ?? (options?.region as (typeof REGIONS)[number] | undefined) ?? (regionFor(text) as (typeof REGIONS)[number]);
  return { name: toTicName(text, region), region };
}

export function extractTicsLocally(motor: string, vocal: string): ExtractedTics {
  const tics: ExtractedTics['tics'] = [];
  const seen = new Set<string>();

  const add = (clause: string, kind: 'motor' | 'vocal') => {
    const labeled = labelTic(clause, { kind });
    const region = labeled.region;
    const name = labeled.name;
    const key = `${kind}:${region}:${name.toLowerCase()}`;
    if (seen.has(key) || !name) return;
    seen.add(key);
    tics.push({ name, kind, region: region as never, description: clause.trim() });
  };

  for (const clause of splitClauses(motor)) add(clause, 'motor');
  for (const clause of splitClauses(vocal)) {
    const lower = clause.toLowerCase();
    add(clause, VOCAL_HINTS.some((h) => lower.includes(h)) ? 'vocal' : 'vocal');
  }
  return { tics: tics.slice(0, 8) };
}

export function matchBlockersLocally(
  tics: Pick<Tic, 'name' | 'kind' | 'region' | 'description'>[],
): BlockerMatches {
  return {
    matches: tics.map((tic) => {
      const haystack = `${tic.name} ${tic.description}`.toLowerCase();
      const scored = BLOCKERS.map((blocker) => {
        let score = 0;
        if (blocker.kinds.includes(tic.kind)) score += 3;
        if (blocker.regions.includes(tic.region)) score += 4;
        score += blocker.keywords.filter((k) => haystack.includes(k)).length * 2;
        return { blocker, score };
      })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);

      const picks = (scored.length ? scored : [{ blocker: BLOCKERS[BLOCKERS.length - 1], score: 0 }])
        .slice(0, 3)
        .map((s) => s.blocker);

      return {
        ticName: tic.name,
        blockerIds: picks.map((b) => b.id),
        reason: picks[0].rationale,
      };
    }),
  };
}

export function dailyInsightLocally(data: AppData): DailyInsight {
  const name = data.profile?.displayName || 'there';
  const checkIns = data.checkIns;
  const trend = severityTrend(data);
  const avg = averageSeverity(checkIns[checkIns.length - 1] ?? null);

  // Kept to two short sentences: this sits at the top of the home screen, above
  // the check-in button, so every extra line pushes the thing the user came for
  // further down.
  let summary: string;
  if (checkIns.length === 0) {
    summary = 'This is your first day. Today’s check-in sets your baseline.';
  } else if (trend === 'improving') {
    summary = `Across ${checkIns.length} check-ins your average severity is falling. Keep what you changed.`;
  } else if (trend === 'worsening') {
    summary = 'The last few days scored higher than the week before. That usually tracks your week, not the tic.';
  } else {
    summary = `Holding steady at about ${avg.toFixed(1)} out of 5. Progress here is measured in weeks.`;
  }

  const factors = factorCorrelation(data);
  const advice = factors.length
    ? `Worse days line up with ${factors[0].label.toLowerCase()}. Practise before it builds.`
    : 'Run one practice session today, even a short one.';

  return { greeting: `Welcome back, ${name}.`, summary, advice };
}

export function progressReportLocally(data: AppData): ProgressReport {
  const trend = severityTrend(data);
  const factors = factorCorrelation(data);
  const observations: string[] = [];

  observations.push(`${data.checkIns.length} daily check-ins recorded.`);
  for (const tic of data.tics.slice(0, 4)) {
    observations.push(`${tic.name}: currently ${tic.severity}/5 severity, urge ${tic.urge}/5.`);
  }
  const practiced = data.checkIns.filter((c) => c.practiced).length;
  observations.push(`Practice completed on ${practiced} of ${data.checkIns.length} days.`);

  return {
    headline:
      trend === 'improving'
        ? 'Severity is trending down across the tracked period.'
        : trend === 'worsening'
          ? 'Severity has risen over the tracked period.'
          : trend === 'steady'
            ? 'Severity has been stable over the tracked period.'
            : 'Not enough check-ins yet to establish a trend.',
    trend,
    observations,
    triggers: factors.map((f) => `${f.label}: +${f.delta.toFixed(1)} average severity on those days.`),
    nextSteps: [
      'Keep the daily check-in going. The trend line needs at least two weeks to be readable.',
      'If the current blocker has been rated ineffective twice, switch to the next one on the list.',
    ],
  };
}
