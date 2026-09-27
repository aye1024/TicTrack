import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../src/store/AppStore';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.bg },
              headerTitleStyle: { fontWeight: '600', color: colors.text },
              headerTintColor: colors.primary,
              // A plain chevron on every screen — never the previous screen's
              // title tagging along beside it.
              headerBackButtonDisplayMode: 'minimal',
              headerBackTitle: '',
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ title: 'Patient log in' }} />
            <Stack.Screen name="clinician-sign-in" options={{ title: 'Clinician log in' }} />
            <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
            <Stack.Screen name="choose-clinician" options={{ title: 'Your clinician' }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="checkin" options={{ headerShown: false }} />
            <Stack.Screen name="watch" options={{ title: 'Wearable' }} />
            <Stack.Screen name="report" options={{ title: 'Full report' }} />
            <Stack.Screen name="clinician" options={{ headerShown: false }} />
          </Stack>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
