import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, GradientCard, Screen } from '../../src/components/ui';
import { CountUp, FadeInUp, PressableScale } from '../../src/components/motion';
import { useApp } from '../../src/store/AppStore';
import { dailyInsight } from '../../src/llm/tasks';
import type { DailyInsight } from '../../src/llm/schemas';
import { blockerById } from '../../src/data/blockers';
import { activeBlockerFor } from '../../src/logic/targeting';
import { currentStreak, severitySeries, ticById, ticsBySeverity } from '../../src/logic/analysis';
import { pairedDevice, peakWindow, wearableDay } from '../../src/data/wearable';
import { TrendChart } from '../../src/components/TrendChart';
import { colors, radius, severityColor, spacing, type } from '../../src/theme';

export default function Today() {
  const router = useRouter();
  const { data, update, todayCheckIn } = useApp();
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [streamed, setStreamed] = useState('');
  const [loading, setLoading] = useState(false);
  const generatedFor = useRef<number>(-1);

  const target = ticById(data, data.targetTicId);
  const blocker = activeBlockerFor(target);
  const streak = currentStreak(data);
  const device = pairedDevice(data);
  const watchDay = device ? wearableDay(data) : null;

  /**
   * Regenerate the summary once per check-in count. A cached copy is kept in
   * the user document so reopening the app does not re-bill a request.
   */
  const load = useCallback(async () => {
    if (generatedFor.current === data.checkIns.length) return;
    const cached = data.insight;
    if (cached && cached.checkInCount === data.checkIns.length) {
      try {
        setInsight(JSON.parse(cached.text) as DailyInsight);
        generatedFor.current = data.checkIns.length;
        return;
      } catch {
        /* fall through and regenerate */
      }
    }
    generatedFor.current = data.checkIns.length;
    setLoading(true);
    setStreamed('');
    try {
      const result = await dailyInsight(data, (full) => setStreamed(full));
      setInsight(result);
      update((draft) => {
        draft.insight = {
          text: JSON.stringify(result),
          generatedAt: new Date().toISOString(),
          checkInCount: draft.checkIns.length,
        };
      });
    } finally {
      setLoading(false);
      setStreamed('');
    }
  }, [data, update]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const firstName = data.profile?.displayName?.split(' ')[0] ?? 'there';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Screen>
        <FadeInUp>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={type.label}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Text>
            <Text style={[type.h1, { marginTop: spacing(0.5) }]}>
              {insight?.greeting ?? `Hi ${firstName}.`}
            </Text>
          </View>
          {streak > 0 && (
            <View style={s.streak}>
              <Ionicons name="flame" size={15} color={colors.accent} />
              <CountUp value={streak} style={s.streakNumber} />
              <Text style={s.streakLabel}>day{streak === 1 ? '' : 's'}</Text>
            </View>
          )}
        </View>
        </FadeInUp>

        {/* The generated summary, streamed in as GLM writes it. */}
        <FadeInUp index={1}>
        <Card>
          <Text style={type.label}>WHERE YOU ARE</Text>
          {loading && !insight ? (
            <Text style={[type.body, s.streaming]} numberOfLines={SUMMARY_LINES}>
              {streamed ? stripJson(streamed) : 'Looking over your check-ins…'}
            </Text>
          ) : (
            <>
              <Clamped
                text={insight?.summary ?? 'Your first check-in will set the baseline.'}
              />
              {insight?.advice ? (
                <View style={s.advice}>
                  <Text style={[type.small, { fontWeight: '700', color: colors.accent }]}>TODAY</Text>
                  <Text style={[type.body, { marginTop: 4 }]} numberOfLines={3}>
                    {insight.advice}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </Card>
        </FadeInUp>

        {/* Daily check-in call to action, the spine of the whole app. */}
        <FadeInUp index={2}>
        {todayCheckIn ? (
          <Card style={s.doneCard}>
            <Text style={[type.h3, { color: colors.accent }]}>Today's check-in is done</Text>
            <Text style={[type.muted, { marginTop: spacing(0.5) }]}>
              {todayCheckIn.practiced
                ? `You practiced ${blockerById(todayCheckIn.blockerId ?? '')?.name ?? 'your blocker'} and rated it ${todayCheckIn.blockerEffective ? 'effective' : 'not effective'}.`
                : 'You logged your tics but skipped practice. There is still time if you want it.'}
            </Text>
            <View style={{ height: spacing(1.5) }} />
            <Button
              title={todayCheckIn.practiced ? 'Redo today' : 'Practice now'}
              variant="secondary"
              onPress={() => router.push('/checkin')}
            />
          </Card>
        ) : (
          <GradientCard onPress={() => router.push('/checkin')}>
            <View style={s.ctaRow}>
              <View style={{ flex: 1 }}>
                <Text style={[type.h2, { color: colors.white }]}>Daily check-in</Text>
                <Text style={[type.body, { color: 'rgba(255,255,255,0.88)', marginTop: spacing(0.5) }]}>
                  Rate your tics, then hold one competing response. Under two minutes.
                </Text>
              </View>
              <View style={s.ctaArrow}>
                <Ionicons name="arrow-forward" size={22} color={colors.primary} />
              </View>
            </View>
          </GradientCard>
        )}
        </FadeInUp>

        {/* Current target */}
        {target && (
          <FadeInUp index={3}>
          <Card onPress={() => router.push(`/tic/${target.id}`)}>
            <View style={s.rowBetween}>
              <Text style={type.label}>TARGETED TIC</Text>
              <Text style={[type.small, { color: colors.primary, fontWeight: '600' }]}>
                {data.targetStreakDays > 0 ? `Day ${data.targetStreakDays}` : 'New'}
              </Text>
            </View>
            <Text style={[type.h3, { marginTop: spacing(0.75) }]}>{target.name}</Text>
            <View style={s.blockerRow}>
              <Ionicons name="shield-checkmark-outline" size={15} color={colors.textMuted} />
              <Text style={type.muted}>{blocker?.name ?? 'Not set'}</Text>
            </View>
          </Card>
          </FadeInUp>
        )}

        {/* What the wearable counted between check-ins, or an offer to pair one. */}
        <FadeInUp index={4}>
          {watchDay && device ? (
            <Card onPress={() => router.push('/watch')}>
              <View style={s.rowBetween}>
                <Text style={type.label}>{device.name.toUpperCase()}</Text>
                <Text style={[type.small, { color: colors.primary, fontWeight: '600' }]}>
                  {watchDay.partial ? 'TODAY SO FAR' : 'TODAY'}
                </Text>
              </View>
              <Text style={[type.h3, { marginTop: spacing(0.75) }]}>
                {watchDay.total} tic{watchDay.total === 1 ? '' : 's'} counted
              </Text>
              <View style={s.blockerRow}>
                <Ionicons name="pulse-outline" size={15} color={colors.textMuted} />
                <Text style={[type.muted, { flex: 1 }]}>
                  {peakWindow(watchDay.hours)
                    ? `Heaviest ${peakWindow(watchDay.hours)}`
                    : 'Nothing counted yet'}
                  {watchDay.detections[0]
                    ? ` · mostly ${watchDay.detections[0].name.toLowerCase()}`
                    : ''}
                </Text>
              </View>
            </Card>
          ) : (
            <Card onPress={() => router.push('/watch')}>
              <View style={s.rowBetween}>
                <Text style={type.label}>WEARABLE</Text>
                <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
              </View>
              <Text style={[type.h3, { marginTop: spacing(0.75) }]}>Pair a device</Text>
              <View style={s.blockerRow}>
                <Ionicons name="watch-outline" size={15} color={colors.textMuted} />
                <Text style={[type.muted, { flex: 1 }]}>
                  Let a watch, a ring or your AirPods count the tics between check-ins.
                </Text>
              </View>
            </Card>
          )}
        </FadeInUp>

        {/* All tics, coloured by severity */}
        <FadeInUp index={5}>
        <Text style={[type.label, { marginTop: spacing(1) }]}>YOUR TICS</Text>
        <Card style={{ paddingVertical: spacing(1), marginTop: spacing(1) }}>
          {ticsBySeverity(data).map((tic, i) => (
            <PressableScale
              key={tic.id}
              onPress={() => router.push(`/tic/${tic.id}`)}
              style={[s.ticRow, i > 0 && s.ticRowBorder] as never}
              scaleTo={0.99}
            >
              <View style={[s.severityChip, { backgroundColor: severityColor(tic.severity) }]}>
                <Text style={s.severityChipText}>{tic.severity}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{tic.name}</Text>
                <Text style={type.small}>
                  {tic.kind === 'vocal' ? 'Vocal' : 'Motor'} · {tic.region[0].toUpperCase()}{tic.region.slice(1)} · urge {tic.urge}/5
                </Text>
              </View>
              {tic.id === data.targetTicId && (
                <View style={s.targetTag}>
                  <Text style={s.targetTagText}>TARGET</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
            </PressableScale>
          ))}
        </Card>
        </FadeInUp>

        {/* History preview, as sketched: scroll down and the trend is there. */}
        <FadeInUp index={6}>
        <Text style={[type.label, { marginTop: spacing(1) }]}>SEVERITY OVER TIME</Text>
        <Card style={{ marginTop: spacing(1) }}>
          <TrendChart series={severitySeries(data)} width={290} />
        </Card>
        </FadeInUp>
      </Screen>
    </SafeAreaView>
  );
}

/** While the JSON is still arriving, show the prose without the braces. */
function stripJson(raw: string): string {
  const summary = raw.match(/"summary"\s*:\s*"([^"]*)/);
  if (summary) return summary[1];
  const greeting = raw.match(/"greeting"\s*:\s*"([^"]*)/);
  if (greeting) return greeting[1];
  return 'Looking over your check-ins…';
}

/**
 * The summary is generated, so its length is not fully ours to decide. The
 * prompt asks for two short sentences and the local fallback writes two, but a
 * model that runs long would otherwise push the check-in button — the thing the
 * user opened the app for — off the first screen.
 *
 * Clamping rather than scrolling: this card already sits inside the `Screen`
 * ScrollView, and a scroll view nested in another one competes for the same
 * vertical drag.
 */
const SUMMARY_LINES = 3;

/**
 * Whether to offer the toggle is decided from the character count rather than
 * from `onTextLayout`: while the text is clamped, the layout event only reports
 * the lines it was allowed to draw, so it cannot say whether more existed. The
 * threshold is about three lines at this width, and being a line out either way
 * only ever shows or hides a "More" the text does not need.
 */
const CLAMP_AFTER = 150;

function Clamped({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > CLAMP_AFTER;

  return (
    <>
      <Text
        style={[type.body, { marginTop: spacing(1) }]}
        numberOfLines={long && !expanded ? SUMMARY_LINES : undefined}
      >
        {text}
      </Text>
      {long && (
        <Text
          style={s.more}
          onPress={() => setExpanded((open) => !open)}
          suppressHighlighting
        >
          {expanded ? 'Less' : 'More'}
        </Text>
      )}
    </>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1.5) },
  streak: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    alignItems: 'center',
    minWidth: 64,
  },
  streakNumber: { fontSize: 24, fontWeight: '800', color: colors.accent },
  streakLabel: { fontSize: 11, fontWeight: '600', color: colors.accent },
  more: { ...type.muted, fontWeight: '700', color: colors.primary, marginTop: spacing(0.75) },
  streaming: { marginTop: spacing(1), color: colors.textMuted, fontStyle: 'italic' },
  advice: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing(1.5),
    marginTop: spacing(1.5),
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  ctaArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing(0.75) },
  doneCard: { backgroundColor: colors.accentSoft, borderColor: 'transparent' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingVertical: spacing(1.5),
  },
  ticRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  severityChip: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityChipText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  targetTag: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing(1),
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  targetTagText: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.6 },
});
