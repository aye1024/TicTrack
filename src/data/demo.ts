import type { AppData, CheckIn, ContextFactor } from '../types';
import { todayKey } from '../logic/analysis';

/**
 * Generates a fortnight of plausible history for the tics already on the
 * account. Useful for a demo, where the trend line, the context correlations
 * and the report all need more than one day of data to say anything.
 *
 * The shape is deliberately not a clean line: the targeted tic improves clearly,
 * the others drift down only slightly, there is a worse stretch in the middle,
 * and severity rises on stress and poor-sleep days so the correlation panel has
 * something real to find. Today's ratings are taken as the starting point, so
 * after seeding each tic sits at the improved end of its own two-week run.
 */
export function seedHistory(data: AppData, days = 14): CheckIn[] {
  if (data.tics.length === 0) return [];

  const checkIns: CheckIn[] = [];
  const target = data.targetTicId ?? data.tics[0].id;

  for (let offset = days; offset >= 1; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);

    // Two rough patches, so the line is not suspiciously smooth.
    const roughPatch = offset <= 11 && offset >= 8;
    const factors: ContextFactor[] = [];
    if (roughPatch || offset % 5 === 0) factors.push('stress');
    if (offset % 4 === 0) factors.push('poorSleep');
    if (offset % 7 === 0) factors.push('caffeine');
    if (offset % 6 === 0) factors.push('fatigue');

    const bump = (factors.includes('stress') ? 0.9 : 0) + (factors.includes('poorSleep') ? 0.6 : 0);

    // The tic being worked on improves substantially over the fortnight; the
    // others drift down only slightly, which is what CBIT actually looks like.
    const progress = (days - offset) / days;

    const entries = data.tics.map((tic, index) => {
      const drop = (tic.id === target ? 2.2 : 0.6) * progress;
      const wobble = ((offset * 7 + index * 13) % 5) / 5 - 0.4;
      const raw = tic.severity - drop + bump + wobble;
      const clamp = (value: number) => Math.max(1, Math.min(5, Math.round(value)));
      return { ticId: tic.id, severity: clamp(raw), urge: clamp(raw - 0.4) };
    });

    const practiced = offset % 6 !== 0;
    checkIns.push({
      id: `seed_${offset}`,
      date: todayKey(date),
      createdAt: date.toISOString(),
      entries,
      factors,
      targetTicId: target,
      blockerId: data.tics.find((t) => t.id === target)?.blockerIds[0] ?? null,
      practiced,
      practiceSeconds: practiced ? 120 : 0,
      blockerEffective: practiced ? offset % 3 !== 0 : null,
      note: '',
    });
  }

  return checkIns;
}
