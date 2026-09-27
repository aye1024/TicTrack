import { INSTITUTIONS } from './institutions';
import { todayKey } from '../logic/analysis';
import {
  emptyData,
  type AppData,
  type CheckIn,
  type ContextFactor,
  type Message,
  type Tic,
} from '../types';

/**
 * Demo accounts, baked into the app rather than the database.
 *
 * `server/` and Mongo are the real store, but a demo has to work on a laptop
 * with nothing running behind it. `offline.ts` already implements the whole
 * account model on the device; this module fills it with a history that looks
 * lived-in: a patient ten weeks into CBIT, the clinician who reads the same
 * thread, that clinician's other patients, and enough colleagues for the
 * institution picker to look real.
 *
 * Everything is generated relative to today, so the streak, the chart and the
 * correlations are current whenever the app is opened. Ids are fixed, because
 * a message thread points at them.
 */

/** Bump to force the demo accounts to be rebuilt on next launch. */
export const DEMO_SEED_VERSION = '8';

/** Every generated account id starts with this, so a reseed touches only these. */
export const DEMO_ID_PREFIX = 'u_demo_';

/** One password for every demo account, so a judge can log in to any of them. */
export const DEMO_PASSWORD = '1234';

export type DemoAccount = {
  id: string;
  /** What you type to log in. */
  username: string;
  /** What the app shows. Deliberately not the username. */
  displayName: string;
  password: string;
  data: AppData;
};

export type DemoThread = {
  patientId: string;
  clinicianId: string;
  messages: Message[];
};

export type DemoSeed = {
  accounts: DemoAccount[];
  threads: DemoThread[];
};

const CHOA = INSTITUTIONS[0]; // Children's Healthcare of Atlanta

const ID = {
  ye: `${DEMO_ID_PREFIX}ye`,
  raman: `${DEMO_ID_PREFIX}raman`,
  hall: `${DEMO_ID_PREFIX}hall`,
  duarte: `${DEMO_ID_PREFIX}duarte`,
  okafor: `${DEMO_ID_PREFIX}okafor`,
  noah: `${DEMO_ID_PREFIX}noah`,
  maya: `${DEMO_ID_PREFIX}maya`,
  eli: `${DEMO_ID_PREFIX}eli`,
};

// ---------------------------------------------------------------------------
// Dates and deterministic noise
// ---------------------------------------------------------------------------

/** Midnight-anchored date `offset` days before today. */
function dayAt(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d;
}

