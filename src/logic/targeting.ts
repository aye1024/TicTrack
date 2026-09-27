import { BLOCKERS, blockerById, blockersForTic } from '../data/blockers';
import type { AppData, Tic } from '../types';
import { severitySeries } from './analysis';

/**
 * Target selection:
 *
 *  - Severity is the primary signal.
 *  - The premonitory urge breaks ties: a strong urge means more warning, which
 *    makes a competing response easier to land.
 *  - A tic with a blocker that has not been rejected is preferred.
 */
export function pickTargetTic(tics: Tic[]): Tic | null {
  if (tics.length === 0) return null;

  const scored = tics.map((tic) => {
    const available = tic.blockerIds
      .filter((id) => !tic.retiredBlockerIds.includes(id))
      .map(blockerById)
      .filter(Boolean);
    return {
      tic,
      hasBlocker: available.length > 0,
      score: tic.severity * 2 + tic.urge * 0.5,
    };
  });

  const eligible = scored.filter((s) => s.hasBlocker);
  const pool = eligible.length > 0 ? eligible : scored;
  pool.sort((a, b) => b.score - a.score);
  return pool[0].tic;
}

/** The blocker currently in play for a tic: first one not yet retired. */
export function activeBlockerFor(tic: Tic | null) {
  if (!tic) return null;
  const live = tic.blockerIds.filter((id) => !tic.retiredBlockerIds.includes(id));
  if (live.length > 0) return blockerById(live[0]) ?? null;
  // Every candidate has been tried. Fall back to something for the right body
  // part rather than whatever happens to sit first in the library.
  const byRegion = blockersForTic(tic.region, tic.kind);
  return byRegion[0] ?? BLOCKERS.find((b) => b.id === 'progressive-relaxation') ?? BLOCKERS[0];
}

/**
 * The 6-of-7 rule from the whiteboard: once the target has scored below another
 * tic on at least six of the last seven days, that other tic takes over.
 */
export function shouldRotateTarget(
  data: AppData,
): { rotate: boolean; toTicId: string | null; reason: string } {
  const target = data.targetTicId;
  if (!target || data.tics.length < 2) {
    return { rotate: false, toTicId: null, reason: '' };
  }
  const recent = data.checkIns
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);
  if (recent.length < 7) return { rotate: false, toTicId: null, reason: '' };

  for (const candidate of data.tics) {
    if (candidate.id === target) continue;
    let beaten = 0;
    for (const checkIn of recent) {
      const targetEntry = checkIn.entries.find((e) => e.ticId === target);
      const otherEntry = checkIn.entries.find((e) => e.ticId === candidate.id);
      if (!targetEntry || !otherEntry) continue;
      if (targetEntry.severity < otherEntry.severity) beaten += 1;
    }
    if (beaten >= 6) {
      return {
        rotate: true,
        toTicId: candidate.id,
        reason: `${candidate.name} has scored higher than your current target on ${beaten} of the last 7 days.`,
      };
    }
  }
  return { rotate: false, toTicId: null, reason: '' };
}

/** Progress of the current target, used by the tic detail screen. */
export function targetProgress(data: AppData) {
  const series = severitySeries(data, data.targetTicId ?? undefined);
  if (series.length < 2) return { delta: 0, first: series[0]?.value ?? 0, last: series[0]?.value ?? 0 };
  return {
    delta: series[series.length - 1].value - series[0].value,
    first: series[0].value,
    last: series[series.length - 1].value,
  };
}
