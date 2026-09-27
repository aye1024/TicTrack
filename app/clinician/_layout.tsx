import React from 'react';
import { Stack } from 'expo-router';

/** Caseload and messages stay in the tab bar. A thread opens above them. */
export default function ClinicianLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(panel)" />
      <Stack.Screen name="thread" />
    </Stack>
  );
}
