import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { OnboardingBackButton, OnboardingHeader } from '../../src/components/OnboardingMotion';
import { colors } from '../../src/theme';

export default function OnboardingLayout() {
  const router = useRouter();
  return (
    <Stack
      screenOptions={{
        animation: 'none',
        headerBackVisible: false,
        header: ({ options }) => (
          <OnboardingHeader
            title={options.title ?? ''}
            backButton={options.headerLeft?.({ tintColor: colors.primary, canGoBack: true })}
          />
        ),
        headerLeft: () => (
          <OnboardingBackButton
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/welcome');
            }}
          />
        ),
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: '600', color: colors.text },
        headerTintColor: colors.primary,
        headerBackButtonDisplayMode: 'minimal',
        headerBackTitle: '',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="welcome" options={{ title: 'How CBIT works' }} />
      <Stack.Screen name="describe" options={{ title: 'Your tics', headerBackVisible: false }} />
      <Stack.Screen name="rate" options={{ title: 'Tic Severity Scale' }} />
      <Stack.Screen name="about" options={{ title: 'How this works' }} />
      <Stack.Screen name="blockers" options={{ title: 'Your blockers' }} />
    </Stack>
  );
}
