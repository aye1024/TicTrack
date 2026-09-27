import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen } from '../../src/components/ui';
import { Stepper } from '../../src/components/Stepper';
import { OnboardingContent } from '../../src/components/OnboardingMotion';
import { colors, radius, spacing, type } from '../../src/theme';

const POINTS = [
  {
    icon: 'eye-outline' as const,
    title: 'Notice it early',
    body: 'The tight, itchy, or building feeling just before the tic is your cue. You are not waiting for the tic to finish.',
  },
  {
    icon: 'hand-left-outline' as const,
    title: 'Do the other movement',
    body: 'That movement is a blocker. Hold it for about a minute, or until the urge fades, whichever is longer.',
  },
  {
    icon: 'leaf-outline' as const,
    title: 'You are not suppressing',
    body: 'Holding a tic in builds pressure. A blocker gives the urge somewhere else to go.',
  },
];

/** First onboarding step: what the treatment is, then the tic descriptions. */
export default function OnboardingWelcome() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: 'How CBIT works' }} />
      <Screen>
        <Stepper total={5} current={0} />
        <OnboardingContent>
          <Text style={type.h2}>A competing response, not a clamp</Text>
          <Text style={type.muted}>
            CBIT — Comprehensive Behavioral Intervention for Tics — is the approach this app is
            built around. When the urge starts, you do a small movement that uses the same muscles,
            so the tic cannot happen at the same time.
          </Text>
          <View style={{ gap: spacing(1.25) }}>
            {POINTS.map((point) => (
              <Card key={point.title} style={s.point}>
                <View style={s.pointHead}>
                  <Ionicons name={point.icon} size={18} color={colors.primary} />
                  <Text style={[type.label, { color: colors.primary }]}>{point.title.toUpperCase()}</Text>
                </View>
                <Text style={[type.body, { marginTop: spacing(1) }]}>{point.body}</Text>
              </Card>
            ))}
          </View>
          <Text style={type.muted}>
            Next, describe the movements and sounds the way you would tell a friend. Motor and vocal
            are separate, and you can skip either one.
          </Text>
          <Button title="Describe my tics" onPress={() => router.push('/onboarding/describe')} />
        </OnboardingContent>
      </Screen>
    </>
  );
}

const s = StyleSheet.create({
  point: {
    backgroundColor: colors.primarySoft,
    borderColor: 'transparent',
    borderRadius: radius.lg,
  },
  pointHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.75) },
});
