import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Divider, ScreenWithFooter } from '../../src/components/ui';
import { SeverityScale } from '../../src/components/SeverityScale';
import { FadeInUp } from '../../src/components/motion';
import { useApp } from '../../src/store/AppStore';
import { setDraft } from '../../src/store/checkinDraft';
import { activeBlockerFor } from '../../src/logic/targeting';
import { FACTOR_LABELS, ticById } from '../../src/logic/analysis';
import { hourLabel, pairedDevice, wearableDay } from '../../src/data/wearable';
import type { ContextFactor } from '../../src/types';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * The daily cycle: rate every tic, note what today was like, then go practice.
 * Sliders are pre-filled with yesterday's answers so an unchanged day takes two
 * taps. That pre-fill is the whole reason the check-in gets done daily.
 */
export default function CheckIn() {
  const router = useRouter();
  const { data, todayCheckIn } = useApp();
  // Arriving from the wearable screen means "use what the device counted"
  // rather than yesterday's answers.
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();

  const device = pairedDevice(data);
  const watched = useMemo(() => {
    if (!device) return new Map<string, { count: number; peakHour: number; suggested: number }>();
    const day = wearableDay(data);
    return new Map(
      day.detections.map((d) => [
        d.ticId,
        { count: d.count, peakHour: d.peakHour, suggested: d.suggestedSeverity },
      ]),
    );
  }, [data, device]);

  const previous = useMemo(() => {
    const source = todayCheckIn ?? data.checkIns[data.checkIns.length - 1];
    const map = new Map<string, { severity: number; urge: number }>();
    for (const entry of source?.entries ?? []) {
      map.set(entry.ticId, { severity: entry.severity, urge: entry.urge });
    }
    return map;
  }, [data.checkIns, todayCheckIn]);

  const [ratings, setRatings] = useState(() =>
    Object.fromEntries(
      data.tics.map((tic) => {
        const carried = previous.get(tic.id) ?? { severity: tic.severity, urge: tic.urge };
        const counted = prefill === 'wearable' ? watched.get(tic.id)?.suggested : undefined;
        return [
          tic.id,
          {
            severity: Math.max(1, counted ?? carried.severity),
            // The urge scale starts at 1; clamp anything stored under the old 0-5 scale.
            urge: Math.max(1, carried.urge),
          },
        ];
      }),
    ),
  );
  const [factors, setFactors] = useState<ContextFactor[]>(todayCheckIn?.factors ?? []);

  const target = ticById(data, data.targetTicId);
  const blocker = activeBlockerFor(target);

  const toggleFactor = (factor: ContextFactor) =>
    setFactors((current) =>
      current.includes(factor) ? current.filter((f) => f !== factor) : [...current, factor],
    );

  const next = () => {
    setDraft({
      entries: data.tics.map((tic) => ({
        ticId: tic.id,
        severity: ratings[tic.id]?.severity ?? tic.severity,
        urge: ratings[tic.id]?.urge ?? tic.urge,
      })),
      factors,
      targetTicId: target?.id ?? null,
      blockerId: blocker?.id ?? null,
      practiced: false,
      practiceSeconds: 0,
      blockerEffective: null,
      note: '',
    });
    router.push('/checkin/practice');
  };

  return (
    <ScreenWithFooter footer={<Button title="Continue to practice" onPress={next} />}>
      <Text style={type.h2}>How were your tics today?</Text>
      <Text style={type.muted}>
        {prefill === 'wearable' && device
          ? `Filled in from what your ${device.name} counted today. Change anything that does not match how the day felt. The device counts tics. Only you can say how much they got in the way.`
          : 'We have carried over your last answers. Change only what is different, so this stays quick.'}
      </Text>

      {data.tics.map((tic, index) => (
        <FadeInUp key={tic.id} index={index}>
        <Card>
          <Text style={type.h3}>{tic.name}</Text>
          <Text style={[type.small, { marginTop: 2 }]}>
            {tic.kind === 'vocal' ? 'Vocal' : 'Motor'} · {tic.region}
          </Text>

          <Divider />
          <Text style={[type.label, { marginBottom: spacing(1) }]}>SEVERITY TODAY</Text>
          <SeverityScale
            value={ratings[tic.id]?.severity ?? 3}
            onChange={(severity) =>
              setRatings((r) => ({ ...r, [tic.id]: { ...r[tic.id], severity } }))
            }
          />
          {/* What the device counted, offered rather than applied — the rating
              is about interference, which a sensor cannot measure. */}
          {watched.has(tic.id) && (
            <Text
              onPress={() =>
                setRatings((r) => ({
                  ...r,
                  [tic.id]: { ...r[tic.id], severity: watched.get(tic.id)!.suggested },
                }))
              }
              style={s.watchHint}
            >
              {device?.name} counted {watched.get(tic.id)!.count} today, mostly around{' '}
              {hourLabel(watched.get(tic.id)!.peakHour)} · tap for {watched.get(tic.id)!.suggested}
            </Text>
          )}

          <View style={{ height: spacing(2) }} />
          <Text style={[type.label, { marginBottom: spacing(1) }]}>URGE BEFOREHAND</Text>
          <SeverityScale
            value={ratings[tic.id]?.urge ?? 3}
            kind="urge"
            onChange={(urge) => setRatings((r) => ({ ...r, [tic.id]: { ...r[tic.id], urge } }))}
          />
        </Card>
        </FadeInUp>
      ))}

      <Text style={[type.label, { marginTop: spacing(1) }]}>WHAT WAS TODAY LIKE?</Text>
      <Card>
        <Text style={[type.muted, { marginBottom: spacing(1.5) }]}>
          Tap anything that applies. Over a couple of weeks this is what tells us which of these
          actually moves your numbers.
        </Text>
        <View style={s.factors}>
          {(Object.keys(FACTOR_LABELS) as ContextFactor[]).map((factor) => {
            const on = factors.includes(factor);
            return (
              <Text
                key={factor}
                onPress={() => toggleFactor(factor)}
                style={[s.factor, on && s.factorOn]}
              >
                {FACTOR_LABELS[factor]}
              </Text>
            );
          })}
        </View>
      </Card>

    </ScreenWithFooter>
  );
}

const s = StyleSheet.create({
  watchHint: {
    marginTop: spacing(1.25),
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    overflow: 'hidden',
    borderRadius: radius.md,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(1),
  },
  factors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  factor: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 14,
    overflow: 'hidden',
    paddingHorizontal: spacing(1.75),
    paddingVertical: spacing(1),
    borderRadius: radius.pill,
  },
  factorOn: { backgroundColor: colors.primary, color: colors.white },
});
