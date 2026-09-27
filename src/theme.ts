/**
 * Most people using this are between about 10 and 18, and the screens also get
 * shown to a clinician. So the palette is pitched a little brighter and rounder
 * than a clinical tool would be, and stops well short of cartoonish: a teenager
 * reads primary colours and bubble shapes as being written for a younger child,
 * and a clinician reads them as a toy.
 *
 * The severity ramp is deliberately untouched. Those six colours carry meaning
 * on the body map, the history chart and every severity chip, and warm-to-hot is
 * the convention a clinician already reads.
 */
export const colors = {
  bg: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F8',
  border: '#E2E6F0',
  text: '#131A2A',
  textMuted: '#6A7288',
  textFaint: '#9AA2B6',
  primary: '#5A5CE0',
  primarySoft: '#EAECFE',
  accent: '#12C2AD',
  accentSoft: '#DBF7F2',
  warn: '#E8A33D',
  danger: '#DE5B5B',
  white: '#FFFFFF',
  /** Severity 0..5 ramp — also used by the body map and history chart. */
  severity: ['#D9DEEA', '#8FD4C4', '#F2CF6B', '#F0A55C', '#E5734F', '#D14B4B'],
};

export const severityColor = (v: number) =>
  colors.severity[Math.max(0, Math.min(5, Math.round(v)))];

/** Rounder than a form, short of a bubble. */
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

export const spacing = (n: number) => n * 8;

/** Enough lift that a card reads as something you can tap. */
export const shadow = {
  shadowColor: '#0B1020',
  shadowOpacity: 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};

export const type = {
  h1: { fontSize: 31, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.7 },
  h2: { fontSize: 23, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.45 },
  h3: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  muted: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  small: { fontSize: 12, color: colors.textFaint },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.textMuted, letterSpacing: 0.6 },
};
