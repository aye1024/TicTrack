import { BLOCKERS } from '../data/blockers';
import { CBIT_BACKGROUND, demographicContext } from '../data/clinicalContext';
import { hasLLM } from '../config';
import type { AppData, AssistantMessage, Tic } from '../types';
import { streamChat, streamJson } from './glm';
import { BlockerMatches, DailyInsight, ExtractedTics, ProgressReport, REGIONS } from './schemas';
import {
  dailyInsightLocally,
  extractTicsLocally,
  matchBlockersLocally,
  labelTic,
  progressReportLocally,
  SUGGESTED_TIC_NAMES,
} from './fallback';
import {
  FACTOR_LABELS,
  averageSeverity,
  currentStreak,
  factorCorrelation,
  severitySeries,
  severityTrend,
} from '../logic/analysis';

/**
 * House style, applied to everything the model writes for a user to read.
 *
 * The two bans are there because both tics are recognisable as machine writing.
 * An em dash used as a dramatic pause, and the "not X, but Y" reversal, show up
 * far more often in generated prose than in anything a clinician would write, and
 * a patient who notices the seam stops trusting the rest.
 */
const HOUSE_STYLE = `Writing rules, applied to every field you return:
- Never use an em dash or an en dash. Use a comma, a full stop, or a separate sentence.
- Never use the "it is not X, it is Y" or "not X but Y" construction. State what is true and stop.
- No bullet points, headings or markdown unless the field is explicitly a list.
- Plain words. Address the patient as "you". Short sentences.
- Never diagnose, never name a medication, never promise an outcome.`;

const CLINICAL_VOICE = `You are the reasoning engine inside TicTrack, a CBIT (Comprehensive Behavioral Intervention for Tics) self-management app.

${CBIT_BACKGROUND}

${HOUSE_STYLE}`;

const REGION_LIST = REGIONS.join(', ');

/** Onboarding step 1: turn free narration into a structured list of tics. */
export async function extractTics(motor: string, vocal: string): Promise<ExtractedTics> {
  if (!hasLLM() || (!motor.trim() && !vocal.trim())) {
    return extractTicsLocally(motor, vocal);
  }
  try {
    const extracted = await streamJson(ExtractedTics, {
      messages: [
        { role: 'system', content: CLINICAL_VOICE },
        {
          role: 'user',
          content: `A user described their tics out loud. The text below is a raw speech-to-text transcript, so expect run-on sentences, filler words and recognition errors — read through them.

Split the description into distinct tics. One tic per distinct movement or sound; do not merge two different body parts into one entry, and do not invent tics that were not described.

Motor tics, in their words:
"""${motor || '(nothing said)'}"""

Vocal tics, in their words:
"""${vocal || '(nothing said)'}"""

Return JSON: {"tics":[{"name","kind","region","description"}]}
- "name": two or three words, no first person. No "I", "my", or "uncontrollably". When the description fits, copy one of these names exactly: ${SUGGESTED_TIC_NAMES.join(', ')}. Otherwise use a gerund plus the body part, such as "Swinging arms" or "Biting lips".
- "Clearing throat" is only for throat clearing. Shouting, yelling, or screaming is "Shouting", never "Clearing throat".
- "kind": "motor" or "vocal".
- "region": exactly one of ${REGION_LIST}. Every vocal tic uses "voice".
- "description": one plain sentence describing what happens, which may keep the user's words.
Return at most 8 tics.`,
        },
      ],
      maxTokens: 1200,
    });
    return {
      tics: extracted.tics.map((tic) => {
        const labeled = labelTic(`${tic.description} ${tic.name}`, {
          kind: tic.kind,
          region: tic.region,
        });
        return { ...tic, region: labeled.region, name: labeled.name };
      }),
    };
  } catch {
    return extractTicsLocally(motor, vocal);
  }
}

/**
 * Match each tic to competing responses from the library.
 * The choice is about the movement or sound, not how practiced the person is.
 */
