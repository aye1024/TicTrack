import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Divider, Screen } from '../../src/components/ui';
import { TrendChart } from '../../src/components/TrendChart';
import { BodyMap } from '../../src/components/BodyMap';
import { useApp } from '../../src/store/AppStore';
import { blockerById } from '../../src/data/blockers';
import { severitySeries } from '../../src/logic/analysis';
import { colors, radius, severityColor, spacing, type } from '../../src/theme';

/** One tic's whole story: current level, its line over time, and its blockers. */
export default function TicDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, update } = useApp();
  const tic = data.tics.find((t) => t.id === id);

  if (!tic) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Tic' }} />
        <Card>
          <Text style={type.h3}>That tic is no longer being tracked.</Text>
        </Card>
      </Screen>
    );
  }

  const series = severitySeries(data, tic.id);
  const first = series[0]?.value;
  const last = series[series.length - 1]?.value;
  const delta = series.length > 1 ? last - first : 0;
  const isTarget = tic.id === data.targetTicId;

  const makeTarget = () =>
    update((draft) => {
      draft.targetTicId = tic.id;
      draft.targetStreakDays = 0;
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: tic.name }} />

      <Card>
        <View style={s.rowBetween}>
          <View>
            <Text style={type.label}>SEVERITY NOW</Text>
            <Text style={[s.big, { color: severityColor(tic.severity) }]}>{tic.severity}/5</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={type.label}>URGE</Text>
            <Text style={[s.big, { color: colors.textMuted }]}>{tic.urge}/5</Text>
          </View>
        </View>

        {series.length > 1 && (
          <Text style={[type.muted, { marginTop: spacing(1) }]}>
            {delta < 0
              ? `Down ${Math.abs(delta).toFixed(1)} points since you started tracking it.`
              : delta > 0
                ? `Up ${delta.toFixed(1)} points since you started tracking it.`
                : 'Unchanged since you started tracking it.'}
          </Text>
        )}

        <Divider />
        <Text style={type.body}>{tic.description || 'No description recorded.'}</Text>
      </Card>

      <Card>
        <Text style={type.label}>OVER TIME</Text>
        <View style={{ height: spacing(1) }} />
        <TrendChart
          series={series}
          width={290}
          height={160}
          color={severityColor(Math.max(2, tic.severity))}
        />
      </Card>

      <Card style={{ alignItems: 'center', paddingVertical: spacing(2.5) }}>
        <Text style={[type.label, { alignSelf: 'flex-start' }]}>WHERE IT HAPPENS</Text>
        <BodyMap
          severityByRegion={{ [tic.region]: tic.severity }}
          size={150}
          showLegend={false}
        />
      </Card>

      <Text style={[type.label, { marginTop: spacing(1) }]}>BLOCKERS</Text>
      {tic.blockerIds.map((blockerId, index) => {
        const blocker = blockerById(blockerId);
        if (!blocker) return null;
        const retired = tic.retiredBlockerIds.includes(blockerId);
        const active = !retired && index === tic.blockerIds.findIndex((b) => !tic.retiredBlockerIds.includes(b));
        return (
          <Card key={blockerId} style={retired ? s.retired : undefined}>
            <View style={s.rowBetween}>
              <Text style={[type.h3, retired && { color: colors.textFaint }]}>{blocker.name}</Text>
              {active && (
                <View style={s.tag}>
                  <Text style={s.tagText}>IN USE</Text>
                </View>
              )}
              {retired && <Text style={type.small}>Tried, did not help</Text>}
            </View>
            <Text style={[type.muted, { marginTop: spacing(0.75) }]}>{blocker.instructions}</Text>
          </Card>
        );
      })}

      {!isTarget && <Button title="Target this tic next" onPress={makeTarget} />}
      {isTarget && (
        <Button title="Start today's practice" onPress={() => router.push('/checkin')} />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  big: { fontSize: 32, fontWeight: '800', marginTop: 2 },
  retired: { opacity: 0.6 },
  tag: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing(1),
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  tagText: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.6 },
});
