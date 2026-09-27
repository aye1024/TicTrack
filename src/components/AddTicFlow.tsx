import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Divider } from './ui';
import { SeverityScale } from './SeverityScale';
import { VoiceInput } from './VoiceInput';
import { FadeInUp } from './motion';
import { useApp } from '../store/AppStore';
import { extractTics, matchBlockers } from '../llm/tasks';
import { pickTargetTic } from '../logic/targeting';
import type { BodyRegion, Tic, TicKind } from '../types';
import { colors, radius, spacing, type } from '../theme';

type Phase = 'idle' | 'describe' | 'loading' | 'rate';

function blankTic(kind: TicKind): Tic {
  return {
    id: `t_${Date.now().toString(36)}`,
    name: '',
    kind,
    region: kind === 'vocal' ? 'voice' : 'head',
    description: '',
    severity: 3,
    urge: 3,
    blockerIds: [],
    retiredBlockerIds: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * The same describe-then-rate path as onboarding, for tics noticed after setup.
 * New tics are appended; the current target stays put unless there isn't one.
 */
export function AddTicFlow() {
  const { update } = useApp();
  const [phase, setPhase] = useState<Phase>('idle');
  const [kind, setKind] = useState<TicKind>('motor');
  const [narrative, setNarrative] = useState('');
  const [tics, setTics] = useState<Tic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPhase('idle');
    setNarrative('');
    setTics([]);
    setError(null);
    setSaving(false);
  };

  const start = (next: TicKind) => {
    setKind(next);
    setNarrative('');
    setPhase('describe');
  };

  const extract = async () => {
    setPhase('loading');
    setError(null);
    const motorText = kind === 'motor' ? narrative : '';
    const vocalText = kind === 'vocal' ? narrative : '';
    try {
      const result = await extractTics(motorText, vocalText);
      setTics(
        result.tics.map((t, i) => ({
          id: `t_${Date.now().toString(36)}_${i}`,
          name: t.name,
          kind,
          region: (kind === 'vocal' ? 'voice' : t.region === 'voice' ? 'head' : t.region) as BodyRegion,
          description: t.description,
          severity: 3,
          urge: 3,
          blockerIds: [],
          retiredBlockerIds: [],
          createdAt: new Date().toISOString(),
        })),
      );
    } catch {
      setTics([]);
      setError('We could not read that back. Add your tics by hand below.');
    } finally {
      setPhase('rate');
    }
  };

  const patch = (id: string, changes: Partial<Tic>) =>
    setTics((current) => current.map((t) => (t.id === id ? { ...t, ...changes } : t)));

  const remove = (id: string) => setTics((current) => current.filter((t) => t.id !== id));

  const save = async () => {
    const cleaned = tics
      .filter((t) => t.name.trim().length > 0)
      .map((t) => ({ ...t, name: t.name.trim() }));
    if (cleaned.length === 0) return;
    setSaving(true);
    try {
      const matched = await matchBlockers(cleaned);
      update((draft) => {
        cleaned.forEach((tic, index) => {
          draft.tics.push({
            ...tic,
            blockerIds: matched.matches[index]?.blockerIds ?? [],
          });
        });
        if (!draft.targetTicId) {
          draft.targetTicId = pickTargetTic(draft.tics)?.id ?? null;
        }
      });
      reset();
    } catch {
      setSaving(false);
      setError('Those could not be saved. Try again.');
    }
  };

  if (phase === 'idle') {
    return (
      <View style={{ gap: spacing(1.25) }}>
        <Button title="Add a motor tic" variant="secondary" onPress={() => start('motor')} />
        <Button title="Add a vocal tic" variant="secondary" onPress={() => start('vocal')} />
      </View>
    );
  }

  if (phase === 'loading' || saving) {
    return (
      <Card style={s.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[type.h3, { marginTop: spacing(1.5) }]}>
          {saving ? 'Saving…' : 'Reading what you told us…'}
        </Text>
        <Text style={[type.muted, { textAlign: 'center', marginTop: spacing(0.5) }]}>
          {saving
            ? 'Matching a blocker for each new tic.'
            : 'Splitting your description into separate tics so each one can be tracked on its own.'}
        </Text>
      </Card>
    );
  }

  const isMotor = kind === 'motor';

  if (phase === 'describe') {
    return (
      <View style={{ gap: spacing(2) }}>
        <Text style={type.h2}>{isMotor ? 'Describe your motor tics' : 'Describe your vocal tics'}</Text>
        <Text style={type.muted}>
          {isMotor
            ? 'Movements you make: blinking, head jerks, shrugging, anything your body does on its own. Say it the way you would tell a friend. Nothing needs to be medical.'
            : 'Sounds you make: throat clearing, sniffing, coughing, humming, words.'}
        </Text>
        <VoiceInput
          value={narrative}
          onChange={setNarrative}
          placeholder={
            isMotor
              ? 'e.g. I blink really hard a lot, and sometimes my head snaps to the left…'
              : 'e.g. I clear my throat over and over, especially when I am tired…'
          }
          minHeight={170}
        />
        <Card style={s.hint}>
          <Text style={type.label}>WHAT HELPS</Text>
          <Text style={[type.muted, { marginTop: spacing(0.75) }]}>
            Mention where in your body it happens and roughly how often. You can list several, and we
            will split them into separate tics on the next screen, and you can fix anything we get
            wrong. These are added alongside the tics you already track.
          </Text>
        </Card>
        <Button
          title="Continue"
          onPress={() => void extract()}
          disabled={narrative.trim().length === 0}
        />
        <Button title="Cancel" variant="ghost" onPress={reset} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing(2) }}>
      <Text style={type.h2}>How much does each one affect you?</Text>
      <Text style={type.muted}>
        Rate how much the tic gets in the way of your day. How noticeable it looks to other
        people is a separate thing, and it is not what this number is for.
      </Text>
      {error && <Text style={[type.muted, { color: colors.danger }]}>{error}</Text>}

      {tics.map((tic, index) => (
        <FadeInUp key={tic.id} index={index}>
          <Card>
            <View style={s.cardHead}>
              <View style={s.badge}>
                <Text style={s.badgeText}>{tic.kind === 'vocal' ? 'VOCAL' : 'MOTOR'}</Text>
              </View>
              <Text style={type.small}>{tic.region}</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => remove(tic.id)} hitSlop={10}>
                <Text style={s.remove}>Remove</Text>
              </Pressable>
            </View>
            <TextInput
              style={s.nameInput}
              value={tic.name}
              onChangeText={(name) => patch(tic.id, { name })}
              placeholder={`Tic ${index + 1}: what do you call it?`}
              placeholderTextColor={colors.textFaint}
            />
            {tic.description ? <Text style={type.muted}>{tic.description}</Text> : null}
            <Divider />
            <Text style={[type.label, { marginBottom: spacing(1) }]}>
              HOW MUCH IT INTERFERES WITH YOUR DAY
            </Text>
            <SeverityScale value={tic.severity} onChange={(severity) => patch(tic.id, { severity })} />
            <View style={{ height: spacing(2) }} />
            <Text style={[type.label, { marginBottom: spacing(1) }]}>
              THE FEELING JUST BEFORE IT HAPPENS
            </Text>
            <SeverityScale value={tic.urge} kind="urge" onChange={(urge) => patch(tic.id, { urge })} />
          </Card>
        </FadeInUp>
      ))}

      <Button title="Add another tic" variant="secondary" onPress={() => setTics((current) => [...current, blankTic(kind)])} />
      <Button
        title="Save tics"
        onPress={() => void save()}
        disabled={tics.filter((t) => t.name.trim()).length === 0}
      />
      <Button title="Cancel" variant="ghost" onPress={reset} />
    </View>
  );
}

const s = StyleSheet.create({
  loading: { alignItems: 'center', paddingVertical: spacing(4) },
  hint: { backgroundColor: colors.primarySoft, borderColor: 'transparent' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), marginBottom: spacing(1) },
  badge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing(1),
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.accent, letterSpacing: 0.8 },
  remove: { ...type.small, color: colors.danger, fontWeight: '600' },
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: spacing(0.5),
  },
});
