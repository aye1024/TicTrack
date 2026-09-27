import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useApp } from '../src/store/AppStore';
import { colors } from '../src/theme';

/** Route gate: restore the session, then land the user where they left off. */
export default function Index() {
  const { ready, signedIn, data } = useApp();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!signedIn) return <Redirect href="/welcome" />;
  if (data.profile?.role === 'clinician') return <Redirect href="/clinician" />;
  if (!data.profile?.clinicianId && !data.profile?.skippedClinician) return <Redirect href="/choose-clinician" />;
  if (!data.onboarded) return <Redirect href="/onboarding/welcome" />;
  return <Redirect href="/(tabs)" />;
}
