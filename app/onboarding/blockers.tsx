import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen, ScreenWithFooter } from '../../src/components/ui';
import { Stepper } from '../../src/components/Stepper';
import { OnboardingContent } from '../../src/components/OnboardingMotion';
import { useApp } from '../../src/store/AppStore';
import { matchBlockers } from '../../src/llm/tasks';
import { blockerById } from '../../src/data/blockers';
import { pickTargetTic } from '../../src/logic/targeting';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * The last onboarding step. Each tic is matched to a competing response that
 * uses the same muscles, so the two cannot happen at the same time.
 */
export default function Blockers() {
  const router = useRouter();
  const { data, update } = useApp();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await matchBlockers(data.tics);
      if (cancelled) return;
      update((draft) => {
        for (const [index, tic] of draft.tics.entries()) {
          const match = result.matches[index];
          if (match) tic.blockerIds = match.blockerIds;
        }
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // Runs once on entry; the tic list is fixed by this point.
  }, []);

  /** Rotate to the next candidate so the user can try another option. */
  const cycle = (ticId: string) =>
    update((draft) => {
      const tic = draft.tics.find((t) => t.id === ticId);
      if (tic && tic.blockerIds.length > 1) {
        tic.blockerIds = [...tic.blockerIds.slice(1), tic.blockerIds[0]];
      }
    });

  const finish = () => {
    update((draft) => {
      draft.targetTicId = pickTargetTic(draft.tics)?.id ?? null;
      draft.targetStreakDays = 0;
      draft.onboarded = true;
    });
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <Screen scroll={false} style={s.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[type.h3, { marginTop: spacing(2) }]}>Matching blockers…</Text>
        <Text style={[type.muted, { textAlign: 'center', marginTop: spacing(0.5) }]}>
          Finding a movement for each tic that uses the same muscles, so the two cannot happen at
          the same time.
        </Text>
      </Screen>
    );
  }

  const target = pickTargetTic(data.tics);

  return (
    <ScreenWithFooter footer={<Button title="Start tracking" onPress={finish} />}>
      <Stepper total={5} current={4} />
      <OnboardingContent>
        <Text style={type.h2}>Your blockers</Text>
        <Text style={type.muted}>
          One for each tic, chosen because it uses the same muscles. You will work on a single tic
          at a time. The rest still get tracked every day.
        </Text>

        {data.tics.map((tic) => {
          const blocker = blockerById(tic.blockerIds[0]);
          if (!blocker) return null;
          return (
            <Card key={tic.id}>
              <Text style={type.label}>{tic.name.toUpperCase()}</Text>
              <Text style={[type.h3, { marginTop: spacing(0.5) }]}>{blocker.name}</Text>

              <Text style={[type.body, { marginTop: spacing(1) }]}>{blocker.instructions}</Text>

              <View style={s.cue}>
                <View style={s.cueHead}>
                  <Ionicons name="pulse" size={14} color={colors.primary} />
                  <Text style={[type.small, { fontWeight: '700', color: colors.primary }]}>
                    START IT WHEN YOU FEEL
                  </Text>
                </View>
                <Text style={[type.muted, { marginTop: 4 }]}>{blocker.awarenessCue}</Text>
              </View>

              {tic.blockerIds.length > 1 && (
                <Pressable onPress={() => cycle(tic.id)} hitSlop={8}>
                  <Text style={s.swap}>Show me a different one →</Text>
                </Pressable>
              )}
            </Card>
          );
        })}

        {target && (
          <Card style={s.preview}>
            <Text style={type.label}>WE WILL START WITH</Text>
            <Text style={[type.h3, { marginTop: spacing(0.5) }]}>{target.name}</Text>
            <Text style={[type.muted, { marginTop: spacing(0.5) }]}>
              It scores highest on interference right now.
            </Text>
          </Card>
        )}

      </OnboardingContent>
    </ScreenWithFooter>
  );
}

const s = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center', padding: spacing(4) },
  cue: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing(1.5),
    marginTop: spacing(1.5),
  },
  cueHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swap: { ...type.muted, color: colors.primary, fontWeight: '600', marginTop: spacing(1.5) },
  preview: {
    backgroundColor: colors.accentSoft,
    borderColor: 'transparent',
    borderRadius: radius.lg,
  },
});
