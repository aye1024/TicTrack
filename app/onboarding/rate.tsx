import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Divider, Screen, ScreenWithFooter } from '../../src/components/ui';
import { SeverityScale } from '../../src/components/SeverityScale';
import { Stepper } from '../../src/components/Stepper';
import { OnboardingContent } from '../../src/components/OnboardingMotion';
import { useApp } from '../../src/store/AppStore';
import { extractTics } from '../../src/llm/tasks';
import type { Tic } from '../../src/types';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * Step two. The team decided in review to drop the separate "did we understand
 * you?" confirmation page and go straight to rating — so correction lives here,
 * inline: every extracted tic can be renamed, removed, or added to while the
 * user is already rating it.
 */
export default function Rate() {
  const router = useRouter();
  const { data, setTics } = useApp();
  const [tics, setLocalTics] = useState<Tic[]>(() =>
    data.tics.map((tic) => ({ ...tic, severity: Math.max(1, Math.min(5, tic.severity)) })),
  );
  const [loading, setLoading] = useState(data.tics.length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data.tics.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await extractTics(data.motorNarrative, data.vocalNarrative);
        if (cancelled) return;
        setLocalTics(
          result.tics.map((t, i) => ({
            id: `t_${Date.now().toString(36)}_${i}`,
            name: t.name,
            kind: t.kind,
            region: t.region,
            description: t.description,
            severity: 3,
            urge: 3,
            blockerIds: [],
            retiredBlockerIds: [],
            createdAt: new Date().toISOString(),
          })),
        );
      } catch {
        if (!cancelled) setError('We could not read that back. Add your tics by hand below.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data.motorNarrative, data.vocalNarrative, data.tics.length]);

  const patch = (id: string, changes: Partial<Tic>) =>
    setLocalTics((current) => current.map((t) => (t.id === id ? { ...t, ...changes } : t)));

  const remove = (id: string) => setLocalTics((current) => current.filter((t) => t.id !== id));

  const addBlank = () =>
    setLocalTics((current) => [
      ...current,
      {
        id: `t_${Date.now().toString(36)}`,
        name: '',
        kind: 'motor',
        region: 'head',
        description: '',
        severity: 3,
        urge: 3,
        blockerIds: [],
        retiredBlockerIds: [],
        createdAt: new Date().toISOString(),
      },
    ]);

  const proceed = () => {
    const cleaned = tics
      .filter((t) => t.name.trim().length > 0)
      .map((t) => ({ ...t, name: t.name.trim() }));
    setTics(cleaned);
    router.push('/onboarding/blockers');
  };

  if (loading) {
    return (
      <Screen scroll={false} style={s.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[type.h3, { marginTop: spacing(2) }]}>Reading what you told us…</Text>
        <Text style={[type.muted, { textAlign: 'center', marginTop: spacing(0.5) }]}>
          Splitting your description into separate tics so each one can be tracked on its own.
        </Text>
      </Screen>
    );
  }

  return (
    <ScreenWithFooter
      footer={
        <>
          <Button
            title="Continue"
            onPress={proceed}
            disabled={tics.filter((t) => t.name.trim()).length === 0}
          />
          <Button title="Add another tic" variant="secondary" onPress={addBlank} />
        </>
      }
    >
      <Stepper total={5} current={3} />
      <OnboardingContent>
        <Text style={type.h2}>How much does each one affect you?</Text>
        <Text style={type.muted}>
          Rate how much each tic gets in the way, then the feeling that builds just before it.
          It is fine if you are unsure for now. Tap any name to edit it.
        </Text>
        {error && <Text style={[type.muted, { color: colors.danger }]}>{error}</Text>}

        {tics.map((tic, index) => (
          <Card key={tic.id}>
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
              accessibilityLabel={`Edit tic ${index + 1} name`}
              style={s.nameInput}
              value={tic.name}
              onChangeText={(name) => patch(tic.id, { name })}
              placeholder={`Tic ${index + 1}: what do you call it?`}
              placeholderTextColor={colors.textFaint}
            />

            <Divider />
            <Text style={[type.label, { marginBottom: spacing(1) }]}>
              HOW MUCH IT INTERFERES WITH YOUR DAY
            </Text>
            <SeverityScale
              min={1}
              max={5}
              endpointLabels={{ left: 'Barely noticed it', right: 'Greatly disruptive' }}
              value={tic.severity}
              onChange={(severity) => patch(tic.id, { severity })}
            />

            <View style={{ height: spacing(2) }} />
            <Text style={[type.label, { marginBottom: spacing(1) }]}>
              THE FEELING JUST BEFORE IT HAPPENS
            </Text>
            <SeverityScale
              value={tic.urge}
              kind="urge"
              endpointLabels={{ left: 'No feeling', right: 'Strong feeling' }}
              onChange={(urge) => patch(tic.id, { urge })}
            />
          </Card>
        ))}

      </OnboardingContent>
    </ScreenWithFooter>
  );
}

const s = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center', padding: spacing(4) },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    marginBottom: spacing(1),
  },
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
    paddingHorizontal: spacing(1),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
});
