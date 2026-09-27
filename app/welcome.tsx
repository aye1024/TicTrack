import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Button } from '../src/components/ui';
import { FadeInUp } from '../src/components/motion';
import { colors, spacing, type } from '../src/theme';

export default function Welcome() {
  const router = useRouter();
  return (
    <LinearGradient colors={['#EEF1FC', colors.bg]} style={{ flex: 1 }}>
      <SafeAreaView style={s.root}>
        <FadeInUp>
          <View style={s.hero}>
            <Mark />
            <Text style={s.title}>TicTrack</Text>
            <Text style={s.tagline}>
              Comprehensive Behavioral Intervention for Tics, right in your pocket. Track the
              impact of your tics, learn methods to reduce their severity, and easily communicate
              your progress with your health care provider.
            </Text>
          </View>
        </FadeInUp>

        <View style={s.points}>
          <Point index={1} icon="mic-outline" text="Describe your tics out loud. No forms to fill in." />
          <Point index={2} icon="timer-outline" text="A daily check-in that takes under two minutes." />
          <Point index={3} icon="document-text-outline" text="A report your clinician can actually read." />
        </View>

        <FadeInUp index={4}>
          <View style={s.actions}>
            <Button title="Create an account" onPress={() => router.push('/sign-up')} />
            <Button title="Log in as a patient" variant="secondary" onPress={() => router.push('/sign-in')} />
            <Button
              title="Log in as a clinician"
              variant="secondary"
              onPress={() => router.push('/clinician-sign-in')}
            />
          </View>
        </FadeInUp>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Point({
  text,
  icon,
  index,
}: {
  text: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  index: number;
}) {
  return (
    <FadeInUp index={index}>
      <View style={s.point}>
        <View style={s.pointIcon}>
          <Ionicons name={icon} size={17} color={colors.primary} />
        </View>
        <Text style={[type.body, { flex: 1, color: colors.textMuted }]}>{text}</Text>
      </View>
    </FadeInUp>
  );
}

function Mark() {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72">
      <Circle cx={36} cy={36} r={34} fill={colors.primarySoft} />
      <Path
        d="M18 44 L28 44 L33 28 L40 52 L45 38 L54 38"
        fill="none"
        stroke={colors.primary}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: spacing(3), justifyContent: 'space-between' },
  hero: { marginTop: spacing(6), gap: spacing(1.5) },
  title: { ...type.h1, fontSize: 54, letterSpacing: -1, marginTop: spacing(1) },
  tagline: { ...type.body, color: colors.textMuted, fontSize: 16 },
  points: { gap: spacing(1.5) },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  pointIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: spacing(1.25), marginBottom: spacing(1) },
});
