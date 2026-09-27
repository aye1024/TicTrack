import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';

export function Stepper({ total, current }: { total: number; current: number }) {
  return (
    <View style={s.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            s.bar,
            { backgroundColor: i <= current ? colors.primary : colors.border },
            i === current && { flex: 1.4 },
          ]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing(0.75), marginBottom: spacing(1) },
  bar: { flex: 1, height: 5, borderRadius: 3 },
});
