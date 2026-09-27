import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme';

export function OptionList({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string; detail?: string }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <View style={s.list}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[s.option, selected && s.optionOn]}
          >
            <Text style={[s.label, selected && s.labelOn]}>{option.label}</Text>
            {option.detail ? (
              <Text style={[s.detail, selected && s.detailOn]}>{option.detail}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: spacing(1) },
  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
  },
  optionOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { ...type.body, fontWeight: '600' },
  labelOn: { color: colors.white },
  detail: { ...type.small, marginTop: 2 },
  detailOn: { color: colors.primarySoft },
});
