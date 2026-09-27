import React, { useCallback, useRef } from 'react';
import { Animated, Easing, Pressable, Text, type TextStyle, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Small motion helpers shared across the app.
 *
 * These use the Animated API rather than Reanimated: every animation here is a
 * simple transform or opacity tween that runs fine on the native driver, and
 * keeping one animation system avoids a second worklet runtime for no gain.
 */

/** A card or row that dips slightly under the finger. */
export function PressableScale({
  children,
  onPress,
  disabled,
  haptic = true,
  style,
  scaleTo = 0.975,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  haptic?: boolean;
  style?: ViewStyle;
  scaleTo?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = useCallback(
    (to: number) =>
      Animated.spring(scale, {
        toValue: to,
        useNativeDriver: true,
        speed: 40,
        bounciness: 4,
      }).start(),
    [scale],
  );

  if (!onPress) return <Animated.View style={style}>{children}</Animated.View>;

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => animate(scaleTo)}
      onPressOut={() => animate(1)}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Fades and lifts content in on mount. `index` staggers a list so the screen
 * assembles rather than snapping into place all at once.
 */
export function FadeInUp({
  children,
  index = 0,
  distance = 14,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  distance?: number;
  style?: ViewStyle;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 340,
      delay: Math.min(index, 8) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, index]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A number that counts up to its value on mount, and tracks it afterwards.
 *
 * Statistics that snap into place read as pre-baked; the same figure arriving
 * over a few hundred milliseconds reads as having just been worked out. Text
 * content cannot be driven by the native driver — there is no animatable text
 * property — so this listens to the tween and re-renders. That is affordable for
 * the handful of headline figures it is used on, and wrong for a long list.
 */
export function CountUp({
  value,
  duration = 750,
  /** Decimal places. Whole numbers by default. */
  decimals = 0,
  prefix = '',
  suffix = '',
  style,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  style?: TextStyle | TextStyle[];
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = React.useState(0);
  const from = useRef(0);

  React.useEffect(() => {
    const start = from.current;
    const id = progress.addListener(({ value: t }) => {
      setShown(start + (value - start) * t);
    });
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) {
        // Land exactly on the value; interpolation can leave it a hair short.
        setShown(value);
        from.current = value;
      }
    });
    return () => {
      animation.stop();
      progress.removeListener(id);
      from.current = value;
    };
  }, [value, duration, progress]);

  return (
    <Text style={style}>
      {prefix}
      {shown.toFixed(decimals)}
      {suffix}
    </Text>
  );
}

/** Smoothly tracks a changing number — used by the streak and severity chips. */
export function useAnimatedValue(target: number, duration = 420) {
  const value = useRef(new Animated.Value(target)).current;
  React.useEffect(() => {
    const animation = Animated.timing(value, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [target, duration, value]);
  return value;
}
