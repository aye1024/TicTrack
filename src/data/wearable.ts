import type {
  AppData,
  BodyRegion,
  Tic,
  TicKind,
  WearableDeviceId,
  WearableLink,
} from '../types';
import { todayKey } from '../logic/analysis';

/**
 * The wearable half of the whiteboard: a watch, a ring, glasses or earbuds
 * counting tics passively between check-ins, so the daily rating is not the
 * only thing the app knows about the day.
 *
 * Nothing here touches a real sensor. Every number is generated from a seed
 * made of the date and the tic id, which means the same day always produces
 * the same readout — the screens can be reopened, and a demo can be rehearsed,
 * without the figures moving around. The shape of the model is the point:
 * each device catches a different kind of tic, tics cluster in the evening,
 * and the counts track the severity the user reported for that day, so the
 * suggested rating the watch offers back is one a person would recognise.
 */

export type { WearableDeviceId };

export type WearableDevice = {
  id: WearableDeviceId;
  name: string;
  /** Ionicons name, so the screens do not each pick their own. */
  icon: string;
  /** What it reads, in the words a user would see on a spec sheet. */
  sensors: string;
  /** Tic kinds this hardware can plausibly pick up. */
  kinds: TicKind[];
  /** Motor tics only register when the sensor is near the body part moving. */
  regions: BodyRegion[] | 'all';
  /** Whether it also reports sleep and a stress index. */
  vitals: boolean;
  blurb: string;
};

export const DEVICES: WearableDevice[] = [
  {
    id: 'watch',
    name: 'Apple Watch',
    icon: 'watch-outline',
    sensors: 'Wrist motion · heart rate · sleep',
    kinds: ['motor'],
    regions: 'all',
    vitals: true,
    blurb: 'Accelerometer picks up repeated movements and the jolt they send through the arm.',
  },
  {
    id: 'ring',
    name: 'Smart ring',
    icon: 'ellipse-outline',
    sensors: 'Finger motion · resting heart rate · sleep',
    kinds: ['motor'],
    regions: 'all',
    vitals: true,
    blurb: 'Same idea as the watch, worn all day, including in class.',
  },
  {
    id: 'glasses',
    name: 'Smart glasses',
    icon: 'glasses-outline',
    sensors: 'Head motion · microphone',
    kinds: ['motor', 'vocal'],
    regions: ['head', 'eyes', 'face', 'mouth', 'neck', 'voice'],
    vitals: false,
    blurb: 'Sits on the head, so blinks, grimaces and head jerks are the clearest signal.',
  },
  {
    id: 'buds',
    name: 'AirPods',
    icon: 'headset-outline',
    sensors: 'Microphone · head motion',
    kinds: ['vocal'],
    regions: 'all',
    vitals: false,
    blurb: 'Hears throat clearing, grunts and shouts, and times how long each one lasts.',
  },
];

export const deviceById = (id: string | null | undefined): WearableDevice | null =>
  DEVICES.find((d) => d.id === id) ?? null;

export const NO_DEVICE: WearableLink = { deviceIds: [], pairedAt: null, lastSyncAt: null };

/**
 * The paired devices, normalised.
 *
 * Accounts predate the field entirely, and accounts written when only one
 * device could be paired carry `deviceId` instead of `deviceIds`. Both are
 * folded in here so no screen has to know about either case.
 */
export function linkOf(data: AppData): WearableLink {
  const link = data.wearable;
  if (!link) return NO_DEVICE;
  if (Array.isArray(link.deviceIds)) return link;
  return {
    ...link,
    deviceIds: link.deviceId ? [link.deviceId] : [],
  };
}

/** Every paired device, in the order they were added. */
export const pairedDevices = (data: AppData): WearableDevice[] =>
  linkOf(data)
    .deviceIds.map(deviceById)
    .filter((d): d is WearableDevice => d !== null);

/** The first paired device, for the places that only have room for one name. */
export const pairedDevice = (data: AppData): WearableDevice | null =>
  pairedDevices(data)[0] ?? null;

export function deviceSees(device: WearableDevice, tic: Tic): boolean {
  if (!device.kinds.includes(tic.kind)) return false;
  if (tic.kind === 'vocal') return true;
  return device.regions === 'all' || device.regions.includes(tic.region);
}

/**
 * Which device a tic is credited to when several can pick it up. Without this
 * the list would credit everything to whichever device was paired first.
 *
 * The closest sensor wins, and closeness means something different per kind: a
 * microphone in the ear canal hears a throat better than one on a pair of
 * glasses, while for movement what matters is sitting on the part that moves.
 */
