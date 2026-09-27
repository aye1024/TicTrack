/**
 * Checks the baked demo accounts in `src/data/demoSeed.ts` against the same
 * logic the screens use.
 *
 * The history is generated relative to today and rebuilt whenever it goes
 * stale, so a change to the generator can quietly produce a demo that no longer
 * holds together — a streak that does not reach today, a target the app would
 * immediately want to rotate away from, a tic whose stored severity disagrees
 * with the last point on its own chart. Both of those last two were real, and
 * this script is what found them.
 *
 *   npm run verify:demo
 */

// Avoids a dependency on @types/node for one call.
declare const process: { exit(code: number): void };

import { buildDemoSeed } from '../src/data/demoSeed';
import {
  currentStreak,
  factorCorrelation,
  severityTrend,
  severitySeries,
  averageSeverity,
} from '../src/logic/analysis';
import { pickTargetTic, shouldRotateTarget } from '../src/logic/targeting';
import { blockerById } from '../src/data/blockers';
import {
  DEVICES,
  deviceFor,
  isUncovered,
  pairedDevices,
  projectedCount,
  wearableCorrelations,
  wearableDay,
} from '../src/data/wearable';
import type { AppData } from '../src/types';

const seed = buildDemoSeed();
let fails = 0;
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) fails += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
};

console.log(`accounts: ${seed.accounts.length}, threads: ${seed.threads.length}\n`);

// --- usernames unique, display names differ from usernames -----------------
const names = seed.accounts.map((a) => a.username.toLowerCase());
ok(new Set(names).size === names.length, 'usernames are unique');
const noah = seed.accounts.find((a) => a.username === 'noahdemo')!;
ok(!!noah, 'noahdemo exists');
ok(noah.displayName === 'Noah', 'display name is Noah, not the username', noah.displayName);

// --- every referenced blocker id really exists ------------------------------
let badBlocker: string | null = null;
for (const a of seed.accounts) {
  for (const tic of a.data.tics) {
    for (const id of [...tic.blockerIds, ...tic.retiredBlockerIds]) {
      if (!blockerById(id)) badBlocker = `${a.username}:${tic.id}:${id}`;
    }
  }
  for (const c of a.data.checkIns) {
    if (c.blockerId && !blockerById(c.blockerId)) badBlocker = `${a.username}:checkIn:${c.blockerId}`;
  }
}
ok(badBlocker === null, 'all blocker ids resolve', badBlocker ?? '');

// --- every check-in entry points at a real tic, and covers all of them -------
let entryMismatch: string | null = null;
for (const a of seed.accounts.filter((x) => x.data.tics.length)) {
  const ids = new Set(a.data.tics.map((t) => t.id));
  for (const c of a.data.checkIns) {
    if (c.entries.length !== ids.size) entryMismatch = `${a.username} ${c.date} entries=${c.entries.length}/${ids.size}`;
    for (const e of c.entries) if (!ids.has(e.ticId)) entryMismatch = `${a.username} ${c.date} stray ${e.ticId}`;
  }
}
ok(entryMismatch === null, 'check-in entries cover exactly the account tics', entryMismatch ?? '');

// --- ranges -----------------------------------------------------------------
let range: string | null = null;
for (const a of seed.accounts) {
  for (const c of a.data.checkIns) {
    for (const e of c.entries) {
      if (e.severity < 0 || e.severity > 5) range = `sev ${e.severity}`;
      if (e.urge < 1 || e.urge > 5) range = `urge ${e.urge}`;
    }
  }
}
ok(range === null, 'severity 0-5 and urge 1-5 everywhere', range ?? '');

// --- dates unique per account, sorted ascending ------------------------------
let dateIssue: string | null = null;
for (const a of seed.accounts.filter((x) => x.data.checkIns.length)) {
  const dates = a.data.checkIns.map((c) => c.date);
  if (new Set(dates).size !== dates.length) dateIssue = `${a.username} duplicate dates`;
  const sorted = [...dates].sort();
  if (dates.join() !== sorted.join()) dateIssue = `${a.username} not chronological`;
}
ok(dateIssue === null, 'one check-in per day, in order', dateIssue ?? '');

// --- Noah: the demo-critical assertions -------------------------------------
const d: AppData = noah.data;
const today = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const key = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;

console.log(`\nNoah: ${d.checkIns.length} check-ins, ${d.tics.length} tics`);
ok(d.checkIns.some((c) => c.date === key(today)), 'checked in TODAY (streak is live)');
const streak = currentStreak(d);
ok(streak >= 14, `streak >= 14`, `streak=${streak}`);

const trend = severityTrend(d);
ok(trend === 'improving', 'overall trend reads "improving"', trend);

const corr = factorCorrelation(d);
ok(corr.length >= 2, 'correlation panel finds >=2 factors', corr.map((c) => `${c.factor}+${c.delta.toFixed(2)}`).join(' '));
ok(corr.some((c) => c.factor === 'stress'), 'stress shows as a worsening factor');

