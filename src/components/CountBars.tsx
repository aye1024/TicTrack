import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

/**
 * Counts per bucket — tics across the 24 hours of a day, or across the last
 * few days. A line would imply the watch measured something continuous; these
 * are discrete events, so they are drawn as bars.
 *
 * Bars grow on mount rather than appearing at full height, which reads as the
 * day being replayed and makes the evening cluster obvious at a glance.
 */
export function CountBars({
  values,
  labels,
  highlight,
  color = colors.primary,
  height = 120,
}: {
  values: number[];
  /** Shown under the bar when set; blanks are left unlabelled. */
  labels?: (string | null)[];
  /** Index, or indices, drawn in the accent colour — usually the peak stretch. */
  highlight?: number | number[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  const lit = new Set(typeof highlight === 'number' ? [highlight] : (highlight ?? []));

  return (
    <View>
      <View style={[s.plot, { height }]}>
        {values.map((value, i) => (
          <Bar
            key={i}
            fraction={value / max}
            height={height}
            color={lit.has(i) ? colors.accent : color}
            dim={value === 0}
            delay={i * 18}
          />
        ))}
      </View>
      <View style={s.baseline} />
      {labels ? (
        <View style={s.labels}>
          {labels.map((label, i) => (
            <View key={i} style={s.labelSlot}>
              {label ? <Text style={s.label}>{label}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Bar({
  fraction,
  height,
  color,
  dim,
  delay,
}: {
  fraction: number;
  height: number;
  color: string;
  dim: boolean;
  delay: number;
}) {
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(grow, {
      toValue: 1,
      duration: 380,
      delay,
      useNativeDriver: false,
    }).start();
  }, [grow, delay]);

  // A bar with something in it never falls below 3px, or a quiet hour and an
  // empty one look the same.
  const full = Math.max(fraction > 0 ? 3 : 2, Math.round(fraction * height));

  return (
    <View style={s.slot}>
      <Animated.View
        style={[
          s.bar,
          {
            height: grow.interpolate({ inputRange: [0, 1], outputRange: [2, full] }),
            backgroundColor: dim ? colors.surfaceAlt : color,
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  slot: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: 3, minHeight: 2 },
  baseline: { height: 1, backgroundColor: colors.border },
  labels: { flexDirection: 'row', gap: 2, marginTop: spacing(0.75) },
  labelSlot: { flex: 1, alignItems: 'center' },
  label: type.small,
});