export async function matchBlockers(
  tics: Pick<Tic, 'name' | 'kind' | 'region' | 'description'>[],
): Promise<BlockerMatches> {
  if (!hasLLM() || tics.length === 0) return matchBlockersLocally(tics);
  const library = BLOCKERS.map(
    (b) =>
      `- ${b.id} | ${b.name} | for ${b.kinds.join('/')} tics of the ${b.regions.join('/')}
    does: ${b.instructions}
    mechanism: ${b.rationale}`,
  ).join('\n');

  try {
    const result = await streamJson(BlockerMatches, {
      messages: [
        { role: 'system', content: CLINICAL_VOICE },
        {
          role: 'user',
          content: `Pick competing responses ("blockers") for each tic below. You may ONLY use ids from this library — never invent one.

Library:
${library}

Tics:
${tics.map((t, i) => `${i + 1}. ${t.name} — ${t.kind} tic of the ${t.region}: ${t.description}`).join('\n')}

Judge each candidate against the three HRT criteria: physically incompatible with that specific movement or sound, holdable for a full minute, and inconspicuous enough to use in class or at work. Incompatibility is the one that matters most — a response that merely distracts is the wrong answer. Reserve progressive-relaxation for cases with no single localised tic to oppose. When two fit equally well, put the one that opposes this specific tic more directly first.

Return JSON: {"matches":[{"ticIndex","ticName","blockerIds":["id","id","id"],"reason"}]}
One entry per tic, in the same order. "ticIndex" is the number above; "ticName" is that tic's name copied exactly, with nothing appended. 2-3 ids each, best first. "reason" is one sentence on why the first id suits this tic.`,
        },
      ],
      maxTokens: 1600,
    });

    // Drop anything hallucinated, then backfill from the local matcher.
    const valid = new Set(BLOCKERS.map((b) => b.id));
    const local = matchBlockersLocally(tics);
    return {
      matches: tics.map((tic, index) => {
        // Prefer the index; models routinely decorate the echoed name.
        const match =
          result.matches.find((m) => m.ticIndex === index + 1) ??
          result.matches.find((m) => normalise(m.ticName) === normalise(tic.name)) ??
          result.matches[index];
        const ids = (match?.blockerIds ?? []).filter((id) => valid.has(id));
        const fallback = local.matches.find((m) => m.ticName === tic.name);
        return {
          ticName: tic.name,
          blockerIds: ids.length ? ids : (fallback?.blockerIds ?? [BLOCKERS[0].id]),
          reason: (ids.length && match?.reason) || fallback?.reason || '',
        };
      }),
    };
  } catch {
    return matchBlockersLocally(tics);
  }
}

const blockerName = (id: string | null) =>
  (id && BLOCKERS.find((b) => b.id === id)?.name) || 'none';

