import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Screen, ScreenWithFooter } from '../../src/components/ui';
import { useApp } from '../../src/store/AppStore';
import { clearDraft, getDraft, patchDraft } from '../../src/store/checkinDraft';
import { practiceFeedback } from '../../src/llm/tasks';
import { blockerById } from '../../src/data/blockers';
import { pickTargetTic } from '../../src/logic/targeting';
import { ticById } from '../../src/logic/analysis';
import { colors, radius, spacing, type } from '../../src/theme';

type Phase = 'ask' | 'feedback' | 'recover';

/**
 * The branch drawn at the bottom right of the whiteboard: rate the blocker,
 * and if it did not work, decide whether to change the blocker or the target.
 * A blocker rated ineffective is retired by the store, so it will not come back.
 */
export default function Result() {
  const router = useRouter();
  const { data, update, recordCheckIn } = useApp();
  const draft = getDraft();

  const tic = ticById(data, draft?.targetTicId ?? null);
  const blocker = blockerById(draft?.blockerId ?? '');
  const [phase, setPhase] = useState<Phase>(draft?.practiced ? 'ask' : 'feedback');
  const [effective, setEffective] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');

  // A skipped practice still gets logged; there is nothing to rate.
  useEffect(() => {
    if (!draft?.practiced) setMessage('Logged for today. Skipping a practice resets nothing. The check-in on its own is what keeps the trend readable.');
  }, [draft?.practiced]);

  const answer = async (value: boolean) => {
    setEffective(value);
    patchDraft({ blockerEffective: value });
    setPhase('feedback');
    setMessage('');
    await practiceFeedback(
      tic?.name ?? 'your tic',
      blocker?.name ?? 'the blocker',
      value,
      setMessage,
      data,
    );
    if (!value) setPhase('recover');
  };

  const commit = (after?: (targetChanged: boolean) => void) => {
    const current = getDraft();
    if (current) recordCheckIn(current);
    clearDraft();
    after?.(false);
    router.replace('/(tabs)');
  };

  /** "Try a different blocker" — rotate to the next candidate for the same tic. */
  const swapBlocker = () => {
    const current = getDraft();
    if (current) recordCheckIn(current);
    update((draft) => {
      const target = draft.tics.find((t) => t.id === current?.targetTicId);
      if (target) {
        const remaining = target.blockerIds.filter((id) => !target.retiredBlockerIds.includes(id));
        if (remaining.length === 0) target.retiredBlockerIds = [];
      }
    });
    clearDraft();
    router.replace('/(tabs)');
  };

  /** "Work on a different tic" — hand the target to the next best candidate. */
  const swapTarget = () => {
    const current = getDraft();
    if (current) recordCheckIn(current);
    update((draft) => {
      const others = draft.tics.filter((t) => t.id !== current?.targetTicId);
      const next = pickTargetTic(others);
      if (next) {
        draft.targetTicId = next.id;
        draft.targetStreakDays = 0;
      }
    });
    clearDraft();
    router.replace('/(tabs)');
  };

  if (!draft) {
    return (
      <Screen>
        <Card>
          <Text style={type.h3}>This check-in has already been saved</Text>
        </Card>
        <Button title="Back to today" onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  if (phase === 'ask') {
    return (
      <ScreenWithFooter
        footer={
          <>
            <Button title="Yes, it helped" onPress={() => answer(true)} />
            <Button title="No, it did not" variant="secondary" onPress={() => answer(false)} />
          </>
        }
      >
        <Text style={type.h2}>Was it effective?</Text>
        <Text style={type.muted}>
          Did {blocker?.name.toLowerCase() ?? 'the blocker'} actually take the edge off the urge? An
          honest no is more useful than a polite yes. It is how we pick the next one.
        </Text>
      </ScreenWithFooter>
    );
  }

  const nextTic = pickTargetTic(data.tics.filter((t) => t.id !== draft.targetTicId));

  return (
    <ScreenWithFooter
      footer={
        phase === 'recover' ? (
          <Button title="Leave it as it is" variant="ghost" onPress={() => commit()} />
        ) : (
          <Button title="Done for today" onPress={() => commit()} />
        )
      }
    >
      <Card style={effective === false ? s.neutralCard : s.goodCard}>
        <Text style={[type.h2, { color: effective === false ? colors.text : colors.accent }]}>
          {effective === null ? 'Saved' : effective ? 'Nice work' : 'Good to know'}
        </Text>
        <Text style={[type.body, { marginTop: spacing(1) }]}>
          {message || 'Writing that up…'}
        </Text>
      </Card>

      {phase === 'recover' ? (
        <>
          <Text style={[type.label, { marginTop: spacing(1) }]}>WHAT WOULD YOU LIKE TO DO?</Text>
          <Card onPress={swapBlocker}>
            <Text style={type.h3}>Try a different blocker</Text>
            <Text style={[type.muted, { marginTop: 4 }]}>
              Stay on {tic?.name ?? 'this tic'} and switch to the next competing response on your
              list. {blocker?.name} will not be suggested again.
            </Text>
          </Card>
          {nextTic && (
            <Card onPress={swapTarget}>
              <Text style={type.h3}>Work on a different tic</Text>
              <Text style={[type.muted, { marginTop: 4 }]}>
                Move the target to {nextTic.name}. {tic?.name ?? 'This tic'} keeps being tracked
                daily either way.
              </Text>
            </Card>
          )}
        </>
      ) : null}
    </ScreenWithFooter>
  );
}

const s = StyleSheet.create({
  goodCard: { backgroundColor: colors.accentSoft, borderColor: 'transparent', borderRadius: radius.lg },
  neutralCard: { backgroundColor: colors.surfaceAlt, borderColor: 'transparent', borderRadius: radius.lg },
});
