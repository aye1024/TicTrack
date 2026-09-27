import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function CheckinLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: '600', color: colors.text },
        headerTintColor: colors.primary,
        headerBackButtonDisplayMode: 'minimal',
        headerBackTitle: '',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Daily check-in' }} />
      <Stack.Screen name="practice" options={{ title: 'Practice', headerBackVisible: false }} />
      <Stack.Screen name="result" options={{ title: 'How did it go?', headerBackVisible: false }} />
    </Stack>
  );
}
