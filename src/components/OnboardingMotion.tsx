import React, { useCallback, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

/** Render a stable header without native back-title transition text. */
export function OnboardingHeader({
  title,
  backButton,
}: {
  title: string;
  backButton: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View
        style={{
          height: 56,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: Math.max(spacing(2), insets.left),
          paddingRight: Math.max(spacing(2), insets.right),
        }}
      >
        {backButton}
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{ flex: 1, fontSize: 18, fontWeight: '600', color: colors.text }}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}

/** Replay the same fade-and-lift on entry, including returning to a saved screen. */
export function OnboardingContent({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.ComponentProps<typeof Animated.View>['style'];
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      progress.setValue(0);
      const animation = Animated.timing(progress, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }, [progress]),
  );
  return (
    <Animated.View
      style={[
        {
          gap: spacing(2),
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function OnboardingBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={{ width: 44, height: 44, justifyContent: 'center' }}
    >
      <Ionicons name="chevron-back" size={26} color={colors.primary} />
    </Pressable>
  );
}