const rot = shouldRotateTarget(d);
ok(!rot.rotate, 'no target rotation is pending on open', rot.reason);

const picked = pickTargetTic(d.tics);
ok(picked?.id === d.targetTicId, 'stored target matches what pickTargetTic would choose', `${picked?.id} vs ${d.targetTicId}`);

const target = d.tics.find((t) => t.id === d.targetTicId)!;
ok(target.severity >= Math.max(...d.tics.map((t) => t.severity)), 'target is the worst tic', `${target.name}=${target.severity}`);

const series = severitySeries(d, 'tic_throat');
const first = series[0].value, last = series[series.length - 1].value;
ok(last < first, 'target tic improved over the run', `${first} -> ${last}`);

const blinkSeries = severitySeries(d, 'tic_blink');
ok(blinkSeries[blinkSeries.length - 1].value < blinkSeries[0].value, 'previous target also improved',
   `${blinkSeries[0].value} -> ${blinkSeries[blinkSeries.length - 1].value}`);

ok(d.profile?.clinicianId === seed.accounts.find((a) => a.username === 'yedemo')!.id, 'Noah links to Dr. Ye');
ok(d.profile?.clinicianName === 'Dr. Ye', 'clinician name stored');
const noahDevices = pairedDevices(d);
ok(noahDevices.length === DEVICES.length, 'every wearable is paired',
   noahDevices.map((x) => x.name).join(', '));
const uncovered = d.tics.filter((t) => isUncovered(noahDevices, t));
ok(uncovered.length === 0, 'the paired devices cover every tic',
   uncovered.map((t) => t.name).join(', ') || 'none uncovered');
// Assertions about counts run against a *completed* day. Today is only counted
// up to the current hour, so before breakfast there is legitimately nothing to
// find, and asserting on it would make this script fail by the clock.
const yesterdayKey = key(new Date(Date.now() - 24 * 60 * 60 * 1000));
const day = wearableDay(d, yesterdayKey);
ok(day.detections.length === d.tics.length, 'a full day reports on every tic',
   `${day.detections.length}/${d.tics.length}`);
ok(day.total > 0, 'tics counted over a full day', `${day.total}`);
// The count a device reports is offered back as a 0-5 rating, so the round trip
// through countForSeverity and severityFromCount has to land where the patient
// actually rated that day. Checked on a completed day, where coverage is 24h.
const ratedThatDay = d.checkIns.find((c) => c.date === yesterdayKey);
let worstGap = 0;
for (const det of day.detections) {
  const entry = ratedThatDay?.entries.find((e) => e.ticId === det.ticId);
  if (!entry) continue;
  worstGap = Math.max(worstGap, Math.abs(det.suggestedSeverity - entry.severity));
}
ok(worstGap <= 1, 'the rating a full day suggests is within 1 of what was rated', `off by ${worstGap}`);
ok(projectedCount(100, 24) === 100, 'a complete day projects to itself');
// Weighting matters: nine quiet overnight hours carry a small share of the day,
// so the same count seen that early must project to a much larger whole.
ok(projectedCount(10, 9) > projectedCount(10, 20), 'an early count projects higher than a late one',
   `${projectedCount(10, 9)} vs ${projectedCount(10, 20)}`);
// Vitals do not depend on the hour, so today is the right thing to check.
const todayReadout = wearableDay(d);
ok(todayReadout.sleepHours != null && todayReadout.stressIndex != null,
   'sleep and stress index available today',
   `${todayReadout.sleepHours}h, stress ${todayReadout.stressIndex}`);
// A tic that two devices can hear must still be counted once.
const credited = new Set(day.detections.map((x) => x.ticId));
ok(credited.size === day.detections.length, 'no tic is double counted across devices');
const throat = day.detections.find((x) => x.ticId === 'tic_throat');
ok(throat?.deviceId === 'buds', 'the vocal tic is credited to the earbuds, not the wrist',
   String(throat?.deviceId));
const blink = day.detections.find((x) => x.ticId === 'tic_blink');
ok(blink?.deviceId === 'glasses', 'the blink is credited to the glasses', String(blink?.deviceId));
const shoulder = d.tics.find((t) => t.id === 'tic_shoulder')!;
ok(deviceFor(noahDevices, shoulder)?.id === 'watch' || deviceFor(noahDevices, shoulder)?.id === 'ring',
   'the shoulder falls to a motion sensor', String(deviceFor(noahDevices, shoulder)?.id));
ok(!!d.insight, 'cached Today-screen insight present');
// The Today screen reads the cache with JSON.parse and silently regenerates on
// failure, so a malformed cache costs a model request without ever showing.
let parsedInsight: { greeting?: string; summary?: string; advice?: string } | null = null;
try {
  parsedInsight = JSON.parse(d.insight!.text);
} catch {
  parsedInsight = null;
}
ok(parsedInsight !== null, 'the cached insight parses as JSON, so it is actually used');
ok(!!parsedInsight?.greeting && !!parsedInsight?.summary && !!parsedInsight?.advice,
   'cached insight has greeting, summary and advice');
