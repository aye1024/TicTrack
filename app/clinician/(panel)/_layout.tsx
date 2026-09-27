import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../src/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, [IconName, IconName]> = {
  index: ['people-outline', 'people'],
  messages: ['chatbubble-outline', 'chatbubble'],
};

export default function ClinicianTabs() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, focused, size }) => {
          const [outline, filled] = ICONS[route.name] ?? ICONS.index;
          return <Ionicons name={focused ? filled : outline} size={size ?? 24} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Caseload' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
    </Tabs>
  );
}