export function deviceFor(devices: WearableDevice[], tic: Tic): WearableDevice | null {
  const able = devices.filter((device) => deviceSees(device, tic));
  if (able.length === 0) return null;
  if (tic.kind === 'vocal') {
    // The device that does nothing but listen, over one that also tracks motion.
    return able.find((device) => device.kinds.length === 1) ?? able[0];
  }
  // A device naming the region explicitly is on that part of the body; one
  // claiming `all` is reading the movement second-hand from the wrist.
  return able.find((device) => device.regions !== 'all') ?? able[0];
}

/** True when nothing paired can pick this tic up. */
export const isUncovered = (devices: WearableDevice[], tic: Tic): boolean =>
  deviceFor(devices, tic) === null;

/**
 * How a day's tics fall across the hours. Near zero while asleep, a bump
 * after waking, and the real peak in the evening — the pattern CBIT clinicians
 * hear described over and over, and the reason an hourly view is worth showing.
 */
const HOUR_WEIGHTS = [
  0.03, 0.02, 0.02, 0.02, 0.03, 0.06, 0.15, 0.4, 0.5, 0.35, 0.34, 0.36, 0.45, 0.4, 0.38, 0.55, 0.7,
  0.9, 1.15, 1.25, 1.1, 0.75, 0.4, 0.15,
];

function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Spread `total` tics over the 24 hours, keeping the total exact.
 *
 * The counts are allocated in proportion to the weights rather than drawn one
 * by one: a day holds few enough tics that independent draws would let a
 * random morning hour out-spike the evening, and the chart would then argue
 * with the sentence printed under it. A nudge between neighbouring hours keeps
 * two days from looking identical.
 */
function spreadOverDay(total: number, rnd: () => number): number[] {
  const sum = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);
  const exact = HOUR_WEIGHTS.map((w) => (w / sum) * total);
  const hours = exact.map((v) => Math.floor(v));

  // Whatever rounding left over goes to the hours that lost the most to it.
  const byRemainder = exact
    .map((v, hour) => ({ hour, fraction: v - Math.floor(v) }))
    .sort((a, b) => b.fraction - a.fraction);
  let left = total - hours.reduce((a, b) => a + b, 0);
  for (const { hour } of byRemainder) {
    if (left <= 0) break;
    hours[hour] += 1;
    left -= 1;
  }

  for (let hour = 0; hour < 24; hour += 1) {
    if (hours[hour] > 0 && rnd() < 0.35) {
      const to = Math.min(23, Math.max(0, hour + (rnd() < 0.5 ? -1 : 1)));
      hours[hour] -= 1;
      hours[to] += 1;
    }
  }
  return hours;
}

/**
 * Hours a partial day is treated as covering, at minimum.
 *
 * The hours a day counts first are its quietest: midnight to 6am carries under
 * 2% of the weight, so a literal reading before breakfast rounds to zero tics
 * and the screen has nothing on it at all. Nine hours is where the overnight
 * window plus the start of the morning gives a figure that is non-zero while the
 * label still says "so far".
 *
 * This does mean that early in the morning the readout covers a wider window
 * than the clock does. Every reading on this screen is simulated from the
 * patient's own ratings and the screen says so, so the floor is a property of
 * the simulation rather than a claim about a sensor.
 */
const MIN_COVERED_HOURS = 9;

/** Total of `HOUR_WEIGHTS`, for turning a covered window into a fraction of a day. */
const TOTAL_WEIGHT = HOUR_WEIGHTS.reduce((sum, w) => sum + w, 0);

/**
 * How much of a day's tics fall in its first `hours` hours.
 *
 * Scaling a partial count up by `24 / hoursCovered` assumes tics are spread
 * evenly, and they are the opposite of even: the evening carries several times
 * the weight of the morning. Projecting by hours therefore reads a morning as a
 * quiet day and suggests a severity well below what the patient would recognise.
 * Weight is the right denominator.
 */
function coveredFraction(hours: number): number {
  if (hours >= 24) return 1;
  let covered = 0;
  for (let hour = 0; hour < hours; hour += 1) covered += HOUR_WEIGHTS[hour];
  return Math.max(0.01, covered / TOTAL_WEIGHT);
}

/** A partial day's count, scaled to what the whole day is on course for. */
export const projectedCount = (count: number, coveredHours: number) =>
  Math.round(count / coveredFraction(coveredHours));

/** Tics a day at a given severity. Roughly six an hour when it is at its worst. */
const countForSeverity = (severity: number) => 5 + severity * 9;

/** The inverse, so the count the watch reports maps back onto the 0–5 scale. */
export const severityFromCount = (count: number) =>
  Math.max(0, Math.min(5, Math.round((count - 5) / 9)));

/** What the user rated this tic on that date, falling back to where it stands now. */
function severityOn(data: AppData, tic: Tic, date: string): number {
  const checkIn = data.checkIns.find((c) => c.date === date);
  const entry = checkIn?.entries.find((e) => e.ticId === tic.id);
  return entry ? entry.severity : tic.severity;
}

