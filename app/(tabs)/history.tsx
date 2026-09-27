import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, EmptyState, Screen } from '../../src/components/ui';
import { CountUp } from '../../src/components/motion';
import { TrendChart } from '../../src/components/TrendChart';
import { useApp } from '../../src/store/AppStore';
import {
  averageSeverity,
  currentStreak,
  factorCorrelation,
  severitySeries,
  severityTrend,
  ticsBySeverity,
} from '../../src/logic/analysis';
import { colors, radius, severityColor, spacing, type } from '../../src/theme';

const TREND_COPY = {
  improving: { label: 'Improving', tone: colors.accent },
  steady: { label: 'Holding steady', tone: colors.primary },
  worsening: { label: 'Trending up', tone: colors.warn },
  not_enough_data: { label: 'Too early to say', tone: colors.textMuted },
};

export default function History() {
  const router = useRouter();
  const { data } = useApp();
  const series = severitySeries(data);
  const trend = severityTrend(data);
  const factors = factorCorrelation(data);
  const practiced = data.checkIns.filter((c) => c.practiced).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Screen>
        <Text style={type.h1}>History</Text>

        <View style={s.stats}>
          <Stat label="Check-ins" value={data.checkIns.length} />
          <Stat label="Streak" value={currentStreak(data)} suffix="d" />
          <Stat label="Practiced" value={practiced} />
        </View>

        <Card>
          <View style={s.rowBetween}>
            <Text style={type.label}>AVERAGE SEVERITY</Text>
            <Text style={[type.small, { color: TREND_COPY[trend].tone, fontWeight: '700' }]}>
              {TREND_COPY[trend].label.toUpperCase()}
            </Text>
          </View>
          <View style={{ height: spacing(1) }} />
          <TrendChart series={series} width={290} height={188} scoreAxis />
        </Card>

        {data.tics.length > 0 && (
          <>
            <Text style={[type.label, { marginTop: spacing(1) }]}>PER TIC</Text>
            {ticsBySeverity(data).map((tic) => (
              <Card key={tic.id} onPress={() => router.push(`/tic/${tic.id}`)}>
                <View style={s.rowBetween}>
                  <Text style={type.h3}>{tic.name}</Text>
                  <Text style={[type.small, { color: severityColor(tic.severity), fontWeight: '700' }]}>
                    {tic.severity}/5 now
                  </Text>
                </View>
                <View style={{ height: spacing(1) }} />
                <TrendChart
                  series={severitySeries(data, tic.id)}
                  width={280}
                  height={156}
                  color={severityColor(Math.max(2, tic.severity))}
                  scoreAxis
                />
              </Card>
            ))}
          </>
        )}

        <Text style={[type.label, { marginTop: spacing(1) }]}>WHAT MAKES IT WORSE</Text>
        {factors.length === 0 ? (
          <EmptyState
            title="Not enough days yet"
            body="Keep logging what your days are like. Once a factor shows up on enough days, we can tell you whether it actually moves your numbers."
          />
        ) : (
          <Card>
            {factors.map((factor, i) => (
              <View key={factor.factor} style={[s.factorRow, i > 0 && s.factorBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{factor.label}</Text>
                  <Text style={type.small}>Logged on {factor.days} {factor.days === 1 ? 'day' : 'days'}</Text>
                </View>
                <CountUp value={factor.delta} decimals={1} prefix="+" style={s.delta} />
              </View>
            ))}
            <Text style={[type.small, { marginTop: spacing(1.5) }]}>
              Average severity on those days, compared with days without.
            </Text>
          </Card>
        )}

        <Button title="Get full report" onPress={() => router.push('/report')} />
      </Screen>
    </SafeAreaView>
  );
}

function Stat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <View style={s.stat}>
      <CountUp value={value} suffix={suffix} style={s.statValue} />
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing(1.5) },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(2),
    alignItems: 'center',
  },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.text },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  factorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(1.5) },
  factorBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  delta: { fontSize: 18, fontWeight: '800', color: colors.warn },
});