/** Models echo names back decorated — strip anything after the first bracket. */
const normalise = (name: string) =>
  name.toLowerCase().replace(/[([].*$/, '').replace(/[^a-z0-9 ]/g, '').trim();

function snapshot(data: AppData): string {
  const recent = data.checkIns.slice(-21);
  const ticName = (id: string) => data.tics.find((t) => t.id === id)?.name ?? id;

  const lines = recent.map((c) => {
    const per = c.entries.map((e) => `${ticName(e.ticId)} sev ${e.severity} urge ${e.urge}`).join('; ');
    const factors = c.factors.map((f) => FACTOR_LABELS[f]).join(', ') || 'nothing logged';
    const practice = c.practiced
      ? `practiced ${blockerName(c.blockerId)} for ${Math.round(c.practiceSeconds)}s, rated ${c.blockerEffective === null ? 'unrated' : c.blockerEffective ? 'EFFECTIVE' : 'NOT effective'}`
      : 'no practice';
    const weekday = new Date(c.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
    return `${c.date} (${weekday}): ${per} | context: ${factors} | ${practice}`;
  });

  // Per-tic direction of travel, so the model does not have to derive it from
  // the daily rows and get the arithmetic wrong.
  const perTic = data.tics.map((tic) => {
    const series = severitySeries(data, tic.id);
    const first = series[0]?.value;
    const last = series[series.length - 1]?.value;
    const peak = series.length ? Math.max(...series.map((p) => p.value)) : tic.severity;
    const move =
      series.length > 1
        ? `${first!.toFixed(1)} -> ${last!.toFixed(1)} (peak ${peak.toFixed(1)})`
        : 'only one data point';
    return `- ${tic.name} (${tic.kind}, ${tic.region}): now ${tic.severity}/5, urge ${tic.urge}/5, over the tracked period ${move}. Blockers tried and rejected: ${tic.retiredBlockerIds.map(blockerName).join(', ') || 'none'}. Currently using: ${blockerName(tic.blockerIds.find((id) => !tic.retiredBlockerIds.includes(id)) ?? null)}`;
  });

  const rated = data.checkIns.filter((c) => c.blockerEffective !== null);
  const effective = rated.filter((c) => c.blockerEffective).length;
  const factors = factorCorrelation(data)
    .map((f) => `${f.label}: logged on ${f.days} days, average severity ${f.delta.toFixed(1)} higher on those days`)
    .join('; ');

  const demographics = demographicContext(
    data.profile?.age ?? null,
    data.profile?.gender ?? 'unspecified',
  );

  return `${demographics ? demographics + '\n' : ''}Tics being tracked:
${perTic.join('\n') || '- none'}

Current target: ${data.tics.find((t) => t.id === data.targetTicId)?.name ?? 'none'} (worked on for ${data.targetStreakDays} days)
Overall trend across all check-ins: ${severityTrend(data)}
Check-in streak: ${currentStreak(data)} days; ${data.checkIns.length} check-ins total
Practice completed on ${data.checkIns.filter((c) => c.practiced).length} of ${data.checkIns.length} days; rated effective on ${effective} of ${rated.length} rated sessions
Context correlations found so far: ${factors || 'none strong enough yet'}

How they described their tics in their own words at sign-up:
motor: "${(data.motorNarrative || 'nothing said').slice(0, 400)}"
vocal: "${(data.vocalNarrative || 'nothing said').slice(0, 400)}"

Last ${recent.length} daily check-ins, oldest first:
${lines.join('\n') || '(no check-ins yet)'}`;
}

/** The Today screen's generated greeting, summary and suggestion. */
export async function dailyInsight(
  data: AppData,
  onDelta?: (full: string) => void,
): Promise<DailyInsight> {
  if (!hasLLM()) return dailyInsightLocally(data);
  try {
    return await streamJson(DailyInsight, {
      messages: [
        { role: 'system', content: CLINICAL_VOICE },
        {
          role: 'user',
          content: `Here is ${data.profile?.displayName ?? 'the user'}'s tracking data.

${snapshot(data)}

Write their home screen for today. Return JSON: {"greeting","summary","advice"}
- "greeting": one warm sentence, at most 15 words, using their first name.
- "summary": at most two short sentences, under 35 words in total. It sits at the top of the home screen, so length costs the user space. Quote one real number from the data. If there is not enough data, say so plainly rather than inventing a trend.
- "advice": one short sentence, under 20 words, naming one concrete thing to do today, tied to something visible in the data above.
No bullet points, no headings.`,
        },
      ],
      onDelta: onDelta ? (_, full) => onDelta(full) : undefined,
      maxTokens: 900,
    });
  } catch {
    return dailyInsightLocally(data);
  }
}

/** The full report — the one a health care provider would read. */
export async function progressReport(
  data: AppData,
  onDelta?: (full: string) => void,
): Promise<ProgressReport> {
  if (!hasLLM() || data.checkIns.length === 0) return progressReportLocally(data);
  try {
    return await streamJson(ProgressReport, {
      messages: [
        { role: 'system', content: CLINICAL_VOICE },
        {
          role: 'user',
          content: `Write a progress report on this CBIT tracking data.

Two people read this report. The patient reads it on their phone, and they may be a teenager. Their clinician reads it before a visit and has about ninety seconds. Write once, for both: plain enough that a 14-year-old follows every sentence, specific enough that a clinician can act on it without opening the app.

${snapshot(data)}

Rules that matter more than style:
- Every claim comes from the numbers above. If the data does not support something, leave it out. Never estimate, never round in a flattering direction, and never describe a trend you cannot point at.
- The daily rows below cover the last three weeks. The per-tic lines above them give the movement across the whole tracked period, which is where a claim about six or ten weeks has to come from.
- Always say how long and how much. "Throat clearing fell from 5 to 3 over six weeks" is useful. "Throat clearing improved" is not.
- Name the tic you are talking about. The patient has several.
- Fewer than ten check-ins is not enough for a trend. Say that plainly and report what the days do show.
- A flat stretch after a drop is normal in CBIT and worth saying so, because it is the point most patients read as failure and stop.
- Explain any term the first time it appears. "Competing response" and "premonitory urge" both need a half-sentence gloss.

Return JSON: {"headline","trend","observations","triggers","nextSteps"}
- "headline": one sentence a clinician could read alone and know where this patient stands. Lead with the direction of travel and the tic it applies to.
- "trend": copy the value given above as "Overall trend across all check-ins". Do not recompute it from the daily rows. The History screen shows the patient that same value, and a report that disagrees with it reads as one of the two being wrong.
- "observations": a JSON array of 4 or 5 strings. One sentence per element, never one long paragraph. Each element carries at least one real number from the data, and each says something the others do not. Cover, in this order where the data allows: the target tic and how far it moved, the other tics, how consistent the check-ins have been, and how the practice itself has been going, including any competing response that was rated ineffective and dropped.
- "triggers": a JSON array of strings, one factor per element, each with how much worse and on how many days. Empty array if nothing separates from the rest. Do not list a factor logged fewer than three times.
- "nextSteps": a JSON array of 2 or 3 strings, one step per element. Each names a specific action, the tic or situation it applies to, and why the data suggests it. No step may be a restatement of "keep going".`,
        },
      ],
      onDelta: onDelta ? (_, full) => onDelta(full) : undefined,
      // Reasoning mode measured worse here, not better: its length varies enough
      // (8k-22k characters on the same prompt) that it regularly consumed the
      // whole token budget and returned nothing, at 45-70s a go. The clinical
      // background in the system prompt does that work far more cheaply — this
      // call now finishes in about six seconds.
      think: false,
      maxTokens: 2600,
    });
  } catch {
    return progressReportLocally(data);
  }
}

/** Short streamed encouragement after a practice session. */
export async function practiceFeedback(
  ticName: string,
  blockerName: string,
  effective: boolean,
  onDelta: (full: string) => void,
  data?: AppData,
): Promise<string> {
  const local = effective
    ? `Good. ${blockerName} is doing its job on ${ticName.toLowerCase()}. Keep using it and we will keep this as your target.`
    : `That is useful to know. A competing response that does not land usually means the timing is off or the movement is too close to the tic, so we will try a different one tomorrow.`;
  if (!hasLLM()) {
    onDelta(local);
    return local;
  }
  try {
    return await streamChat({
      messages: [
        { role: 'system', content: CLINICAL_VOICE },
        {
          role: 'user',
          content: `The user just practiced "${blockerName}" for the tic "${ticName}" and rated it ${effective ? 'effective' : 'not effective'}.
${data ? `\nTheir data so far:\n${snapshot(data)}\n` : ''}
Reply with two or three sentences: acknowledge what just happened, ground it in one real number from their data if there is one, and say what happens next. ${effective ? '' : 'An ineffective rating usually means the response was started after the tic rather than at the urge, or was not truly incompatible with the movement — say which is worth checking, without blaming them. '}No greeting, no sign-off, no bullet points.`,
        },
      ],
      onDelta: (_, full) => onDelta(full),
      maxTokens: 300,
      temperature: 0.7,
    });
  } catch {
    onDelta(local);
    return local;
  }
}

/** The in-app assistant's name, used in its prompt and on screen. */
export const ASSISTANT_NAME = 'Doctor Kit';

const OFFLINE_ASSISTANT =
  `${ASSISTANT_NAME} is offline on this device, so this is a standing note rather than a personal reply. A competing response uses the same muscles as the tic in a way that makes the tic hard to do, and you hold it until the urge eases. That is different from clamping the tic in. If one tic is getting in the way today, rate it at check-in and practice the blocker for the tic you are working on.`;

/**
 * Chat reply from Doctor Kit, the in-app assistant.
 *
 * Available to every patient, including one who has a clinician linked: the
 * clinician answers in hours or days, and a question about how to hold a
 * competing response is worth answering now. It says what it is on every screen
 * it appears on, and the prompt below holds the same line.
 */
export async function replyToPatient(data: AppData, history: AssistantMessage[]): Promise<string> {
  const recent = history.slice(-12);
  if (!hasLLM() || recent.length === 0) return OFFLINE_ASSISTANT;
  try {
    const reply = await streamChat({
      messages: [
        {
          role: 'system',
          content: `${CLINICAL_VOICE}

You are ${ASSISTANT_NAME}, the assistant inside TicTrack, chatting with the person using the app.

You are software. You are not a clinician, you never diagnose, you never mention a medication, and you never promise that tics will stop. Say so plainly if they ask you to do any of it.
If the patient has a clinician linked, questions about medication, diagnosis, school accommodations, or anything changing in their treatment go to that clinician. Say which one it is if their name appears in the data below, and answer whatever part you can in the meantime.
If they describe danger to themselves or someone else, tell them to contact local emergency services or a clinician in person, and say nothing else.

What you are good for: what a competing response is and how to hold one, what the premonitory urge is, what their own numbers in this app are showing, and what to expect from CBIT over weeks.
Keep each reply to a short paragraph, two at the most. Plain language. No bullet points, no sign-off, no greeting after the first message.
Their tracking data, when you need a number:
${snapshot(data) || '(no check-ins yet)'}`,
        },
        ...recent.map((message) => ({
          role: message.role,
          content: message.text,
        })),
      ],
      maxTokens: 400,
      temperature: 0.7,
    });
    return reply.trim() || OFFLINE_ASSISTANT;
  } catch {
    return OFFLINE_ASSISTANT;
  }
}

export { averageSeverity, severitySeries };