export type TicDetection = {
  ticId: string;
  name: string;
  kind: TicKind;
  /** Tics counted, and how they fell across the 24 hours. */
  count: number;
  hours: number[];
  peakHour: number;
  /** Mean length of one tic, seconds — the whiteboard's "duration". */
  meanSeconds: number;
  /** The 0–5 rating those counts work out to. */
  suggestedSeverity: number;
  /** Which paired device picked it up. */
  deviceId: WearableDeviceId;
};

export type WearableDay = {
  date: string;
  /** True for today, where the day is only counted up to the current hour. */
  partial: boolean;
  /** Hours covered so far — 24 on a finished day. */
  coveredHours: number;
  total: number;
  hours: number[];
  detections: TicDetection[];
  peakHour: number;
  /** The three hours the tics clustered in — what the chart highlights. */
  peakHours: number[];
  /** Null when nothing paired has a vitals sensor. */
  sleepHours: number | null;
  /** 0–100, the "stress / motion / tired" arrow on the board. Null as above. */
  stressIndex: number | null;
};

export function wearableDay(data: AppData, date: string = todayKey()): WearableDay {
  const devices = pairedDevices(data);
  const hasVitals = devices.some((device) => device.vitals);
  const partial = date === todayKey();
  const coveredHours = partial ? Math.max(MIN_COVERED_HOURS, new Date().getHours() + 1) : 24;

  const detections: TicDetection[] = [];
  for (const tic of data.tics) {
    // Credited to one device even when two could hear it, so a tic is counted
    // once rather than once per wearable.
    const source = deviceFor(devices, tic);
    if (!source) continue;
    const rnd = seeded(`${date}:${tic.id}`);
    const severity = severityOn(data, tic, date);
    if (severity <= 0) continue;

    // Today's count is held close to the severity it stands for, so the rating
    // the device suggests back is one the user would recognise. Past days,
    // which only ever appear as a total in the weekly bars, wander further.
    const spread = partial ? 0.12 : 0.34;
    const target = Math.round(countForSeverity(severity) * (1 - spread / 2 + rnd() * spread));
    const full = spreadOverDay(target, rnd);
    const hours = full.map((n, hour) => (hour < coveredHours ? n : 0));
    const count = hours.reduce((sum, n) => sum + n, 0);
    if (count === 0) continue;

    detections.push({
      ticId: tic.id,
      name: tic.name,
      kind: tic.kind,
      deviceId: source.id,
      count,
      hours,
      peakHour: busiestHour(hours),
      meanSeconds: Math.round((tic.kind === 'vocal' ? 1.4 : 0.9) * (1 + severity * 0.35) * 10) / 10,
      // A partial day is scaled to the whole day before being rated, by weight
      // rather than by clock hours.
      suggestedSeverity: severityFromCount(projectedCount(count, coveredHours)),
    });
  }

  detections.sort((a, b) => b.count - a.count);

  const hours = new Array(24).fill(0) as number[];
  for (const detection of detections) {
    detection.hours.forEach((n, hour) => {
      hours[hour] += n;
    });
  }
  const total = hours.reduce((sum, n) => sum + n, 0);

  const vitals = seeded(`${date}:vitals`);
  const checkIn = data.checkIns.find((c) => c.date === date);
  const poorSleep = checkIn?.factors.includes('poorSleep') ?? false;
  const stressed = checkIn?.factors.includes('stress') ?? false;

  return {
    date,
    partial,
    coveredHours,
    total,
    hours,
    detections,
    peakHour: total > 0 ? busiestHour(hours) : -1,
    peakHours: total > 0 ? [0, 1, 2].map((n) => heaviestWindow(hours) + n) : [],
    sleepHours: hasVitals
      ? Math.round(((poorSleep ? 5.2 : 7.1) + vitals() * 1.6) * 10) / 10
      : null,
    stressIndex: hasVitals
      ? Math.round((stressed ? 62 : 34) + vitals() * 24 + (poorSleep ? 8 : 0))
      : null,
  };
}

/**
 * What the device measured, set against what it counted.
 *
 * `factorCorrelation` in `logic/analysis.ts` does this for the things the user
 * *reports* — "I slept badly" against the severity they rated themselves. This
 * is the other half: sleep hours and a stress index the hardware produced,
 * against the tic count the hardware produced, with the user's own judgement
 * out of the loop on both sides.
 *
 * That is the case for wearing anything at all. A rating is one number recalled
 * at bedtime by someone who had a bad day; a count is a count.
 *
 * Both sides are simulated here, and simulated from the same daily ratings, so
 * a link found in demo data is not independent evidence of anything. The shape
 * of the calculation is what is real, and it is what a HealthKit feed would drop
 * straight into.
 */