ok(d.insight!.checkInCount === d.checkIns.length,
   'cached insight is not already stale', `${d.insight!.checkInCount} vs ${d.checkIns.length}`);
const words = (parsedInsight?.summary ?? '').trim().split(/\s+/).length;
ok(words <= 35, 'summary stays short enough not to push the check-in off screen', `${words} words`);
ok((parsedInsight?.summary ?? '').length <= 150,
   'summary fits without needing the More toggle', `${(parsedInsight?.summary ?? '').length} chars`);
ok(d.motorNarrative.length > 40 && d.vocalNarrative.length > 40, 'onboarding narratives kept for the report');
ok(target.retiredBlockerIds.length > 0, 'a competing response was tried and retired', target.retiredBlockerIds.join());
ok(d.checkIns.some((c) => c.note), 'some check-ins carry notes');
ok(d.checkIns.some((c) => c.practiced) && d.checkIns.some((c) => !c.practiced), 'practice is mixed, not perfect');

// --- measured sleep / stress against measured tic counts --------------------
const links = wearableCorrelations(d);
ok(links.length >= 1, 'the device finds at least one measured link',
   links.map((l) => `${l.label} +${l.deltaPercent}%`).join(', ') || 'none');
ok(links.some((l) => l.label === 'Short sleep'), 'short sleep links to a higher tic count');
for (const link of links) {
  ok(link.days >= 2 && link.withMean > link.withoutMean,
     `${link.label}: ${link.withMean} vs ${link.withoutMean} tics/day over ${link.days} days`);
}
// Maya has no wearable, so there is nothing to correlate and it must not throw.
const mayaAcct = seed.accounts.find((a) => a.username === 'mayademo')!;
ok(wearableCorrelations(mayaAcct.data).length === 0,
   'an unpaired account yields no measured links rather than an error');
// Eli wears only a watch: vitals yes, but his vocal tic is invisible to it.
const eliAcct = seed.accounts.find((a) => a.username === 'elidemo')!;
const eliDevices = pairedDevices(eliAcct.data);
ok(eliAcct.data.tics.some((t) => isUncovered(eliDevices, t)),
   'a watch-only account has an uncovered tic, so the NOT COVERED card has a job');

// --- fully connected: Dr. Ye's caseload and inbox ---------------------------
const ye = seed.accounts.find((a) => a.username === 'yedemo')!;
const caseload = seed.accounts.filter((a) => a.data.profile?.clinicianId === ye.id);
ok(caseload.length >= 3, 'Dr. Ye has >=3 patients', caseload.map((c) => c.displayName).join(', '));
const yeThreads = seed.threads.filter((t) => t.clinicianId === ye.id);
ok(yeThreads.length === caseload.length, 'every patient has a thread', `${yeThreads.length}/${caseload.length}`);

const noahThread = seed.threads.find((t) => t.patientId === noah.id)!;
ok(noahThread.messages.length >= 12, 'Noah thread is a real conversation', `${noahThread.messages.length} messages`);
ok(noahThread.messages.some((m) => m.fromId === noah.id) && noahThread.messages.some((m) => m.fromId === ye.id),
   'thread has both sides');
const times = noahThread.messages.map((m) => m.createdAt);
ok(times.join() === [...times].sort().join(), 'thread messages are chronological');

// clinicians spread across institutions for the picker
const clinicians = seed.accounts.filter((a) => a.data.profile?.role === 'clinician');
const insts = new Set(clinicians.map((c) => c.data.profile!.institution));
ok(clinicians.length >= 5, 'several clinicians exist', `${clinicians.length}`);
ok(insts.size >= 3, 'clinicians span >=3 institutions', `${insts.size}`);
const atChoa = clinicians.filter((c) => c.data.profile!.institution === "Children's Healthcare of Atlanta");
ok(atChoa.length >= 2, "Noah's institution lists more than one clinician", atChoa.map((c) => c.displayName).join(', '));

console.log(`\n--- history shape (Noah, avg severity) ---`);
const s = severitySeries(d);
const step = Math.max(1, Math.floor(s.length / 12));
for (let i = 0; i < s.length; i += step) {
  const v = s[i].value;
  console.log(`  ${s[i].date}  ${'#'.repeat(Math.round(v * 6)).padEnd(30)} ${v.toFixed(2)}`);
}
console.log(`  last: ${s[s.length - 1].date}  ${s[s.length - 1].value.toFixed(2)}`);

console.log(`\nfactors: ${corr.map((c) => `${c.factor} +${c.delta.toFixed(2)} (${c.days}d)`).join(', ')}`);
console.log(`\n${fails === 0 ? 'ALL CHECKS PASSED' : fails + ' CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