/** ISO timestamp `offset` days ago at a given wall-clock time. */
function iso(offset: number, hour = 21, minute = 15): string {
  const d = dayAt(offset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * Deterministic 0–1 noise. A demo that reshuffles itself on every launch reads
 * as fake, and a chart that is a clean line reads as fake too, so the wobble is
 * stable but uneven.
 */
function noise(...parts: number[]): number {
  let h = 2166136261;
  for (const part of parts) {
    h ^= part + 0x9e3779b9;
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const clamp = (value: number, min: number, max = 5) =>
  Math.max(min, Math.min(max, Math.round(value)));

// ---------------------------------------------------------------------------
// The patient's tics
// ---------------------------------------------------------------------------

/**
 * `from` is where the tic sat at sign-up, `to` is where it sits today. The
 * current target improves the most, which is what habit reversal looks like
 * when it is working — but it stays the worst of the four, so the 6-of-7
 * rotation rule in `targeting.ts` does not immediately want to move off it.
 */
type Trajectory = { tic: Tic; from: number; to: number };

function noahTics(createdAt: string): Trajectory[] {
  const base = { retiredBlockerIds: [] as string[], createdAt };
  return [
    {
      // The current target: still the worst, but clearly coming down.
      tic: {
        ...base,
        id: 'tic_throat',
        name: 'Throat clearing',
        kind: 'vocal',
        region: 'voice',
        description:
          'A dry scratch builds at the back of my throat and I have to clear it, usually two or three times in a row.',
        severity: 3,
        urge: 4,
        blockerIds: ['diaphragm-breathing', 'paced-exhale'],
        // Tried first, rated ineffective, never suggested first again.
        retiredBlockerIds: ['sip-and-swallow'],
      },
      from: 5,
      to: 3,
    },
    {
      // The first target, worked through and largely settled.
      tic: {
        ...base,
        id: 'tic_blink',
        name: 'Hard eye blinking',
        kind: 'motor',
        region: 'eyes',
        description:
          'I squeeze both eyes shut hard, tighter than a normal blink. Worst when I am reading or looking at a screen.',
        severity: 1,
        urge: 2,
        blockerIds: ['slow-blink', 'soft-lid-rest'],
      },
      from: 4,
      to: 1,
    },
    {
      tic: {
        ...base,
        id: 'tic_shoulder',
        name: 'Shoulder shrug',
        kind: 'motor',
        region: 'shoulders',
        description:
          'My right shoulder pulls up toward my ear. It comes in runs when I am sitting still in class.',
        severity: 2,
        urge: 3,
        blockerIds: ['shoulder-press-down', 'arms-at-side'],
      },
      from: 3,
      to: 2,
    },
    {
      tic: {
        ...base,
        id: 'tic_head',
        name: 'Head jerk to the side',
        kind: 'motor',
        region: 'neck',
        description: 'A quick sideways snap of my head, mostly to the left, a few times an hour.',
        severity: 2,
        urge: 2,
        blockerIds: ['chin-tuck', 'head-midline'],
      },
      from: 2,
      to: 1,
    },
  ];
}

// ---------------------------------------------------------------------------
// Check-in history
// ---------------------------------------------------------------------------

/** Which context factors were logged on the day `offset` days ago. */
function factorsFor(offset: number): ContextFactor[] {
  const factors: ContextFactor[] = [];
  const weekday = dayAt(offset).getDay();
  const n = (salt: number) => noise(offset, salt);

  // Today reads as an ordinary day. The numbers the Today screen shows are the
  // last check-in's, so letting a stress spike land on it would undercut the
  // improvement the rest of the history is there to show.
  const quiet = offset === 0;

  // Exams cluster: a rough stretch four to five weeks back.
  const examWeek = offset >= 28 && offset <= 37;
  if (!quiet && (examWeek || n(1) < 0.3)) factors.push('stress');
  if (!quiet && n(2) < 0.26) factors.push('poorSleep');
  if (!quiet && n(3) < 0.2) factors.push('fatigue');
  // Coffee on school mornings, not at the weekend.
  if (!quiet && weekday >= 1 && weekday <= 5 && n(4) < 0.28) factors.push('caffeine');
  if (n(5) < 0.12) factors.push('excitement');
  // Practice is Tuesday and Thursday.
  if ((weekday === 2 || weekday === 4) && n(6) < 0.7) factors.push('exercise');
  return factors;
}

/**
 * The days Noah actually checked in. Irregular at first — a new habit — then
 * most days, then an unbroken run up to and including today, so the streak on
 * the Today screen is real rather than asserted.
 */
function checkInOffsets(span: number): number[] {
  const offsets: number[] = [];
  for (let offset = span; offset >= 0; offset -= 1) {
    if (offset <= 15) {
      offsets.push(offset); // unbroken recent run, today included
    } else if (offset <= 42) {
      if (noise(offset, 91) > 0.18) offsets.push(offset); // most days
    } else if (noise(offset, 92) > 0.45) {
      offsets.push(offset); // learning the habit
    }
  }
  return offsets;
}

const NOTES: Record<number, string> = {
  0: 'Caught the urge twice before the tic and rode it out.',
  2: 'Throat was worse during the presentation but the breathing held.',
  5: 'Slept badly, everything was louder today.',
  9: 'First day nobody in class asked about the blinking.',
  16: 'Shoulder came back a bit after basketball.',
  24: 'Switched to the breathing one. Swallowing was not doing anything.',
  33: 'Exam week. Hard to practise at all.',
  47: 'Noticed the pull before the head jerk for the first time.',
};

function buildCheckIns(trajectories: Trajectory[], span: number, targetId: string): CheckIn[] {
  return checkInOffsets(span).map((offset) => {
    const factors = factorsFor(offset);
    // Stress and short sleep are the two best-documented exacerbating factors in
    // Tourette's, and they sit at roughly the same weight in the literature.
    // Sleep was under-weighted here, which left the wearable's sleep-to-count
    // link too weak to clear the threshold `wearableCorrelations` reports at.
    const bump =
      (factors.includes('stress') ? 0.9 : 0) +
      (factors.includes('poorSleep') ? 0.85 : 0) +
      (factors.includes('fatigue') ? 0.35 : 0) +
      (factors.includes('caffeine') ? 0.3 : 0) +
      (factors.includes('excitement') ? 0.25 : 0) -
      (factors.includes('exercise') ? 0.3 : 0);

    // 0 at sign-up, 1 today.
    const progress = (span - offset) / span;

    const entries = trajectories.map(({ tic, from, to }, index) => {
      const trend = from + (to - from) * progress;
      const wobble = noise(offset, index, 7) - 0.45;
      const severity = clamp(trend + bump + wobble, 0);
      // An urge you get no warning from is a 1, never a 0.
      return { ticId: tic.id, severity, urge: clamp(severity - 0.3 + wobble * 0.5, 1) };
    });

    // Practice most days, and more reliably as the habit settles.
    const practiced = noise(offset, 55) > (offset > 42 ? 0.45 : 0.16);
    // The first few weeks used the competing response that was later retired,
    // which is why it was retired.
    const effective = practiced ? noise(offset, 56) > (offset > 45 ? 0.6 : 0.22) : null;

    return {
      id: `demo_ci_${offset}`,
      date: todayKey(dayAt(offset)),
      createdAt: iso(offset, 20 + Math.floor(noise(offset, 8) * 3), Math.floor(noise(offset, 9) * 59)),
      entries,
      factors,
      targetTicId: offset > 24 ? 'tic_blink' : targetId,
      blockerId: offset > 24 ? 'slow-blink' : offset > 21 ? 'sip-and-swallow' : 'diaphragm-breathing',
      practiced,
      practiceSeconds: practiced ? (noise(offset, 57) > 0.7 ? 180 : 120) : 0,
      blockerEffective: effective,
      note: NOTES[offset] ?? '',
    };
  });
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

function clinician(
  id: string,
  username: string,
  displayName: string,
  institution: string,
  weeksAgo: number,
): DemoAccount {
  return {
    id,
    username,
    displayName,
    password: DEMO_PASSWORD,
    data: {
      ...structuredClone(emptyData),
      onboarded: true,
      profile: {
        username,
        displayName,
        role: 'clinician',
        accountId: id,
        institution,
        clinicianId: null,
        clinicianName: null,
        skippedClinician: false,
        age: null,
        gender: 'unspecified',
        createdAt: iso(weeksAgo * 7, 9, 30),
      },
    },
  };
}

/** A patient on Dr. Ye's caseload, so the caseload is not a single row. */
function patient(options: {
  id: string;
  username: string;
  displayName: string;
  age: number;
  span: number;
  trajectories: Trajectory[];
  targetId: string;
  targetStreakDays: number;
  motorNarrative: string;
  vocalNarrative: string;
  insight: { greeting: string; summary: string; advice: string } | null;
  wearable: AppData['wearable'];
}): DemoAccount {
  const checkIns = buildCheckIns(options.trajectories, options.span, options.targetId);

  // A tic's own severity is whatever the last check-in said. The app does this
  // on every check-in, so a seed that skipped it would show one number on the
  // Today screen and a different one at the right-hand end of the history
  // chart.
  const latest = checkIns[checkIns.length - 1];
  const tics = options.trajectories.map(({ tic }) => {
    const entry = latest?.entries.find((e) => e.ticId === tic.id);
    return entry ? { ...tic, severity: entry.severity, urge: entry.urge } : tic;
  });

  return {
    id: options.id,
    username: options.username,
    displayName: options.displayName,
    password: DEMO_PASSWORD,
    data: {
      ...structuredClone(emptyData),
      onboarded: true,
      profile: {
        username: options.username,
        displayName: options.displayName,
        role: 'patient',
        accountId: options.id,
        institution: CHOA,
        clinicianId: ID.ye,
        clinicianName: 'Dr. Ye',
        skippedClinician: false,
        age: options.age,
        gender: 'unspecified',
        createdAt: iso(options.span, 18, 5),
      },
      tics,
      checkIns,
      targetTicId: options.targetId,
      targetStreakDays: options.targetStreakDays,
      motorNarrative: options.motorNarrative,
      vocalNarrative: options.vocalNarrative,
      insight: options.insight
        ? {
            // The Today screen reads this back with `JSON.parse`, so it has to
            // be a serialised DailyInsight and not a bare sentence — otherwise
            // the parse fails, the cache is discarded, and the demo waits on a
            // model request it did not need to make.
            text: JSON.stringify(options.insight),
            generatedAt: iso(0, 7, 40),
            checkInCount: checkIns.length,
          }
        : null,
      wearable: options.wearable,
    },
  };
}

// ---------------------------------------------------------------------------
// Message threads
// ---------------------------------------------------------------------------

function thread(
  patientId: string,
  clinicianId: string,
  turns: [offset: number, from: 'p' | 'c', text: string][],
): DemoThread {
  return {
    patientId,
    clinicianId,
    messages: turns.map(([offset, from, text], index) => ({
      id: `demo_m_${patientId}_${index}`,
      fromId: from === 'p' ? patientId : clinicianId,
      text,
      createdAt: iso(offset, from === 'p' ? 19 : 11, 20 + (index % 30)),
    })),
  };
}

const NOAH_THREAD: [number, 'p' | 'c', string][] = [
  [63, 'c', "Hi Noah, I can see your account is set up. Take the first week just rating things honestly, and do not worry about the practice yet."],
  [62, 'p', 'Ok. The blinking is the one that bothers me most in class so I put that highest.'],
  [56, 'c', 'That matches what I saw in clinic. The slow controlled blink is the one to start with. Notice the pull in your eyelids before the squeeze. The noticing is the part that does the work.'],
  [49, 'p', 'I can feel it coming now, maybe half the time. Holding the slow blink for a minute is harder than it sounds.'],
  [48, 'c', "Half the time after a week is good. Treat the minute as a floor. If the urge is still there when it ends, stay with it."],
  [37, 'p', 'Exam week, I barely practised. Everything got worse, especially the throat.'],
  [36, 'c', "That is expected and it is not lost ground. Tics wax and wane with stress. Pick the practice back up when the week is over, and keep rating even on the days you skip."],
  [28, 'p', 'Blinking is way down. The throat clearing is the worst one now. The sip and swallow thing does not really do anything.'],
  [27, 'c', "Then we retire it. Swallowing competes with the wrong muscles for you. Try the diaphragmatic breathing instead: a slow breath low in the belly, through the scratch, without clearing."],
  [24, 'p', 'Switched it over today.'],
  [16, 'c', 'I can see the throat numbers coming down since the switch. How does the urge feel compared to three weeks ago?'],
  [15, 'p', 'Still strong but I can sit with it longer. Like 40 seconds before it gets bad instead of 10.'],
  [14, 'c', 'That is the number I care about most. Keep going as you are.'],
  [6, 'p', 'Two weeks straight of check-ins now. Shoulder is creeping up a bit after basketball though.'],
  [5, 'c', "Noted. If it keeps climbing we will move the target to it. Bring the report to the next visit and we will look at the stress days together."],
  [1, 'p', 'Will do. See you Thursday.'],
];

const MAYA_THREAD: [number, 'p' | 'c', string][] = [
  [20, 'c', 'Welcome Maya. Start with the ratings for a few days before adding the practice.'],
  [18, 'p', 'Done. The sniffing is the one I notice most.'],
  [11, 'c', 'Good. The silent nasal breath is a clean fit for that one. Keep the check-ins going.'],
  [3, 'p', 'Getting easier to catch it before it happens.'],
];

const ELI_THREAD: [number, 'p' | 'c', string][] = [
  [44, 'c', 'Hi Eli, I can see four weeks of ratings. The head jerk is clearly the one to work on.'],
  [43, 'p', 'Agreed. The chin tuck is awkward in class but it does work.'],
  [22, 'c', 'Inconspicuous matters as much as effective. If it draws attention we can try holding your head at the midline instead.'],
  [21, 'p', 'I will try that one this week.'],
  [8, 'p', 'Midline is much easier to do without anyone noticing.'],
  [7, 'c', 'Then stay with it. Your numbers have been flat for ten days, which after a drop is usually consolidation rather than a stall.'],
];

// ---------------------------------------------------------------------------
// The seed
// ---------------------------------------------------------------------------

export function buildDemoSeed(): DemoSeed {
  const noahSpan = 70;
  const noahCreated = iso(noahSpan, 18, 5);
  const noahTrajectories = noahTics(noahCreated);

  const noah = patient({
    id: ID.noah,
    username: 'noahdemo',
    displayName: 'Noah',
    age: 15,
    span: noahSpan,
    trajectories: noahTrajectories,
    targetId: 'tic_throat',
    // Days worked against the throat clearing since the target moved off blinking.
    targetStreakDays: 24,
    motorNarrative:
      'I squeeze my eyes shut really hard, way more than normal blinking, and it is worst when I am reading. My right shoulder pulls up to my ear when I am sitting still, and my head snaps to the left every so often.',
    vocalNarrative:
      'I clear my throat a lot. It feels dry and scratchy at the back and I have to do it two or three times before it goes away. People ask if I am sick.',
    insight: {
      greeting: 'Welcome back, Noah.',
      // Two short sentences. This sits above the check-in button.
      summary:
        'Ten weeks in, and the throat clearing is down from a 5 to a 3. Twenty-five days of check-ins in a row.',
      advice: 'Your worse days are the stressed ones. Have the breathing ready before Thursday.',
    },
    wearable: {
      // All four. Between them nothing on his list goes uncounted: the glasses
      // catch the blink and the head jerk, the earbuds hear the throat, the
      // watch picks up the shoulder, and the watch and ring supply sleep and
      // the stress index.
      deviceIds: ['watch', 'glasses', 'buds', 'ring'],
      pairedAt: iso(35, 16, 20),
      lastSyncAt: iso(0, 7, 5),
    },
  });

  const maya = patient({
    id: ID.maya,
    username: 'mayademo',
    displayName: 'Maya',
    age: 12,
    span: 21,
    targetId: 'tic_sniff',
    targetStreakDays: 11,
    trajectories: [
      {
        tic: {
          id: 'tic_sniff',
          name: 'Sniffing',
          kind: 'vocal',
          region: 'voice',
          description: 'I sniff even when my nose is not running. It comes in threes.',
          severity: 3,
          urge: 3,
          blockerIds: ['silent-nasal-breath', 'diaphragm-breathing'],
          retiredBlockerIds: [],
          createdAt: iso(21, 17, 0),
        },
        from: 4,
        to: 3,
      },
      {
        tic: {
          id: 'tic_nose',
          name: 'Nose scrunch',
          kind: 'motor',
          region: 'face',
          description: 'I scrunch my nose up tight, usually right before the sniffing.',
          severity: 2,
          urge: 2,
          blockerIds: ['nose-still', 'smooth-forehead'],
          retiredBlockerIds: [],
          createdAt: iso(21, 17, 0),
        },
        from: 3,
        to: 2,
      },
    ],
    motorNarrative: 'I scrunch my nose up tight, mostly right before I sniff.',
    vocalNarrative: 'I sniff a lot even when my nose is fine. It usually comes in threes.',
    insight: null,
    wearable: { deviceIds: [], pairedAt: null, lastSyncAt: null },
  });

  const eli = patient({
    id: ID.eli,
    username: 'elidemo',
    displayName: 'Eli',
    age: 17,
    span: 49,
    targetId: 'tic_head2',
    targetStreakDays: 28,
    trajectories: [
      {
        tic: {
          id: 'tic_head2',
          name: 'Head jerk to the side',
          kind: 'motor',
          region: 'neck',
          description: 'My head snaps sideways, hard enough that people look over.',
          severity: 3,
          urge: 4,
          blockerIds: ['head-midline', 'chin-tuck'],
          retiredBlockerIds: [],
          createdAt: iso(49, 17, 30),
        },
        from: 5,
        to: 3,
      },
      {
        tic: {
          id: 'tic_grunt',
          name: 'Grunting',
          kind: 'vocal',
          region: 'voice',
          description: 'A low grunt from my chest, worse when I am concentrating.',
          severity: 2,
          urge: 3,
          blockerIds: ['paced-exhale', 'diaphragm-breathing'],
          retiredBlockerIds: [],
          createdAt: iso(49, 17, 30),
        },
        from: 3,
        to: 2,
      },
      {
        tic: {
          id: 'tic_fist',
          name: 'Hand clenching',
          kind: 'motor',
          region: 'hands',
          description: 'I clench my fist over and over until it feels even.',
          severity: 2,
          urge: 2,
          blockerIds: ['fist-open-close', 'hands-clasped'],
          retiredBlockerIds: [],
          createdAt: iso(49, 17, 30),
        },
        from: 2,
        to: 2,
      },
    ],
    motorNarrative:
      'My head snaps to the side hard enough that people notice, and I clench my fist over and over until it feels even.',
    vocalNarrative: 'A low grunt from my chest, worse when I am concentrating on something.',
    insight: null,
    wearable: { deviceIds: ['watch'], pairedAt: iso(14, 12, 0), lastSyncAt: iso(0, 8, 10) },
  });

  return {
    accounts: [
      // Dr. Ye holds the caseload the demo is built around.
      clinician(ID.ye, 'yedemo', 'Dr. Ye', CHOA, 26),
      // Colleagues, so choosing a provider is a real list rather than one name.
      clinician(ID.raman, 'ramandemo', 'Dr. Priya Raman', CHOA, 31),
      clinician(ID.hall, 'halldemo', 'Dr. Marcus Hall', INSTITUTIONS[1], 18),
      clinician(ID.duarte, 'duartedemo', 'Dr. Sofia Duarte', INSTITUTIONS[2], 22),
      clinician(ID.okafor, 'okafordemo', 'Dr. Ben Okafor', INSTITUTIONS[5], 15),
      noah,
      maya,
      eli,
    ],
    threads: [
      thread(ID.noah, ID.ye, NOAH_THREAD),
      thread(ID.maya, ID.ye, MAYA_THREAD),
      thread(ID.eli, ID.ye, ELI_THREAD),
    ],
  };
}