export type MeasuredLink = {
  /** "Short sleep" — what the device saw. */
  label: string;
  /** "under 7h a night" — the line drawn to split the days. */
  condition: string;
  /** Mean tics a day on the days that met the condition, and on the rest. */
  withMean: number;
  withoutMean: number;
  /** Days on the `with` side. */
  days: number;
  /** How much higher the count runs on those days, as a percentage. */
  deltaPercent: number;
};

type DayReading = { total: number; sleepHours: number | null; stressIndex: number | null };

/** Sleep under this many hours counts as a short night. */
const SHORT_SLEEP_HOURS = 7;
/** Stress index at or above this counts as a high-stress day. */
const HIGH_STRESS = 60;

function splitBy(
  readings: DayReading[],
  label: string,
  condition: string,
  test: (reading: DayReading) => boolean | null,
): MeasuredLink | null {
  const withIt: number[] = [];
  const withoutIt: number[] = [];
  for (const reading of readings) {
    const hit = test(reading);
    if (hit === null) continue; // the device does not measure it
    (hit ? withIt : withoutIt).push(reading.total);
  }
  // Two days a side is the least that can be called a pattern rather than a day.
  if (withIt.length < 2 || withoutIt.length < 2) return null;

  const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const withMean = mean(withIt);
  const withoutMean = mean(withoutIt);
  if (withoutMean <= 0) return null;

  const deltaPercent = Math.round(((withMean - withoutMean) / withoutMean) * 100);
  // Only worth a line on the screen if it moved the count appreciably.
  if (deltaPercent < 12) return null;

  return {
    label,
    condition,
    withMean: Math.round(withMean),
    withoutMean: Math.round(withoutMean),
    days: withIt.length,
    deltaPercent,
  };
}

export function wearableCorrelations(data: AppData, days = 21): MeasuredLink[] {
  const readings: DayReading[] = [];
  // Today is only counted up to the current hour, so it would drag every mean
  // it landed on. Completed days only.
  for (let offset = days; offset >= 1; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const day = wearableDay(data, todayKey(date));
    if (day.total === 0) continue;
    readings.push({ total: day.total, sleepHours: day.sleepHours, stressIndex: day.stressIndex });
  }
  if (readings.length < 6) return [];

  return [
    splitBy(readings, 'Short sleep', `under ${SHORT_SLEEP_HOURS}h a night`, (r) =>
      r.sleepHours == null ? null : r.sleepHours < SHORT_SLEEP_HOURS,
    ),
    splitBy(readings, 'High stress', `stress index ${HIGH_STRESS} or over`, (r) =>
      r.stressIndex == null ? null : r.stressIndex >= HIGH_STRESS,
    ),
  ]
    .filter((link): link is MeasuredLink => link !== null)
    .sort((a, b) => b.deltaPercent - a.deltaPercent);
}

/** The last `days` days, oldest first — the bar chart under the day's readout. */
export function wearableWeek(data: AppData, days = 7): { date: string; total: number }[] {
  const out: { date: string; total: number }[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = todayKey(date);
    out.push({ date: key, total: wearableDay(data, key).total });
  }
  return out;
}

/**
 * The heaviest three hours, as a start hour. Tics are sparse enough that a
 * single hour can win on noise, so the window is what the screens quote and the
 * busiest hour is read out of it.
 */
function heaviestWindow(hours: number[]): number {
  let best = 0;
  let bestSum = -1;
  for (let start = 0; start <= 21; start += 1) {
    const sum = hours[start] + hours[start + 1] + hours[start + 2];
    if (sum > bestSum) {
      bestSum = sum;
      best = start;
    }
  }
  return best;
}

function busiestHour(hours: number[]): number {
  const start = heaviestWindow(hours);
  const window = hours.slice(start, start + 3);
  return start + window.indexOf(Math.max(...window));
}

export const hourLabel = (hour: number) => {
  if (hour < 0) return '—';
  const suffix = hour < 12 ? 'am' : 'pm';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${suffix}`;
};

/** "7pm to 9pm" — the window the tics actually cluster in. */
export function peakWindow(hours: number[]): string | null {
  if (hours.every((n) => n === 0)) return null;
  const start = heaviestWindow(hours);
  return `${hourLabel(start)} to ${hourLabel(start + 3)}`;
}

/**
 * One plain sentence about the stretch the user did not report on — the
 * "device for user from last time to this time" note on the board.
 */
export function sinceLastCheckIn(data: AppData): string {
  const day = wearableDay(data);
  if (day.total === 0) return 'Nothing counted yet today.';
  const window = peakWindow(day.hours);
  const top = day.detections[0];
  const lead = `${day.total} tic${day.total === 1 ? '' : 's'} counted today`;
  if (!top) return `${lead}.`;
  return window
    ? `${lead}, mostly ${top.name.toLowerCase()}, and mostly between ${window}.`
    : `${lead}, mostly ${top.name.toLowerCase()}.`;
}
