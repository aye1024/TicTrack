import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing, severityColor, type } from '../theme';

const SEVERITY_WORDS = [
  'Not today',
  'Barely noticed it',
  'Mildly annoying',
  'Got in the way',
  'Hard to work around',
  'Took over the day',
];

/** Indexed from 1 — the urge scale has no zero. */
const URGE_WORDS = [
  '',
  'A faint feeling',
  'Noticeable build-up',
  'Clear, steady pull',
  'Very hard to sit with',
  'Impossible to ignore',
];

/**
 * A rating scale sized for one-handed use. Each step animates rather than
 * snapping, and the caption changes with it, so the number always carries a
 * plain-language meaning — people rate far more consistently that way.
 *
 * The two kinds are deliberately not styled alike. Severity runs 1–5 on a
 * warning ramp: a one is barely there, and a five is genuinely bad. Zero is
 * not an option, because a tracked tic still belongs on the body diagram.
 * The urge runs 1–5 in a single neutral colour: a strong premonitory urge is
 * not a bad outcome — it is more warning, which makes the competing response
 * easier to land — so colouring a five red would tell the user the wrong thing.
 */
export function SeverityScale({
  value,
  onChange,
  kind = 'severity',
  max = 5,
  min: minimum,
  endpointLabels,
}: {
  value: number;
  onChange: (value: number) => void;
  kind?: 'severity' | 'urge';
  max?: number;
  min?: number;
  endpointLabels?: { left: string; right: string };
}) {
  const isUrge = kind === 'urge';
  const min = minimum ?? 1;
  const words = isUrge ? URGE_WORDS : SEVERITY_WORDS;
  const caption = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  // Cross-fade the caption whenever the rating moves.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    caption.setValue(0);
    const animation = Animated.timing(caption, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [value, caption]);

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((i) => (
          <Step
            key={i}
            index={i}
            active={value === i}
            neutral={isUrge}
            onPress={() => {
              if (value !== i) Haptics.selectionAsync().catch(() => {});
              onChange(i);
            }}
          />
        ))}
      </View>
      {endpointLabels ? (
        <View style={s.endpoints}>
          <Text style={s.endpoint}>{endpointLabels.left}</Text>
          <Text style={[s.endpoint, { textAlign: 'right' }]}>{endpointLabels.right}</Text>
        </View>
      ) : (
        <Animated.Text
          style={[
            s.caption,
            {
              opacity: caption,
              transform: [
                { translateY: caption.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) },
              ],
            },
          ]}
        >
          {words[Math.max(min, Math.min(value, words.length - 1))]}
        </Animated.Text>
      )}
    </View>
  );
}

function Step({
  index,
  active,
  neutral,
  onPress,
}: {
  index: number;
  active: boolean;
  neutral?: boolean;
  onPress: () => void;
}) {
  const lift = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.spring(lift, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    });
    animation.start();
    return () => animation.stop();
  }, [active, lift]);

  return (
    <Pressable onPress={onPress} style={s.hit} hitSlop={4}>
      <Animated.View
        style={[
          s.dot,
          {
            backgroundColor: neutral
              ? colors.textFaint
              : index === 0
                ? colors.surfaceAlt
                : severityColor(index),
          },
          active && s.dotActive,
          {
            transform: [
              { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] }) },
            ],
          },
        ]}
      >
        <Text
          style={[
            s.dotText,
            active && s.dotTextActive,
            index === 0 && !neutral && { color: colors.textMuted },
          ]}
        >
          {index}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { gap: spacing(1.25) },
  row: { flexDirection: 'row', gap: spacing(0.75) },
  hit: { flex: 1 },
  dot: {
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dotActive: {
    borderColor: colors.text,
    shadowColor: '#0B1020',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dotText: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.92)' },
  dotTextActive: { color: colors.white },
  caption: { ...type.muted, fontWeight: '600', minHeight: 20 },
  endpoints: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing(2) },
  endpoint: { ...type.muted, flex: 1 },
});
