import type { AppData, CheckIn, ContextFactor, Tic } from '../types';

export const FACTOR_LABELS: Record<ContextFactor, string> = {
  stress: 'Stress',
  poorSleep: 'Poor sleep',
  fatigue: 'Fatigue',
  excitement: 'Excitement',
  caffeine: 'Caffeine',
  exercise: 'Hard exercise',
};

export const todayKey = (d = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function averageSeverity(checkIn: CheckIn | null): number {
  if (!checkIn || checkIn.entries.length === 0) return 0;
  const total = checkIn.entries.reduce((sum, e) => sum + e.severity, 0);
  return total / checkIn.entries.length;
}

/**
 * Daily average severity in chronological order — the history chart's series.
 *
 * With a `ticId`, days before that tic was added are left out rather than
 * plotted as zero: a tic added last week would otherwise draw a line along the
 * floor for every check-in that preceded it, which reads as months of perfect
 * days instead of no data.
 */
export function severitySeries(data: AppData, ticId?: string): { date: string; value: number }[] {
  const ordered = data.checkIns.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!ticId) {
    return ordered.map((checkIn) => ({ date: checkIn.date, value: averageSeverity(checkIn) }));
  }
  const series: { date: string; value: number }[] = [];
  for (const checkIn of ordered) {
    const entry = checkIn.entries.find((e) => e.ticId === ticId);
    if (!entry) continue;
    series.push({ date: checkIn.date, value: entry.severity });
  }
  return series;
}

/** The tic list as every screen shows it: worst first, urge breaking ties. */
export function ticsBySeverity(data: AppData): Tic[] {
  return data.tics.slice().sort((a, b) => b.severity - a.severity || b.urge - a.urge);
}

export function severityTrend(
  data: AppData,
): 'improving' | 'steady' | 'worsening' | 'not_enough_data' {
  const series = severitySeries(data);
  if (series.length < 4) return 'not_enough_data';
  const half = Math.floor(series.length / 2);
  const mean = (xs: { value: number }[]) => xs.reduce((s, x) => s + x.value, 0) / xs.length;
  const delta = mean(series.slice(half)) - mean(series.slice(0, half));
  if (delta <= -0.4) return 'improving';
  if (delta >= 0.4) return 'worsening';
  return 'steady';
}

/**
 * How much worse an average day is when a given context factor was logged.
 * This is the "stress / sleep / fatigue -> reduce it" arrow on the whiteboard.
 */
export function factorCorrelation(
  data: AppData,
): { factor: ContextFactor; label: string; delta: number; days: number }[] {
  const results: { factor: ContextFactor; label: string; delta: number; days: number }[] = [];
  const factors = Object.keys(FACTOR_LABELS) as ContextFactor[];

  for (const factor of factors) {
    const withFactor = data.checkIns.filter((c) => c.factors.includes(factor));
    const without = data.checkIns.filter((c) => !c.factors.includes(factor));
    if (withFactor.length < 2 || without.length < 2) continue;
    const mean = (cs: CheckIn[]) => cs.reduce((s, c) => s + averageSeverity(c), 0) / cs.length;
    const delta = mean(withFactor) - mean(without);
    if (delta > 0.25) {
      results.push({ factor, label: FACTOR_LABELS[factor], delta, days: withFactor.length });
    }
  }
  return results.sort((a, b) => b.delta - a.delta);
}

/** Consecutive days ending today (or yesterday) with a completed check-in. */
export function currentStreak(data: AppData): number {
  const dates = new Set(data.checkIns.map((c) => c.date));
  let streak = 0;
  const cursor = new Date();
  if (!dates.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(todayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export const ticById = (data: AppData, id: string | null): Tic | null =>
  (id && data.tics.find((t) => t.id === id)) || null;
